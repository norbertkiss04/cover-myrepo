import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Blueprint, request, jsonify, current_app

from app.models.user import User
from app.config import INITIAL_CREDITS
from app import limiter

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

INVITE_CODE_PATTERN = re.compile(r'^[A-Za-z0-9_-]{8,64}$')
INVITE_CODE_BYTES = 16
INVITE_EXPIRY_DAYS = 7
MAX_INVITE_CODE_LENGTH = 64


def sanitize_invite_code(value):
    if value is None:
        return None
    code = str(value).strip()
    if len(code) > MAX_INVITE_CODE_LENGTH:
        return None
    if not INVITE_CODE_PATTERN.fullmatch(code):
        return None
    return code


def generate_invite_code():
    return secrets.token_urlsafe(INVITE_CODE_BYTES).rstrip('=')

def get_user_from_token(token):
    try:
        logger.debug("Validating token via Supabase...")
        response = current_app.supabase.auth.get_user(token)
        logger.info("Token valid (supabase_id=%s)", response.user.id)
        return response.user
    except Exception as e:
        logger.warning("Token validation failed: %s", e)
        return None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            logger.warning("Request missing auth token: %s %s", request.method, request.path)
            return jsonify({'error': 'Token is missing'}), 401

        supabase_user = get_user_from_token(token)
        if not supabase_user:
            logger.warning("Invalid/expired token for %s %s", request.method, request.path)
            return jsonify({'error': 'Invalid or expired token'}), 401

        supabase_user_id = supabase_user.id
        email = supabase_user.email

        if not supabase_user_id or not email:
            logger.warning("Token payload missing id or email")
            return jsonify({'error': 'Invalid token payload'}), 401

        sb = current_app.supabase
        logger.debug("Looking up user in DB (google_id=%s)", supabase_user_id)
        result = sb.table('users').select('*').eq(
            'google_id', supabase_user_id
        ).execute()

        if result.data:
            user = User.from_row(result.data[0])
            logger.info("User found in DB (id=%s)", user.id)
        else:
            logger.info("User not found in DB, creating new user (supabase_id=%s)", supabase_user_id)
            metadata = supabase_user.user_metadata or {}
            raw_invite = metadata.get('invite_code') or metadata.get('inviteCode')
            if raw_invite is None:
                logger.warning("Missing invite code for supabase_id=%s", supabase_user_id)
                return jsonify({'error': 'Invite code required'}), 403

            invite_code = sanitize_invite_code(raw_invite)
            if not invite_code:
                logger.warning("Invalid invite code for supabase_id=%s", supabase_user_id)
                return jsonify({'error': 'Invite code invalid or expired'}), 403

            try:
                consume_result = sb.rpc('consume_invite', {
                    'p_code': invite_code,
                    'p_google_id': supabase_user_id,
                }).execute()
            except Exception as e:
                logger.error("Invite consume failed for supabase_id=%s: %s", supabase_user_id, e)
                return jsonify({'error': 'Failed to validate invite'}), 500

            if not consume_result.data:
                logger.warning("Invalid invite code for supabase_id=%s", supabase_user_id)
                return jsonify({'error': 'Invite code invalid or expired'}), 403

            new_user_data = {
                'google_id': supabase_user_id,
                'email': email,
                'name': (
                    metadata.get('full_name')
                    or metadata.get('name')
                    or email.split('@')[0]
                ),
                'picture': (
                    metadata.get('avatar_url')
                    or metadata.get('picture')
                ),
                'credits': INITIAL_CREDITS,
            }
            try:
                insert_result = sb.table('users').insert(new_user_data).execute()
                user = User.from_row(insert_result.data[0])
                logger.info("User created (id=%s, credits=%d)", user.id, user.credits)
            except Exception as e:
                logger.warning(
                    "User insert failed (likely race condition), retrying lookup: %s", e
                )
                result = sb.table('users').select('*').eq(
                    'google_id', supabase_user_id
                ).execute()
                if result.data:
                    user = User.from_row(result.data[0])
                    logger.info("User found on retry (id=%s)", user.id)
                else:
                    logger.error("Failed to create or find user (supabase_id=%s)", supabase_user_id)
                    return jsonify({'error': 'Failed to create user'}), 500

        return f(user, *args, **kwargs)

    return decorated

@auth_bp.route('/me')
@limiter.limit("30 per minute")
@token_required
def get_current_user(current_user):
    logger.info("Returning user info (id=%s)", current_user.id)
    return jsonify(current_user.to_dict())

MAX_NAME_LENGTH = 200
MAX_URL_LENGTH = 2048


