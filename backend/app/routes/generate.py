import base64
import logging
import math
import requests as http_requests
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app

from app.models.generation import Generation, ASPECT_RATIOS
from app.models.style_reference import StyleReference
from app.routes.auth import token_required
from app.services.llm_service import llm_service
from app.services.image_service import image_service
from app.services.storage_service import storage_service
from app.services.credit_service import deduct_credits
from app.config import ANALYSIS_COST

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

def _sb():
    return current_app.supabase

@generate_bp.route('/genres', methods=['GET'])
def get_genres():
    return jsonify({'genres': AVAILABLE_GENRES})

@generate_bp.route('/aspect-ratios', methods=['GET'])
def get_aspect_ratios():
    return jsonify({'aspect_ratios': ASPECT_RATIOS})

@generate_bp.route('/analyze-style', methods=['POST'])
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
            'error': f'Insufficient credits. You need {ANALYSIS_COST} credit to analyze a style reference.',
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
        bucket = current_app.config['SUPABASE_STORAGE_BUCKET']
        marker = f"/public/{bucket}/"
        image_path = image_url.split(marker)[-1] if marker in image_url else ''

        logger.info("Reference image uploaded: %s", image_path)

        logger.info("Calling Gemini vision for style analysis...")
        analysis = llm_service.analyze_style_reference(image_data_url)
        logger.info("Style analysis complete")

        ref_data = {
            'user_id': current_user.id,
            'image_url': image_url,
            'image_path': image_path,
            'title': data.get('title', 'Untitled Reference'),
            'feeling': analysis.get('feeling', ''),
            'layout': analysis.get('layout', ''),
            'illustration_rules': analysis.get('illustration_rules', ''),
            'typography': analysis.get('typography', ''),
        }

        result = _sb().table('style_references').insert(ref_data).execute()
        style_ref = StyleReference.from_row(result.data[0])
        logger.info("Style reference #%s saved", style_ref.id)

        response_data = style_ref.to_dict()
        response_data['remaining_credits'] = credit_result['remaining']
        return jsonify(response_data), 201

    except Exception as e:
        logger.error("Style analysis failed: %s", e, exc_info=True)
        from app.services.credit_service import refund_credits
        refund_credits(current_user, ANALYSIS_COST)
        return jsonify({'error': 'Style analysis failed', 'details': str(e)}), 500

@generate_bp.route('/style-references', methods=['GET'])
@token_required
def get_style_references(current_user):
    logger.info("Listing style references for user id=%s", current_user.id)

    result = _sb().table('style_references').select('*').eq(
        'user_id', current_user.id
    ).order('created_at', desc=True).execute()

    refs = [StyleReference.from_row(row).to_dict() for row in result.data]
    logger.info("Returning %d style references", len(refs))

    return jsonify({'style_references': refs})

