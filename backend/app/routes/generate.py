import base64
import logging
import math
import requests as http_requests
from flask import Blueprint, request, jsonify, make_response

from app.models.generation import Generation, ASPECT_RATIOS
from app.models.style_reference import StyleReference
from app.routes.auth import token_required
from app.services.llm_service import llm_service
from app.services.image_service import image_service, get_contrasting_background, remove_background_color
from app.services.storage_service import storage_service
from app.services.credit_service import deduct_credits
from app.config import ANALYSIS_COST
from app.utils.db import get_supabase
from app.utils.validation import sanitize_text, MAX_SHORT_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH
from app import limiter

logger = logging.getLogger(__name__)

generate_bp = Blueprint('generate', __name__)

MAX_IMAGE_BASE64_SIZE = 7 * 1024 * 1024

AVAILABLE_GENRES = [
    'Fantasy',
    'Romance',
    'Thriller',
    'Mystery',
    'Science Fiction',
    'Horror',
    'Literary Fiction',
    'Historical Fiction',
    'Young Adult',
    'Children\'s',
    'Non-Fiction',
    'Biography',
    'Self-Help',
    'Business',
    'Poetry'
]


@generate_bp.route('/genres', methods=['GET'])
def get_genres():
    response = make_response(jsonify({'genres': AVAILABLE_GENRES}))
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response

@generate_bp.route('/aspect-ratios', methods=['GET'])
def get_aspect_ratios():
    response = make_response(jsonify({'aspect_ratios': ASPECT_RATIOS}))
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response

