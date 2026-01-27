import logging
from datetime import datetime, timezone
from flask import request, current_app
from flask_socketio import emit, join_room, disconnect

from app import socketio
from app.models.generation import Generation, ASPECT_RATIOS
from app.routes.auth import get_user_from_token

logger = logging.getLogger(__name__)

connected_users = {}


def _sb():
    return current_app.supabase


def _get_user_from_sid(sid):
    return connected_users.get(sid)


def _room_for(user_id):
    return f'user_{user_id}'


STALE_TIMEOUT_MINUTES = 5


def _is_stale(generation):
    created = generation.created_at
    if isinstance(created, str):
        created = datetime.fromisoformat(created.replace('Z', '+00:00'))
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age_minutes = (datetime.now(timezone.utc) - created).total_seconds() / 60
    return age_minutes > STALE_TIMEOUT_MINUTES


def _fail_stale_generation(gen_id):
    _sb().table('generations').update({
        'status': 'failed',
        'error_message': 'Generation timed out',
    }).eq('id', gen_id).execute()


def _check_active_generation(user_id):
    result = _sb().table('generations').select('*').eq(
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


@socketio.on('connect')
def handle_connect(auth=None):
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get('token')
    if not token:
        token = request.args.get('token')

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
    sb = _sb()
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
        })


@socketio.on('disconnect')
def handle_disconnect():
    user = connected_users.pop(request.sid, None)
    if user:
        logger.info("Socket disconnected: user id=%s (sid=%s)", user.id, request.sid)
    else:
        logger.info("Socket disconnected: unknown (sid=%s)", request.sid)


@socketio.on('start_generation')
def handle_start_generation(data):
    user = _get_user_from_sid(request.sid)
    if not user:
        emit('generation_error', {'error': 'Not authenticated'})
        return

    active = _check_active_generation(user.id)
    if active:
        emit('generation_error', {
            'error': 'A cover is already being generated. Please wait for it to finish.',
            'generation_id': active.id,
        })
        return

    if not data.get('book_title') or not data.get('author_name'):
        emit('generation_error', {'error': 'Missing required fields: book_title, author_name'})
        return

    if data.get('genres') and not isinstance(data['genres'], list):
        emit('generation_error', {'error': 'genres must be an array'})
        return

    aspect_ratio = data.get('aspect_ratio', '2:3')
    if aspect_ratio not in ASPECT_RATIOS:
        emit('generation_error', {
            'error': f'Invalid aspect_ratio. Must be one of: {list(ASPECT_RATIOS.keys())}'
        })
        return

    style_analysis = data.get('style_analysis')
    style_reference_id = data.get('style_reference_id')
    use_style_image = bool(data.get('use_style_image', False))

    gen_data = {
        'user_id': user.id,
        'book_title': data['book_title'],
        'author_name': data['author_name'],
        'cover_ideas': data.get('cover_ideas', ''),
        'summary': data.get('summary', ''),
        'genres': data.get('genres', []),
        'mood': data.get('mood', ''),
        'aspect_ratio': aspect_ratio,
        'color_preference': data.get('color_preference'),
        'character_description': data.get('character_description'),
        'keywords': data.get('keywords'),
        'style_analysis': style_analysis,
        'style_reference_id': style_reference_id,
        'use_style_image': use_style_image,
        'status': 'generating',
    }

    result = _sb().table('generations').insert(gen_data).execute()
    generation = Generation.from_row(result.data[0])

    logger.info("Gen #%s created via socket (user id=%s, use_style_image=%s)", generation.id, user.id, use_style_image)

    emit('generation_started', {
        'generation_id': generation.id,
        'book_title': generation.book_title,
        'author_name': generation.author_name,
    }, room=_room_for(user.id))

    socketio.start_background_task(
        _run_generation_task,
        current_app._get_current_object(),
        generation,
        user.id,
        style_analysis,
        style_reference_id,
        use_style_image,
        aspect_ratio,
    )