@auth_bp.route('/sync', methods=['POST'])
@token_required
def sync_user(current_user):
    data = request.get_json() or {}

    update_data = {}
    if data.get('name'):
        name = str(data['name'])[:MAX_NAME_LENGTH].strip()
        if name:
            update_data['name'] = name
    if data.get('picture'):
        picture = str(data['picture'])[:MAX_URL_LENGTH].strip()
        if picture.startswith(('http://', 'https://')):
            update_data['picture'] = picture

    if update_data:
        logger.info(
            "Syncing user id=%s, updating fields: %s",
            current_user.id, list(update_data.keys()),
        )
        sb = current_app.supabase
        result = sb.table('users').update(update_data).eq(
            'id', current_user.id
        ).execute()
        if result.data:
            current_user = User.from_row(result.data[0])
            logger.info("User sync complete (id=%s)", current_user.id)
    else:
        logger.info("Sync called for user id=%s, nothing to update", current_user.id)

    return jsonify(current_user.to_dict())


@auth_bp.route('/invites', methods=['POST'])
@token_required
def create_invite(current_user):
    if not current_user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=INVITE_EXPIRY_DAYS)
    sb = current_app.supabase

    invite_code = None
    insert_result = None
    for _ in range(5):
        code = generate_invite_code()
        try:
            insert_result = sb.table('invites').insert({
                'code': code,
                'created_by': current_user.id,
                'expires_at': expires_at.isoformat(),
            }).execute()
        except Exception as e:
            logger.warning("Invite insert failed for user id=%s: %s", current_user.id, e)
            insert_result = None
        if insert_result and insert_result.data:
            invite_code = code
            break

    if not invite_code:
        return jsonify({'error': 'Failed to create invite'}), 500

    frontend_url = current_app.config.get('FRONTEND_URL', '').rstrip('/')
    invite_url = f"{frontend_url}/login?invite={invite_code}" if frontend_url else f"/login?invite={invite_code}"

    return jsonify({
        'code': invite_code,
        'invite_url': invite_url,
        'expires_at': expires_at.isoformat(),
    })


@auth_bp.route('/invites', methods=['GET'])
@token_required
def list_invites(current_user):
    if not current_user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    sb = current_app.supabase
    try:
        result = sb.table('invites').select(
            'id, code, created_at, expires_at, used_at'
        ).eq(
            'created_by', current_user.id
        ).order(
            'created_at', desc=True
        ).limit(50).execute()
    except Exception as e:
        logger.error("Failed to fetch invites for user id=%s: %s", current_user.id, e)
        return jsonify({'error': 'Failed to fetch invites'}), 500

    return jsonify({'invites': result.data or []})


@auth_bp.route('/invites/<int:invite_id>', methods=['DELETE'])
@token_required
def delete_invite(current_user, invite_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    sb = current_app.supabase
    try:
        sb.table('invites').delete().eq(
            'id', invite_id
        ).eq(
            'created_by', current_user.id
        ).execute()
    except Exception as e:
        logger.error("Failed to delete invite %d for user %d: %s", invite_id, current_user.id, e)
        return jsonify({'error': 'Failed to delete invite'}), 500

    return jsonify({'success': True})


ALLOWED_VISIBLE_FIELDS = {
    'description', 'genres', 'mood', 'color_preference',
    'character_description', 'keywords', 'cover_ideas',
    'reference_image_description',
}
MAX_PREFERENCES_SIZE = 4096


@auth_bp.route('/preferences', methods=['PUT'])
@token_required
def update_preferences(current_user):
    data = request.get_json() or {}

    raw_body = request.get_data(as_text=True)
    if len(raw_body) > MAX_PREFERENCES_SIZE:
        return jsonify({'error': 'Preferences payload too large'}), 400

    allowed_keys = {'visible_fields'}
    sanitized = {}

    if 'visible_fields' in data:
        fields = data['visible_fields']
        if not isinstance(fields, list):
            return jsonify({'error': 'visible_fields must be an array'}), 400
        sanitized['visible_fields'] = [
            f for f in fields
            if isinstance(f, str) and f in ALLOWED_VISIBLE_FIELDS
        ]

    unknown_keys = set(data.keys()) - allowed_keys
    if unknown_keys:
        logger.warning(
            "Unknown preference keys from user id=%s: %s",
            current_user.id, unknown_keys,
        )

    logger.info("Updating preferences for user id=%s (fields=%s)", current_user.id, list(sanitized.keys()))

    sb = current_app.supabase
    result = sb.table('users').update(
        {'preferences': sanitized}
    ).eq('id', current_user.id).execute()

    if result.data:
        updated_user = User.from_row(result.data[0])
        logger.info("Preferences updated for user id=%s", current_user.id)
        return jsonify(updated_user.to_dict())

    return jsonify({'error': 'Failed to update preferences'}), 500

@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    logger.info("User logged out (id=%s)", current_user.id)
    return jsonify({'message': 'Logged out successfully'})
