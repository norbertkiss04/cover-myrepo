import logging
from functools import wraps
from flask import Blueprint, request, jsonify, current_app

from app.models.user import User

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)


def get_user_from_token(token):
    """
    Validate a Supabase access token using the Supabase Python client.
    Returns the Supabase user object or None if invalid.
    """
    try:
        logger.debug("Validating token via Supabase...")
        response = current_app.supabase.auth.get_user(token)
        logger.info(
            "Token valid for %s (supabase_id=%s)",
            response.user.email, response.user.id,
        )
        return response.user
    except Exception as e:
        logger.warning("Token validation failed: %s", e)
        return None


def token_required(f):
    """Decorator to require a valid Supabase auth token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Get token from header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            logger.warning("Request missing auth token: %s %s", request.method, request.path)
            return jsonify({'error': 'Token is missing'}), 401

        # Validate token via Supabase
        supabase_user = get_user_from_token(token)
        if not supabase_user:
            logger.warning("Invalid/expired token for %s %s", request.method, request.path)
            return jsonify({'error': 'Invalid or expired token'}), 401

        supabase_user_id = supabase_user.id
        email = supabase_user.email

        if not supabase_user_id or not email:
            logger.warning("Token payload missing id or email")
            return jsonify({'error': 'Invalid token payload'}), 401

        # Find or create user in our database
        sb = current_app.supabase
        logger.debug("Looking up user in DB (google_id=%s)", supabase_user_id)
        result = sb.table('users').select('*').eq(
            'google_id', supabase_user_id
        ).execute()

        if result.data:
            user = User.from_row(result.data[0])
            logger.info("User found in DB (id=%s, email=%s)", user.id, email)
        else:
            # Create user from Supabase auth data
            logger.info("User not found in DB, creating new user (email=%s)", email)
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
            }
            try:
                insert_result = sb.table('users').insert(new_user_data).execute()
                user = User.from_row(insert_result.data[0])
                logger.info("User created (id=%s, email=%s)", user.id, email)
            except Exception as e:
                # Race condition: another request inserted this user
                # between our SELECT and INSERT. Just fetch the existing row.
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
                    logger.error("Failed to create or find user (email=%s)", email)
                    return jsonify({'error': 'Failed to create user'}), 500

        return f(user, *args, **kwargs)

    return decorated


@auth_bp.route('/me')
@token_required
def get_current_user(current_user):
    """Get current user information."""
    logger.info("Returning user info (id=%s)", current_user.id)
    return jsonify(current_user.to_dict())


@auth_bp.route('/sync', methods=['POST'])
@token_required
def sync_user(current_user):
    """
    Sync user data from Supabase.
    Called after login to ensure user exists in our DB.
    """
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
    """Update user preferences (visible form fields, etc.)."""
    data = request.get_json() or {}
    logger.info("Updating preferences for user id=%s: %s", current_user.id, data)

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
    """
    Logout endpoint.
    Actual logout is handled by Supabase on frontend.
    This is just for any server-side cleanup if needed.
    """
    logger.info("User logged out (id=%s)", current_user.id)
    return jsonify({'message': 'Logged out successfully'})
