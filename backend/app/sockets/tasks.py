import logging

from app import socketio
from app.config import GENERATION_COST
from app.services.credit_service import refund_credits
from app.sockets.helpers import _room_for
from app.utils.db import get_supabase

logger = logging.getLogger(__name__)


def _run_generation_task(app, generation, user_id, style_analysis, style_reference_id, use_style_image, aspect_ratio, base_image_only=False):
    with app.app_context():
        gen_id = generation.id
        room = _room_for(user_id)

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

            if use_style_image and style_reference_id and style_analysis:
                final_gen = run_style_ref_pipeline(
                    gen_id, generation, book_data, style_analysis,
                    style_reference_id, aspect_ratio, user_id,
                    on_progress=on_progress,
                    base_image_only=base_image_only,
                )
            else:
                final_gen = run_standard_pipeline(
                    gen_id, generation, book_data, style_analysis, aspect_ratio,
                    on_progress=on_progress,
                    base_image_only=base_image_only,
                )

            from app.services.storage_service import storage_service
            socketio.emit('generation_completed', {
                'generation_id': gen_id,
                'generation': storage_service.sign_generation_dict(final_gen.to_dict()),
            }, room=room)

            logger.info("Gen #%s background task completed successfully", gen_id)

        except Exception as e:
            from app.services.pipeline_service import GenerationCancelled
            if isinstance(e, GenerationCancelled):
                logger.info("Gen #%s was cancelled, background task stopping", gen_id)
                return

            logger.error("Gen #%s background task FAILED: %s", gen_id, e, exc_info=True)

            get_supabase().table('generations').update({
                'status': 'failed',
                'error_message': 'Generation failed. Please try again.',
            }).eq('id', gen_id).execute()

            from app.models.user import User
            user_result = get_supabase().table('users').select('*').eq('id', user_id).execute()
            if user_result.data:
                failed_user = User.from_row(user_result.data[0])
                remaining = refund_credits(failed_user, GENERATION_COST)
            else:
                remaining = None

            socketio.emit('generation_failed', {
                'generation_id': gen_id,
                'error': 'Generation failed. Please try again.',
                'remaining_credits': remaining,
            }, room=room)
