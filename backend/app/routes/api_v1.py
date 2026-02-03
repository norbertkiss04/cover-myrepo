import logging
import math
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, make_response

from app.models.generation import Generation, ASPECT_RATIOS
from app.models.style_reference import StyleReference
from app.routes.auth import api_token_required
from app.routes.generate import AVAILABLE_GENRES
from app.services.storage_service import storage_service
from app.services.credit_service import (
    validate_generation_credits,
    deduct_credits,
    refund_credits,
)
from app.services.pipeline_service import (
    run_standard_pipeline,
    run_style_ref_pipeline,
    GenerationCancelled,
    VALID_REFERENCE_MODES,
    VALID_BLENDING_MODES,
)
from app.utils.db import get_supabase
from app.utils.validation import sanitize_text, MAX_SHORT_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH
from app import limiter

logger = logging.getLogger(__name__)

api_v1_bp = Blueprint('api_v1', __name__)


@api_v1_bp.route('/me', methods=['GET'])
@api_token_required
def get_me(current_user):
    logger.info("API v1: User info request (user_id=%s)", current_user.id)
    return jsonify({
        'id': current_user.id,
        'email': current_user.email,
        'name': current_user.name,
        'credits': current_user.credits,
        'unlimited_credits': current_user.is_admin,
    })


@api_v1_bp.route('/styles', methods=['GET'])
@api_token_required
def get_styles(current_user):
    logger.info("API v1: Listing style references for user id=%s", current_user.id)

    result = get_supabase().table('style_references').select('*').eq(
        'user_id', current_user.id
    ).order('created_at', desc=True).execute()

    refs = []
    for row in result.data:
        style_ref = StyleReference.from_row(row)
        refs.append(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))

    logger.info("API v1: Returning %d style references", len(refs))
    return jsonify({'styles': refs})


@api_v1_bp.route('/styles/<int:style_id>', methods=['GET'])
@api_token_required
def get_style(current_user, style_id):
    logger.info("API v1: Fetching style reference #%d for user id=%s", style_id, current_user.id)

    result = get_supabase().table('style_references').select('*').eq(
        'id', style_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("API v1: Style reference #%d not found for user id=%s", style_id, current_user.id)
        return jsonify({'error': 'Style reference not found'}), 404

    style_ref = StyleReference.from_row(result.data[0])
    return jsonify(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))


@api_v1_bp.route('/settings', methods=['GET'])
@api_token_required
def get_settings(current_user):
    logger.info("API v1: Settings request for user id=%s", current_user.id)
    response = make_response(jsonify({
        'genres': AVAILABLE_GENRES,
        'aspect_ratios': ASPECT_RATIOS,
        'reference_modes': list(VALID_REFERENCE_MODES),
        'text_blending_modes': list(VALID_BLENDING_MODES),
    }))
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response


@api_v1_bp.route('/estimate', methods=['POST'])
@api_token_required
def estimate_cost(current_user):
    data = request.get_json() or {}

    use_style_image = bool(data.get('use_style_image', False))
    base_image_only = bool(data.get('base_image_only', False))
    reference_mode = data.get('reference_mode', 'both')
    text_blending_mode = data.get('text_blending_mode', 'ai_blend')
    two_step_generation = bool(data.get('two_step_generation', True))
    style_reference_id = data.get('style_reference_id')

    style_ref_has_clean = False
    style_ref_has_text = False

    if use_style_image and style_reference_id:
        result = get_supabase().table('style_references').select(
            'clean_image_path, text_layer_path'
        ).eq('id', style_reference_id).eq('user_id', current_user.id).execute()

        if result.data:
            style_ref_has_clean = bool(result.data[0].get('clean_image_path'))
            style_ref_has_text = bool(result.data[0].get('text_layer_path'))

    cost_info = validate_generation_credits(
        user=current_user,
        use_style_image=use_style_image,
        base_image_only=base_image_only,
        reference_mode=reference_mode,
        text_blending_mode=text_blending_mode,
        style_ref_has_clean=style_ref_has_clean,
        style_ref_has_text=style_ref_has_text,
        two_step_generation=two_step_generation,
    )

    logger.info(
        "API v1: Cost estimate for user id=%s: total=%d, can_afford=%s",
        current_user.id, cost_info['total'], cost_info['can_afford'],
    )

    return jsonify(cost_info)