@generate_bp.route('/analyze-style', methods=['POST'])
@limiter.limit("5 per minute")
@token_required
def analyze_style(current_user):
    data = request.get_json()
    image_data_url = data.get('image')

    if not image_data_url:
        return jsonify({'error': 'Missing required field: image'}), 400

    if not image_data_url.startswith('data:image/'):
        return jsonify({'error': 'Image must be a base64 data URL (data:image/...)'}), 400

    if len(image_data_url) > MAX_IMAGE_BASE64_SIZE:
        return jsonify({'error': 'Image too large. Maximum size is 5MB.'}), 400

    credit_result = deduct_credits(current_user, ANALYSIS_COST)
    if not credit_result['success']:
        return jsonify({
            'error': 'Not enough credits to analyze a style reference.',
        }), 403

    logger.info("Style analysis request from user id=%s", current_user.id)

    try:
        header, b64_data = image_data_url.split(',', 1)
        content_type = header.split(':')[1].split(';')[0]
        ext = content_type.split('/')[-1]
        if ext == 'jpeg':
            ext = 'jpg'

        image_bytes = base64.b64decode(b64_data)
        logger.info("Decoded image: %.1f KB (%s)", len(image_bytes) / 1024, content_type)

        upload_result = storage_service.upload_file(
            file_data=image_bytes,
            filename=f"reference.{ext}",
            content_type=content_type,
            folder='references',
        )
        image_url = upload_result
        image_path = storage_service.extract_path(image_url) or ''

        logger.info("Reference image uploaded: %s", image_path)

        clean_image_url = None
        clean_image_path = None
        try:
            logger.info("Creating clean version (removing text)...")
            clean_result = image_service.remove_text_from_image(image_data_url)
            clean_upload = storage_service.upload_from_url(
                clean_result['image_url'],
                folder='references-clean'
            )
            clean_image_url = clean_upload['public_url']
            clean_image_path = clean_upload['path']
            logger.info("Clean reference created: %s", clean_image_path)
        except Exception as e:
            logger.warning("Text removal failed: %s", e)

        text_layer_url = None
        text_layer_path = None
        try:
            logger.info("Creating text layer...")
            clean_signed_url = storage_service.get_signed_url(clean_image_path, expires_in=600)
            clean_response = http_requests.get(clean_signed_url, timeout=60)
            clean_response.raise_for_status()
            clean_bytes = clean_response.content

            bg_color = get_contrasting_background(clean_bytes)
            logger.info("Using contrasting background: %s", bg_color)

            text_layer_result = image_service.isolate_text_layer(image_data_url, bg_color)
            text_layer_upload = storage_service.upload_from_url(
                text_layer_result['image_url'],
                folder='references-text'
            )
            text_layer_url = text_layer_upload['public_url']
            text_layer_path = text_layer_upload['path']
            logger.info("Initial text layer created: %s", text_layer_path)

            try:
                logger.info("Analyzing text layer for cleanup...")
                signed_text_layer_url = storage_service.get_signed_url(text_layer_path, expires_in=600)
                text_layer_response = http_requests.get(signed_text_layer_url, timeout=60)
                text_layer_response.raise_for_status()
                text_layer_b64 = base64.b64encode(text_layer_response.content).decode()
                text_layer_data_url = f"data:image/png;base64,{text_layer_b64}"

                cleanup_analysis = llm_service.analyze_text_layer(text_layer_data_url)

                if cleanup_analysis.get('needs_cleanup') and cleanup_analysis.get('removal_prompt'):
                    logger.info("Text layer needs cleanup, running cleanup phase...")
                    cleanup_result = image_service.cleanup_text_layer(
                        text_layer_data_url,
                        cleanup_analysis['removal_prompt'],
                        bg_color
                    )
                    cleanup_upload = storage_service.upload_from_url(
                        cleanup_result['image_url'],
                        folder='references-text'
                    )
                    text_layer_url = cleanup_upload['public_url']
                    text_layer_path = cleanup_upload['path']
                    logger.info("Cleaned text layer saved: %s", text_layer_path)
                else:
                    logger.info("Text layer is clean, no cleanup needed")
            except Exception as cleanup_error:
                logger.warning("Text layer cleanup failed, using initial version: %s", cleanup_error)

            try:
                logger.info("Converting text layer to transparent background...")
                signed_url = storage_service.get_signed_url(text_layer_path, expires_in=600)
                response = http_requests.get(signed_url, timeout=60)
                response.raise_for_status()

                transparent_bytes = remove_background_color(response.content, bg_color)
                transparent_upload = storage_service.upload_bytes(
                    transparent_bytes,
                    folder='references-text',
                    content_type='image/png'
                )
                text_layer_url = transparent_upload['public_url']
                text_layer_path = transparent_upload['path']
                logger.info("Transparent text layer saved: %s", text_layer_path)
            except Exception as transparent_error:
                logger.warning("Transparent conversion failed, using previous version: %s", transparent_error)

        except Exception as e:
            logger.warning("Text layer creation failed, continuing without it: %s", e)

        logger.info("Calling Gemini vision for style analysis...")
        analysis = llm_service.analyze_style_reference(image_data_url)
        logger.info("Style analysis complete")

        user_title = sanitize_text(data.get('title'), max_length=MAX_SHORT_TEXT_LENGTH)
        ref_data = {
            'user_id': current_user.id,
            'image_url': image_url,
            'image_path': image_path,
            'clean_image_url': clean_image_url,
            'clean_image_path': clean_image_path,
            'text_layer_url': text_layer_url,
            'text_layer_path': text_layer_path,
            'title': user_title or analysis.get('title') or 'Untitled Reference',
            'feeling': analysis.get('feeling', ''),
            'layout': analysis.get('layout', ''),
            'illustration_rules': analysis.get('illustration_rules', ''),
            'typography': analysis.get('typography', ''),
        }

        result = get_supabase().table('style_references').insert(ref_data).execute()
        style_ref = StyleReference.from_row(result.data[0])
        logger.info("Style reference #%s saved", style_ref.id)

        response_data = storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref)
        response_data['remaining_credits'] = credit_result['remaining']
        return jsonify(response_data), 201

    except Exception as e:
        logger.error("Style analysis failed: %s", e, exc_info=True)
        from app.services.credit_service import refund_credits
        refund_credits(current_user, ANALYSIS_COST)
        return jsonify({'error': 'Style analysis failed. Please try again.'}), 500

