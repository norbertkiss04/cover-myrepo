import logging
from flask import request, current_app
from flask_socketio import emit, join_room, disconnect

from app import socketio
from app.models.generation import Generation, ASPECT_RATIOS
from app.routes.auth import get_user_from_token
from app.sockets.helpers import (
    connected_users,
    _room_for,
    _check_active_generation,
    _check_recent_completion,
    _require_authenticated_user,
    _require_no_active_generation,
    _validate_generation_credits,
    _check_socket_rate_limit,
    _cleanup_rate_limit,
)
from app.sockets.tasks import _run_generation_task
from app.utils.db import get_supabase
from app.utils.validation import sanitize_generation_data

logger = logging.getLogger(__name__)


VALID_REFERENCE_MODES = ('both', 'background', 'text')
VALID_BLENDING_MODES = ('ai_blend', 'direct_overlay', 'separate_reference')


def _launch_generation(generation, user, validation, text_blending_mode='ai_blend'):
    emit('generation_started', {
        'generation_id': generation.id,
        'book_title': generation.book_title,
        'author_name': generation.author_name,
        'estimated_cost': validation['total'],
        'user_credits': validation['user_credits'],
    }, room=_room_for(user.id))

    socketio.start_background_task(
        _run_generation_task,
        current_app._get_current_object(),
        generation,
        user,
        generation.style_reference_id,
        generation.use_style_image,
        generation.aspect_ratio,
        generation.base_image_only,
        generation.reference_mode,
        text_blending_mode,
        generation.cover_template_id,
    )


@socketio.on('connect')
def handle_connect(auth=None):
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get('token')

    if not token:
        logger.warning("Socket connect rejected: no token (sid=%s)", request.sid)
        disconnect()
        return False

    supabase_user = get_user_from_token(token)
    if not supabase_user:
        logger.warning("Socket connect rejected: invalid token (sid=%s)", request.sid)
        disconnect()
        return False

    supabase_user_id = supabase_user.id
    sb = get_supabase()
    db_result = sb.table('users').select('*').eq('google_id', supabase_user_id).execute()

    if not db_result.data:
        logger.warning("Socket connect rejected: user not in DB (sid=%s)", request.sid)
        disconnect()
        return False

    from app.models.user import User
    user = User.from_row(db_result.data[0])

    connected_users[request.sid] = user
    join_room(_room_for(user.id))
    logger.info("Socket connected: user id=%s (sid=%s)", user.id, request.sid)

    active = _check_active_generation(user.id)
    if active:
        logger.info("User id=%s has active generation #%s, notifying", user.id, active.id)
        emit('active_generation', {
            'generation_id': active.id,
            'book_title': active.book_title,
            'author_name': active.author_name,
            'step': active.current_step or 0,
            'total_steps': active.total_steps or 0,
            'step_message': active.step_message or 'Resuming generation...',
        })
    else:
        recent = _check_recent_completion(user.id)
        if recent:
            logger.info("User id=%s has recent completion #%s, sending result", user.id, recent.id)
            from app.services.storage_service import storage_service
            emit('generation_completed', {
                'generation_id': recent.id,
                'generation': storage_service.sign_generation_dict(recent.to_dict()),
            })


@socketio.on('disconnect')
def handle_disconnect():
    _cleanup_rate_limit(request.sid)
    user = connected_users.pop(request.sid, None)
    if user:
        logger.info("Socket disconnected: user id=%s (sid=%s)", user.id, request.sid)
    else:
        logger.info("Socket disconnected: unknown (sid=%s)", request.sid)