@generate_bp.route('/style-references/<int:ref_id>', methods=['DELETE'])
@token_required
def delete_style_reference(current_user, ref_id):
    logger.info("Delete request for style reference #%d from user id=%s", ref_id, current_user.id)

    result = _sb().table('style_references').select('*').eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Style reference #%d not found for user id=%s", ref_id, current_user.id)
        return jsonify({'error': 'Style reference not found'}), 404

    ref = StyleReference.from_row(result.data[0])

    if ref.image_url:
        logger.info("Deleting reference image from storage: %s", ref.image_path)
        storage_service.delete_file(ref.image_url)

    _sb().table('style_references').delete().eq(
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

    result = _sb().table('style_references').select('*').eq(
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
    updates = {k: v for k, v in data.items() if k in allowed}

    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400

    logger.info(
        "Updating style reference #%d fields: %s",
        ref_id, list(updates.keys()),
    )

    updated = _sb().table('style_references').update(updates).eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    style_ref = StyleReference.from_row(updated.data[0])
    logger.info("Style reference #%d updated", ref_id)

    return jsonify(style_ref.to_dict())


def run_standard_pipeline(gen_id, generation, book_data, style_analysis, aspect_ratio, on_progress=None, base_image_only=False):
    total_steps = 2 if base_image_only else 4

    def progress(step, total, message):
        if on_progress:
            on_progress(step, total, message)

    progress(1, total_steps, "Generating image prompt...")
    base_prompt = llm_service.generate_base_image_prompt(
        book_data, style_analysis=style_analysis, base_image_only=base_image_only
    )
    if base_image_only:
        base_prompt += " Do not include any text, words, letters, titles, or typography anywhere in the image."
    logger.info("Gen #%s Step 1/%d done. Prompt length: %d chars", gen_id, total_steps, len(base_prompt))
    _sb().table('generations').update(
        {'base_prompt': base_prompt}
    ).eq('id', generation.id).execute()

    progress(2, total_steps, "Creating base image...")
    base_result = image_service.generate_base_image(base_prompt, aspect_ratio)
    base_image_url = base_result['image_url']
    logger.info("Gen #%s Step 2/%d done. Base image URL received", gen_id, total_steps)

    base_upload = storage_service.upload_from_url(base_image_url, folder='base')
    storage_base_url = base_upload['public_url']
    base_storage_path = base_upload['path']
    _sb().table('generations').update(
        {'base_image_url': storage_base_url}
    ).eq('id', generation.id).execute()

    if base_image_only:
        now = datetime.now(timezone.utc).isoformat()
        update_result = _sb().table('generations').update({
            'final_image_url': storage_base_url,
            'status': 'completed',
            'completed_at': now,
        }).eq('id', generation.id).execute()
        final_gen = Generation.from_row(update_result.data[0])
        logger.info("Gen #%s COMPLETED successfully (base image only)", gen_id)
        return final_gen

    progress(3, total_steps, "Designing typography...")
    text_prompt = llm_service.generate_text_overlay_prompt(
        book_data, style_analysis=style_analysis
    )
    logger.info("Gen #%s Step 3/4 done. Prompt length: %d chars", gen_id, len(text_prompt))
    _sb().table('generations').update(
        {'text_prompt': text_prompt}
    ).eq('id', generation.id).execute()

    progress(4, total_steps, "Adding text to cover...")
    signed_base_url = storage_service.get_signed_url(base_storage_path, expires_in=600)
    final_prompt = f"{base_prompt}\n\nText overlay: {text_prompt}"
    final_result = image_service.generate_image_with_text(
        signed_base_url,
        final_prompt,
        aspect_ratio
    )
    final_image_url = final_result['image_url']

    final_upload = storage_service.upload_from_url(final_image_url, folder='covers')
    storage_final_url = final_upload['public_url']
    now = datetime.now(timezone.utc).isoformat()
    update_result = _sb().table('generations').update({
        'final_image_url': storage_final_url,
        'status': 'completed',
        'completed_at': now,
    }).eq('id', generation.id).execute()

    final_gen = Generation.from_row(update_result.data[0])
    logger.info("Gen #%s COMPLETED successfully", gen_id)
    return final_gen


def run_style_ref_pipeline(
    gen_id, generation, book_data, style_analysis,
    style_reference_id, aspect_ratio, user_id, on_progress=None,
    cover_style_image=False, base_image_only=False,
):
    def progress(step, total_steps, message):
        if on_progress:
            on_progress(step, total_steps, message)

    ref_result = _sb().table('style_references').select('*').eq(
        'id', style_reference_id
    ).eq('user_id', user_id).execute()

    if not ref_result.data:
        raise ValueError(f"Style reference #{style_reference_id} not found")

    style_ref = StyleReference.from_row(ref_result.data[0])

    progress(1, 3, "Generating image prompt...")
    if base_image_only:
        unified_prompt = llm_service.generate_style_referenced_prompt_no_text(
            book_data, style_analysis
        )
    else:
        unified_prompt = llm_service.generate_style_referenced_prompt(
            book_data, style_analysis
        )
    unified_prompt += " The image must fill the entire canvas edge-to-edge with absolutely no white borders, margins, or empty space."
    logger.info("Gen #%s Step 1/3 done. Prompt length: %d chars", gen_id, len(unified_prompt))
    _sb().table('generations').update(
        {'base_prompt': unified_prompt}
    ).eq('id', generation.id).execute()

    progress(2, 3, "Preparing style reference...")
    signed_ref_url = storage_service.get_signed_url(style_ref.image_path, expires_in=600)
    ref_response = http_requests.get(signed_ref_url, timeout=60)
    ref_response.raise_for_status()

    composite_bytes = image_service.compose_reference_on_canvas(
        ref_response.content, aspect_ratio, cover=cover_style_image
    )
    composite_upload = storage_service.upload_file(
        file_data=composite_bytes,
        filename='composite.jpg',
        content_type='image/jpeg',
        folder='composites',
    )
    composite_path = composite_upload.split('/public/')[-1].split('/', 1)[-1]
    signed_composite_url = storage_service.get_signed_url(composite_path, expires_in=600)

    progress(3, 3, "Generating final cover...")
    final_result = image_service.generate_image_with_text(
        signed_composite_url,
        unified_prompt,
        aspect_ratio,
    )
    final_image_url = final_result['image_url']

    final_upload = storage_service.upload_from_url(final_image_url, folder='covers')
    storage_final_url = final_upload['public_url']
    now = datetime.now(timezone.utc).isoformat()
    update_result = _sb().table('generations').update({
        'final_image_url': storage_final_url,
        'status': 'completed',
        'completed_at': now,
    }).eq('id', generation.id).execute()

    final_gen = Generation.from_row(update_result.data[0])
    logger.info("Gen #%s COMPLETED successfully (style-referenced)", gen_id)
    return final_gen


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

    count_result = _sb().table('generations').select(
        '*', count='exact'
    ).eq('user_id', current_user.id).eq('status', 'completed').execute()
    total = count_result.count or 0

    result = _sb().table('generations').select('*').eq(
        'user_id', current_user.id
    ).eq('status', 'completed').order('created_at', desc=True).range(
        offset, offset + per_page - 1
    ).execute()

    generations = [Generation.from_row(row).to_dict() for row in result.data]

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
    result = _sb().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Generation #%d not found for user id=%s", generation_id, current_user.id)
        return jsonify({'error': 'Generation not found'}), 404

    generation = Generation.from_row(result.data[0])
    return jsonify(generation.to_dict())

@generate_bp.route('/generations/<int:generation_id>', methods=['DELETE'])
@token_required
def delete_generation(current_user, generation_id):
    logger.info("Delete request for gen #%d from user id=%s", generation_id, current_user.id)
    result = _sb().table('generations').select('*').eq(
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

    _sb().table('generations').delete().eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    logger.info("Gen #%d deleted successfully", generation_id)
    return jsonify({'message': 'Generation deleted successfully'})
