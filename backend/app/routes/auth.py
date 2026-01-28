import logging
from functools import wraps
from flask import Blueprint, request, jsonify, current_app

from app.models.user import User
from app.config import INITIAL_CREDITS

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

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
@token_required
def get_current_user(current_user):
    logger.info("Returning user info (id=%s)", current_user.id)
    return jsonify(current_user.to_dict())

@auth_bp.route('/sync', methods=['POST'])
@token_required
def sync_user(current_user):
    data = request.get_json() or {}

    update_data = {}
    if data.get('name'):
        update_data['name'] = data['name']
    if data.get('picture'):
        update_data['picture'] = data['picture']

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

@auth_bp.route('/preferences', methods=['PUT'])
@token_required
def update_preferences(current_user):
    data = request.get_json() or {}
    logger.info("Updating preferences for user id=%s (fields=%s)", current_user.id, list(data.keys()))

    sb = current_app.supabase
    result = sb.table('users').update(
        {'preferences': data}
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