@generate_bp.route('/style-references', methods=['GET'])
@token_required
def get_style_references(current_user):
    logger.info("Listing style references for user id=%s", current_user.id)

    result = get_supabase().table('style_references').select('*').eq(
        'user_id', current_user.id
    ).order('created_at', desc=True).execute()

    refs = []
    for row in result.data:
        style_ref = StyleReference.from_row(row)
        refs.append(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))
    logger.info("Returning %d style references", len(refs))

    return jsonify({'style_references': refs})

@generate_bp.route('/style-references/<int:ref_id>', methods=['DELETE'])
@token_required
def delete_style_reference(current_user, ref_id):
    logger.info("Delete request for style reference #%d from user id=%s", ref_id, current_user.id)

    result = get_supabase().table('style_references').select('*').eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Style reference #%d not found for user id=%s", ref_id, current_user.id)
        return jsonify({'error': 'Style reference not found'}), 404

    ref = StyleReference.from_row(result.data[0])

    if ref.image_url:
        logger.info("Deleting reference image from storage: %s", ref.image_path)
        storage_service.delete_file(ref.image_url)

    get_supabase().table('style_references').delete().eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    logger.info("Style reference #%d deleted", ref_id)
    return jsonify({'message': 'Style reference deleted successfully'})

@generate_bp.route('/style-references/<int:ref_id>', methods=['PUT'])
@token_required
def update_style_reference(current_user, ref_id):
    logger.info(
        "Update request for style reference #%d from user id=%s",
        ref_id, current_user.id,
    )

    result = get_supabase().table('style_references').select('*').eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning(
            "Style reference #%d not found for user id=%s",
            ref_id, current_user.id,
        )
        return jsonify({'error': 'Style reference not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    allowed = {'title', 'feeling', 'layout', 'illustration_rules', 'typography'}
    updates = {}
    for k, v in data.items():
        if k in allowed:
            max_len = MAX_LONG_TEXT_LENGTH if k in ('illustration_rules', 'layout') else MAX_SHORT_TEXT_LENGTH
            updates[k] = sanitize_text(v, max_length=max_len)

    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400

    logger.info(
        "Updating style reference #%d fields: %s",
        ref_id, list(updates.keys()),
    )

    updated = get_supabase().table('style_references').update(updates).eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    style_ref = StyleReference.from_row(updated.data[0])
    logger.info("Style reference #%d updated", ref_id)

    return jsonify(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))


@generate_bp.route('/generations', methods=['GET'])
@token_required
def get_generations(current_user):
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    logger.info(
        "Listing generations for user id=%s (page=%d, per_page=%d)",
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
        "Returning %d generations (total=%d, pages=%d)",
        len(generations), total, pages,
    )

    return jsonify({
        'generations': generations,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': pages
    })

@generate_bp.route('/generations/<int:generation_id>', methods=['GET'])
@token_required
def get_generation(current_user, generation_id):
    logger.info("Fetching generation #%d for user id=%s", generation_id, current_user.id)
    result = get_supabase().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Generation #%d not found for user id=%s", generation_id, current_user.id)
        return jsonify({'error': 'Generation not found'}), 404

    generation = Generation.from_row(result.data[0])
    return jsonify(storage_service.sign_generation_dict(generation.to_dict()))

@generate_bp.route('/generations/<int:generation_id>', methods=['DELETE'])
@token_required
def delete_generation(current_user, generation_id):
    logger.info("Delete request for gen #%d from user id=%s", generation_id, current_user.id)
    result = get_supabase().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Generation #%d not found for deletion", generation_id)
        return jsonify({'error': 'Generation not found'}), 404

    generation = Generation.from_row(result.data[0])

    if generation.base_image_url:
        logger.info("Gen #%d: deleting base image from storage", generation_id)
        storage_service.delete_file(generation.base_image_url)
    if generation.final_image_url:
        logger.info("Gen #%d: deleting final image from storage", generation_id)
        storage_service.delete_file(generation.final_image_url)

    get_supabase().table('generations').delete().eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    logger.info("Gen #%d deleted successfully", generation_id)
    return jsonify({'message': 'Generation deleted successfully'})