@socketio.on('start_regeneration')
def handle_start_regeneration(data):
    user = _get_user_from_sid(request.sid)
    if not user:
        emit('generation_error', {'error': 'Not authenticated'})
        return

    generation_id = data.get('generation_id')
    if not generation_id:
        emit('generation_error', {'error': 'Missing generation_id'})
        return

    active = _check_active_generation(user.id)
    if active:
        emit('generation_error', {
            'error': 'A cover is already being generated. Please wait for it to finish.',
            'generation_id': active.id,
        })
        return

    result = _sb().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', user.id).execute()

    if not result.data:
        emit('generation_error', {'error': 'Generation not found'})
        return

    original = Generation.from_row(result.data[0])

    new_gen_data = {
        'user_id': user.id,
        'book_title': original.book_title,
        'author_name': original.author_name,
        'cover_ideas': original.cover_ideas,
        'summary': original.summary,
        'genres': original.genres,
        'mood': original.mood,
        'aspect_ratio': original.aspect_ratio,
        'color_preference': original.color_preference,
        'character_description': original.character_description,
        'keywords': original.keywords,
        'style_analysis': original.style_analysis,
        'style_reference_id': original.style_reference_id,
        'use_style_image': original.use_style_image,
        'status': 'generating',
    }

    insert_result = _sb().table('generations').insert(new_gen_data).execute()
    new_generation = Generation.from_row(insert_result.data[0])

    logger.info(
        "Gen #%s created for regeneration from #%s (user id=%s)",
        new_generation.id, generation_id, user.id,
    )

    emit('generation_started', {
        'generation_id': new_generation.id,
        'book_title': new_generation.book_title,
        'author_name': new_generation.author_name,
    }, room=_room_for(user.id))

    socketio.start_background_task(
        _run_generation_task,
        current_app._get_current_object(),
        new_generation,
        user.id,
        new_generation.style_analysis,
        new_generation.style_reference_id,
        new_generation.use_style_image,
        new_generation.aspect_ratio,
    )


def _run_generation_task(app, generation, user_id, style_analysis, style_reference_id, use_style_image, aspect_ratio):
    with app.app_context():
        gen_id = generation.id
        room = _room_for(user_id)

        def on_progress(step, total, message):
            socketio.emit('generation_progress', {
                'generation_id': gen_id,
                'step': step,
                'total_steps': total,
                'message': message,
            }, room=room)

        try:
            book_data = {
                'book_title': generation.book_title,
                'author_name': generation.author_name,
                'cover_ideas': generation.cover_ideas,
                'summary': generation.summary,
                'genres': generation.genres,
                'mood': generation.mood,
                'color_preference': generation.color_preference,
                'character_description': generation.character_description,
                'keywords': generation.keywords,
            }

            from app.routes.generate import run_standard_pipeline, run_style_ref_pipeline

            if use_style_image and style_reference_id and style_analysis:
                final_gen = run_style_ref_pipeline(
                    gen_id, generation, book_data, style_analysis,
                    style_reference_id, aspect_ratio, user_id,
                    on_progress=on_progress,
                )
            else:
                final_gen = run_standard_pipeline(
                    gen_id, generation, book_data, style_analysis, aspect_ratio,
                    on_progress=on_progress,
                )

            socketio.emit('generation_completed', {
                'generation_id': gen_id,
                'generation': final_gen.to_dict(),
            }, room=room)

            logger.info("Gen #%s background task completed successfully", gen_id)

        except Exception as e:
            logger.error("Gen #%s background task FAILED: %s", gen_id, e, exc_info=True)

            _sb().table('generations').update({
                'status': 'failed',
                'error_message': str(e),
            }).eq('id', gen_id).execute()

            socketio.emit('generation_failed', {
                'generation_id': gen_id,
                'error': str(e),
            }, room=room)
