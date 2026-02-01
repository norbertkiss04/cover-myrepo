import logging

from app import socketio
from app.sockets.helpers import _room_for
from app.utils.db import get_supabase

logger = logging.getLogger(__name__)

_running_tasks = set()


def _run_generation_task(app, generation, user, style_reference_id, use_style_image, aspect_ratio, base_image_only=False, reference_mode='both', text_blending_mode='ai'):
    with app.app_context():
        gen_id = generation.id
        user_id = user.id
        room = _room_for(user_id)

        if gen_id in _running_tasks:
            logger.warning("Gen #%s task already running, aborting duplicate", gen_id)
            return

        status_check = get_supabase().table('generations').select('status').eq('id', gen_id).execute()
        if not status_check.data or status_check.data[0]['status'] != 'generating':
            logger.warning("Gen #%s not in 'generating' status, aborting task", gen_id)
            return

        _running_tasks.add(gen_id)

        def on_progress(step, total, message):
            get_supabase().table('generations').update({
                'current_step': step,
                'total_steps': total,
                'step_message': message,
            }).eq('id', gen_id).execute()
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
                'description': generation.description,
                'genres': generation.genres,
                'mood': generation.mood,
                'color_preference': generation.color_preference,
                'character_description': generation.character_description,
                'keywords': generation.keywords,
            }

            from app.services.pipeline_service import run_standard_pipeline, run_style_ref_pipeline

            if use_style_image and style_reference_id:
                final_gen = run_style_ref_pipeline(
                    gen_id, generation, book_data,
                    style_reference_id, aspect_ratio, user_id,
                    on_progress=on_progress,
                    base_image_only=base_image_only,
                    reference_mode=reference_mode,
                    two_step_generation=generation.two_step_generation,
                    text_blending_mode=text_blending_mode,
                    user=user,
                )
            else:
                final_gen = run_standard_pipeline(
                    gen_id, generation, book_data, aspect_ratio,
                    on_progress=on_progress,
                    base_image_only=base_image_only,
                    two_step_generation=generation.two_step_generation,
                    user=user,
                )

            from app.services.storage_service import storage_service
            socketio.emit('generation_completed', {
                'generation_id': gen_id,
                'generation': storage_service.sign_generation_dict(final_gen.to_dict()),
            }, room=room)

            logger.info("Gen #%s background task completed successfully", gen_id)

        except Exception as e:
            from app.services.pipeline_service import GenerationCancelled
            from app.services.credit_service import InsufficientCreditsError

            if isinstance(e, GenerationCancelled):
                logger.info("Gen #%s was cancelled, background task stopping", gen_id)
                return

            if isinstance(e, InsufficientCreditsError):
                logger.warning("Gen #%s failed due to insufficient credits: %s", gen_id, e)
                error_message = f"Insufficient credits: need {e.required}, have {e.available}"
            else:
                logger.error("Gen #%s background task FAILED: %s", gen_id, e, exc_info=True)
                error_message = 'Generation failed. Please try again.'

            get_supabase().table('generations').update({
                'status': 'failed',
                'error_message': error_message,
            }).eq('id', gen_id).execute()

            socketio.emit('generation_failed', {
                'generation_id': gen_id,
                'error': error_message,
            }, room=room)

        finally:
            _running_tasks.discard(gen_id)