@api_v1_bp.route('/generate', methods=['POST'])
@limiter.limit("10 per minute")
@api_token_required
def generate(current_user):
    data = request.get_json() or {}

    book_title = data.get('book_title')
    author_name = data.get('author_name')

    if not book_title or not author_name:
        return jsonify({'error': 'book_title and author_name are required'}), 400

    book_title = sanitize_text(book_title, max_length=MAX_SHORT_TEXT_LENGTH)
    author_name = sanitize_text(author_name, max_length=MAX_SHORT_TEXT_LENGTH)

    description = sanitize_text(data.get('description', ''), max_length=MAX_LONG_TEXT_LENGTH)
    genres = data.get('genres', [])
    if not isinstance(genres, list):
        genres = []
    genres = [g for g in genres if isinstance(g, str) and g in AVAILABLE_GENRES][:5]

    mood = sanitize_text(data.get('mood', ''), max_length=MAX_SHORT_TEXT_LENGTH)
    color_preference = sanitize_text(data.get('color_preference', ''), max_length=MAX_SHORT_TEXT_LENGTH)
    character_description = sanitize_text(data.get('character_description', ''), max_length=MAX_LONG_TEXT_LENGTH)

    keywords = data.get('keywords', [])
    if not isinstance(keywords, list):
        keywords = []
    keywords = [sanitize_text(k, max_length=50) for k in keywords if isinstance(k, str)][:10]

    cover_ideas = sanitize_text(data.get('cover_ideas', ''), max_length=MAX_LONG_TEXT_LENGTH)

    aspect_ratio = data.get('aspect_ratio', '2:3')
    if aspect_ratio not in ASPECT_RATIOS:
        aspect_ratio = '2:3'
    aspect_ratio_info = ASPECT_RATIOS[aspect_ratio]

    style_reference_id = data.get('style_reference_id')
    use_style_image = bool(data.get('use_style_image', False))
    base_image_only = bool(data.get('base_image_only', False))
    reference_mode = data.get('reference_mode', 'both')
    if reference_mode not in VALID_REFERENCE_MODES:
        reference_mode = 'both'
    two_step_generation = bool(data.get('two_step_generation', True))
    text_blending_mode = data.get('text_blending_mode', 'ai_blend')
    if text_blending_mode not in VALID_BLENDING_MODES:
        text_blending_mode = 'ai_blend'

    if use_style_image and style_reference_id:
        ref_check = get_supabase().table('style_references').select('id').eq(
            'id', style_reference_id
        ).eq('user_id', current_user.id).execute()
        if not ref_check.data:
            return jsonify({'error': 'Style reference not found'}), 404
    elif use_style_image:
        return jsonify({'error': 'style_reference_id is required when use_style_image is true'}), 400

    style_ref_has_clean = False
    style_ref_has_text = False
    if use_style_image and style_reference_id:
        ref_result = get_supabase().table('style_references').select(
            'clean_image_path, text_layer_path'
        ).eq('id', style_reference_id).eq('user_id', current_user.id).execute()
        if ref_result.data:
            style_ref_has_clean = bool(ref_result.data[0].get('clean_image_path'))
            style_ref_has_text = bool(ref_result.data[0].get('text_layer_path'))

    cost_info = validate_generation_credits(
        user=current_user,
        use_style_image=use_style_image,
        base_image_only=base_image_only,
        reference_mode=reference_mode,
        text_blending_mode=text_blending_mode,
        style_ref_has_clean=style_ref_has_clean,
        style_ref_has_text=style_ref_has_text,
        two_step_generation=two_step_generation,
    )

    if not cost_info['can_afford']:
        return jsonify({
            'error': 'Insufficient credits',
            'required': cost_info['total'],
            'available': current_user.credits,
        }), 402

    logger.info(
        "API v1: Starting generation for user id=%s (title=%s, cost=%d)",
        current_user.id, book_title, cost_info['total'],
    )

    deduct_credits(current_user, cost_info['total'])

    generation_data = {
        'user_id': current_user.id,
        'book_title': book_title,
        'author_name': author_name,
        'description': description,
        'genres': genres,
        'mood': mood,
        'color_preference': color_preference,
        'character_description': character_description,
        'keywords': keywords,
        'cover_ideas': cover_ideas,
        'aspect_ratio': aspect_ratio,
        'style_reference_id': style_reference_id if use_style_image else None,
        'use_style_image': use_style_image,
        'base_image_only': base_image_only,
        'reference_mode': reference_mode,
        'two_step_generation': two_step_generation,
        'status': 'generating',
    }

    try:
        insert_result = get_supabase().table('generations').insert(generation_data).execute()
        generation = Generation.from_row(insert_result.data[0])
        gen_id = generation.id
        logger.info("API v1: Generation #%s created", gen_id)
    except Exception as e:
        logger.error("API v1: Failed to create generation record: %s", e)
        refund_credits(current_user, cost_info['total'])
        return jsonify({'error': 'Failed to start generation'}), 500

    book_data = {
        'book_title': book_title,
        'author_name': author_name,
        'description': description,
        'genres': genres,
        'mood': mood,
        'color_preference': color_preference,
        'character_description': character_description,
        'keywords': keywords,
        'cover_ideas': cover_ideas,
    }

    try:
        if use_style_image and style_reference_id:
            final_gen = run_style_ref_pipeline(
                gen_id=gen_id,
                generation=generation,
                book_data=book_data,
                style_reference_id=style_reference_id,
                aspect_ratio=aspect_ratio_info,
                user_id=current_user.id,
                on_progress=None,
                base_image_only=base_image_only,
                reference_mode=reference_mode,
                two_step_generation=two_step_generation,
                text_blending_mode=text_blending_mode,
                user=current_user,
            )
        else:
            final_gen = run_standard_pipeline(
                gen_id=gen_id,
                generation=generation,
                book_data=book_data,
                aspect_ratio=aspect_ratio_info,
                on_progress=None,
                base_image_only=base_image_only,
                two_step_generation=two_step_generation,
                user=current_user,
            )

        logger.info("API v1: Generation #%s completed successfully", gen_id)
        return jsonify({
            'id': final_gen.id,
            'status': final_gen.status,
            'base_image_url': storage_service.get_signed_url(
                storage_service.extract_path(final_gen.base_image_url),
                expires_in=3600
            ) if final_gen.base_image_url else None,
            'final_image_url': storage_service.get_signed_url(
                storage_service.extract_path(final_gen.final_image_url),
                expires_in=3600
            ) if final_gen.final_image_url else None,
            'credits_used': cost_info['total'],
            'created_at': final_gen.created_at,
            'completed_at': final_gen.completed_at,
        })

    except GenerationCancelled:
        logger.warning("API v1: Generation #%s was cancelled", gen_id)
        get_supabase().table('generations').update({
            'status': 'failed',
            'error_message': 'Generation cancelled',
        }).eq('id', gen_id).execute()
        return jsonify({'error': 'Generation was cancelled'}), 400

    except Exception as e:
        logger.error("API v1: Generation #%s failed: %s", gen_id, e, exc_info=True)
        now = datetime.now(timezone.utc).isoformat()
        get_supabase().table('generations').update({
            'status': 'failed',
            'error_message': str(e)[:500],
            'completed_at': now,
        }).eq('id', gen_id).execute()
        return jsonify({'error': 'Generation failed', 'details': str(e)[:200]}), 500