@socketio.on('start_generation')
def handle_start_generation(data):
    if not _check_socket_rate_limit(request.sid):
        emit('generation_error', {'error': 'Too many requests. Please slow down.'})
        return

    user = _require_authenticated_user()
    if not user:
        return

    if not _require_no_active_generation(user):
        return

    if data.get('genres') and not isinstance(data['genres'], list):
        emit('generation_error', {'error': 'genres must be an array'})
        return

    sanitized = sanitize_generation_data(data)
    if sanitized is None:
        emit('generation_error', {'error': 'Invalid input detected. Please revise your text.'})
        return

    base_image_only = bool(data.get('base_image_only', False))

    if not base_image_only and (not sanitized.get('book_title') or not sanitized.get('author_name')):
        emit('generation_error', {'error': 'Missing required fields: book_title, author_name'})
        return

    aspect_ratio = data.get('aspect_ratio', '2:3')
    if aspect_ratio not in ASPECT_RATIOS:
        emit('generation_error', {
            'error': f'Invalid aspect_ratio. Must be one of: {list(ASPECT_RATIOS.keys())}'
        })
        return

    reference_mode = data.get('reference_mode', 'both')
    if reference_mode not in VALID_REFERENCE_MODES:
        reference_mode = 'both'

    text_blending_mode = data.get('text_blending_mode', 'ai_blend')
    if text_blending_mode not in VALID_BLENDING_MODES:
        text_blending_mode = 'ai_blend'

    two_step_generation = bool(data.get('two_step_generation', True))
    use_style_image = bool(data.get('use_style_image', False))
    style_reference_id = data.get('style_reference_id')
    cover_template_id = data.get('cover_template_id')

    use_template = False
    if cover_template_id is not None:
        if not isinstance(cover_template_id, int):
            emit('generation_error', {'error': 'cover_template_id must be an integer'})
            return

        template_result = get_supabase().table('cover_templates').select('id').eq(
            'id', cover_template_id
        ).eq('user_id', user.id).execute()
        if not template_result.data:
            emit('generation_error', {'error': 'Cover template not found'})
            return

        use_template = True

    if use_template and base_image_only:
        emit('generation_error', {'error': 'base_image_only cannot be used with cover_template_id'})
        return

    style_ref_has_clean = False
    style_ref_has_text = False
    if use_style_image and style_reference_id:
        ref_result = get_supabase().table('style_references').select(
            'clean_image_path, text_layer_path'
        ).eq('id', style_reference_id).eq('user_id', user.id).execute()
        if ref_result.data:
            style_ref_has_clean = bool(ref_result.data[0].get('clean_image_path'))
            style_ref_has_text = bool(ref_result.data[0].get('text_layer_path'))

    user, validation = _validate_generation_credits(
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
    if not validation:
        return

    gen_data = {
        'user_id': user.id,
        'book_title': sanitized.get('book_title', '') or ('Untitled' if base_image_only else ''),
        'author_name': sanitized.get('author_name', ''),
        'cover_ideas': sanitized.get('cover_ideas', ''),
        'description': sanitized.get('description', ''),
        'genres': sanitized.get('genres', []),
        'mood': sanitized.get('mood', ''),
        'aspect_ratio': aspect_ratio,
        'color_preference': sanitized.get('color_preference'),
        'character_description': sanitized.get('character_description'),
        'keywords': sanitized.get('keywords'),
        'style_reference_id': style_reference_id,
        'cover_template_id': cover_template_id if use_template else None,
        'use_style_image': use_style_image,
        'base_image_only': base_image_only,
        'reference_mode': reference_mode,
        'two_step_generation': two_step_generation,
        'status': 'generating',
    }

    result = get_supabase().table('generations').insert(gen_data).execute()
    generation = Generation.from_row(result.data[0])

    logger.info(
        "Gen #%s created via socket (user id=%s, use_style_image=%s, blending=%s, estimated_cost=%d)",
        generation.id, user.id, generation.use_style_image, text_blending_mode, validation['total'],
    )

    _launch_generation(generation, user, validation, text_blending_mode)


@socketio.on('cancel_generation')
def handle_cancel_generation():
    user = _require_authenticated_user()
    if not user:
        return

    active = _check_active_generation(user.id)
    if not active:
        emit('generation_error', {'error': 'No active generation to cancel'})
        return

    logger.info("User id=%s cancelling generation #%s", user.id, active.id)

    get_supabase().table('generations').update({
        'status': 'failed',
        'error_message': 'Cancelled by user',
    }).eq('id', active.id).execute()

    socketio.emit('generation_failed', {
        'generation_id': active.id,
        'error': 'Cancelled by user',
    }, room=_room_for(user.id))


@socketio.on('start_regeneration')
def handle_start_regeneration(data):
    if not _check_socket_rate_limit(request.sid):
        emit('generation_error', {'error': 'Too many requests. Please slow down.'})
        return

    user = _require_authenticated_user()
    if not user:
        return

    generation_id = data.get('generation_id')
    if not generation_id:
        emit('generation_error', {'error': 'Missing generation_id'})
        return

    if not _require_no_active_generation(user):
        return

    result = get_supabase().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', user.id).execute()

    if not result.data:
        emit('generation_error', {'error': 'Generation not found'})
        return

    original = Generation.from_row(result.data[0])

    style_ref_has_clean = False
    style_ref_has_text = False
    if original.use_style_image and original.style_reference_id:
        ref_result = get_supabase().table('style_references').select(
            'clean_image_path, text_layer_path'
        ).eq('id', original.style_reference_id).eq('user_id', user.id).execute()
        if ref_result.data:
            style_ref_has_clean = bool(ref_result.data[0].get('clean_image_path'))
            style_ref_has_text = bool(ref_result.data[0].get('text_layer_path'))

    user, validation = _validate_generation_credits(
        user=user,
        use_style_image=original.use_style_image,
        base_image_only=original.base_image_only,
        reference_mode=original.reference_mode or 'both',
        text_blending_mode='ai_blend',
        style_ref_has_clean=style_ref_has_clean,
        style_ref_has_text=style_ref_has_text,
        two_step_generation=original.two_step_generation,
        use_template=bool(original.cover_template_id),
    )
    if not validation:
        return

    new_gen_data = {
        'user_id': user.id,
        'book_title': original.book_title,
        'author_name': original.author_name,
        'cover_ideas': original.cover_ideas,
        'description': original.description,
        'genres': original.genres,
        'mood': original.mood,
        'aspect_ratio': original.aspect_ratio,
        'color_preference': original.color_preference,
        'character_description': original.character_description,
        'keywords': original.keywords,
        'style_reference_id': original.style_reference_id,
        'cover_template_id': original.cover_template_id,
        'use_style_image': original.use_style_image,
        'base_image_only': original.base_image_only,
        'reference_mode': original.reference_mode,
        'two_step_generation': original.two_step_generation,
        'status': 'generating',
    }

    insert_result = get_supabase().table('generations').insert(new_gen_data).execute()
    new_generation = Generation.from_row(insert_result.data[0])

    logger.info(
        "Gen #%s created for regeneration from #%s (user id=%s, estimated_cost=%d)",
        new_generation.id, generation_id, user.id, validation['total'],
    )

    _launch_generation(new_generation, user, validation)
