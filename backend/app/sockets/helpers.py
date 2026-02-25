import logging
import time as _time
from collections import defaultdict
from datetime import datetime, timezone
from flask import request
from flask_socketio import emit

from app.models.generation import Generation
from app.services.credit_service import validate_generation_credits
from app.utils.db import get_supabase

logger = logging.getLogger(__name__)

connected_users = {}

STALE_TIMEOUT_MINUTES = 5

_rate_limit_store = defaultdict(list)
SOCKET_RATE_LIMIT = 10
SOCKET_RATE_WINDOW = 60


def _check_socket_rate_limit(sid):
    now = _time.time()
    window_start = now - SOCKET_RATE_WINDOW
    _rate_limit_store[sid] = [
        t for t in _rate_limit_store[sid] if t > window_start
    ]
    if len(_rate_limit_store[sid]) >= SOCKET_RATE_LIMIT:
        return False
    _rate_limit_store[sid].append(now)
    return True


def _cleanup_rate_limit(sid):
    _rate_limit_store.pop(sid, None)


def _get_user_from_sid(sid):
    return connected_users.get(sid)


def _room_for(user_id):
    return f'user_{user_id}'


def _is_stale(generation):
    created = generation.created_at
    if isinstance(created, str):
        created = datetime.fromisoformat(created.replace('Z', '+00:00'))
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age_minutes = (datetime.now(timezone.utc) - created).total_seconds() / 60
    return age_minutes > STALE_TIMEOUT_MINUTES


def _fail_stale_generation(gen_id):
    get_supabase().table('generations').update({
        'status': 'failed',
        'error_message': 'Generation timed out',
    }).eq('id', gen_id).execute()


def _check_active_generation(user_id):
    result = get_supabase().table('generations').select('*').eq(
        'user_id', user_id
    ).eq('status', 'generating').order('created_at', desc=True).execute()

    if not result.data:
        return None

    active = None
    for row in result.data:
        gen = Generation.from_row(row)
        if _is_stale(gen):
            logger.warning("Gen #%s is stale, marking as failed", gen.id)
            _fail_stale_generation(gen.id)
        elif active is None:
            active = gen
    return active


RECENT_COMPLETION_MINUTES = 2


def _check_recent_completion(user_id):
    result = get_supabase().table('generations').select('*').eq(
        'user_id', user_id
    ).eq('status', 'completed').order('completed_at', desc=True).limit(1).execute()

    if not result.data:
        return None

    gen = Generation.from_row(result.data[0])

    if not gen.completed_at:
        return None

    completed = gen.completed_at
    if isinstance(completed, str):
        completed = datetime.fromisoformat(completed.replace('Z', '+00:00'))
    if completed.tzinfo is None:
        completed = completed.replace(tzinfo=timezone.utc)

    age_minutes = (datetime.now(timezone.utc) - completed).total_seconds() / 60

    if age_minutes <= RECENT_COMPLETION_MINUTES:
        return gen

    return None


def _refresh_user(user):
    from app.models.user import User
    result = get_supabase().table('users').select('*').eq('id', user.id).execute()
    if result.data:
        return User.from_row(result.data[0])
    return user


def _require_authenticated_user():
    user = _get_user_from_sid(request.sid)
    if not user:
        emit('generation_error', {'error': 'Not authenticated'})
    return user


def _require_no_active_generation(user):
    active = _check_active_generation(user.id)
    if active:
        emit('generation_error', {
            'error': 'A cover is already being generated. Please wait for it to finish.',
            'generation_id': active.id,
        })
        return False
    return True


def _validate_generation_credits(
    user,
    use_style_image,
    base_image_only,
    reference_mode,
    text_blending_mode,
    style_ref_has_clean,
    style_ref_has_text,
    two_step_generation,
    use_template=False,
):
    user = _refresh_user(user)
    validation = validate_generation_credits(
        user=user,
        use_style_image=use_style_image,
        base_image_only=base_image_only,
        reference_mode=reference_mode,
        text_blending_mode=text_blending_mode,
        style_ref_has_clean=style_ref_has_clean,
        style_ref_has_text=style_ref_has_text,
        two_step_generation=two_step_generation,
        use_template=use_template,
    )

    if not validation['can_afford']:
        emit('generation_error', {
            'error': f"Not enough credits. This generation costs {validation['total']} credits.",
            'required': validation['total'],
            'available': validation['user_credits'],
        })
        return None, None

    connected_users[request.sid] = user
    return user, validation