@api_v1_bp.route('/generations', methods=['GET'])
@api_token_required
def get_generations(current_user):
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    logger.info(
        "API v1: Listing generations for user id=%s (page=%d, per_page=%d)",
        current_user.id, page, per_page,
    )

    count_result = get_supabase().table('generations').select(
        '*', count='exact'
    ).eq('user_id', current_user.id).eq('status', 'completed').execute()
    total = count_result.count or 0

    result = get_supabase().table('generations').select('*').eq(
        'user_id', current_user.id
    ).eq('status', 'completed').order('created_at', desc=True).range(
        offset, offset + per_page - 1
    ).execute()

    generations = [storage_service.sign_generation_dict(Generation.from_row(row).to_dict()) for row in result.data]

    pages = math.ceil(total / per_page) if per_page > 0 else 0

    logger.info(
        "API v1: Returning %d generations (total=%d, pages=%d)",
        len(generations), total, pages,
    )

    return jsonify({
        'generations': generations,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': pages,
    })


@api_v1_bp.route('/generations/<int:generation_id>', methods=['GET'])
@api_token_required
def get_generation(current_user, generation_id):
    logger.info("API v1: Fetching generation #%d for user id=%s", generation_id, current_user.id)

    result = get_supabase().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("API v1: Generation #%d not found for user id=%s", generation_id, current_user.id)
        return jsonify({'error': 'Generation not found'}), 404

    generation = Generation.from_row(result.data[0])
    return jsonify(storage_service.sign_generation_dict(generation.to_dict()))
