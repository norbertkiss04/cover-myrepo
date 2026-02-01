import base64
import logging
import math
from flask import Blueprint, request, jsonify, make_response

from app.models.generation import Generation, ASPECT_RATIOS
from app.models.style_reference import StyleReference
from app.routes.auth import token_required
from app.services.llm_service import llm_service
from app.services.storage_service import storage_service
from app.services.credit_service import (
    calculate_generation_cost,
    calculate_style_ref_upload_cost,
    validate_generation_credits,
    check_can_afford,
    InsufficientCreditsError,
)
from app.utils.db import get_supabase
from app.utils.validation import sanitize_text, MAX_SHORT_TEXT_LENGTH
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


@generate_bp.route('/estimate-cost', methods=['POST'])
@token_required
def estimate_generation_cost(current_user):
    data = request.get_json() or {}

    use_style_image = bool(data.get('use_style_image', False))
    base_image_only = bool(data.get('base_image_only', False))
    reference_mode = data.get('reference_mode', 'both')
    text_blending_mode = data.get('text_blending_mode', 'ai')
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
        "Cost estimate for user id=%s: total=%d, can_afford=%s",
        current_user.id, cost_info['total'], cost_info['can_afford'],
    )

    return jsonify(cost_info)


@generate_bp.route('/upload-style-reference', methods=['POST'])
@limiter.limit("10 per minute")
@token_required
def upload_style_reference(current_user):
    data = request.get_json()
    image_data_url = data.get('image')
    title = data.get('title')

    if not image_data_url:
        return jsonify({'error': 'Missing required field: image'}), 400

    if not image_data_url.startswith('data:image/'):
        return jsonify({'error': 'Image must be a base64 data URL (data:image/...)'}), 400

    if len(image_data_url) > MAX_IMAGE_BASE64_SIZE:
        return jsonify({'error': 'Image too large. Maximum size is 5MB.'}), 400

    upload_cost = calculate_style_ref_upload_cost()
    if not check_can_afford(current_user, upload_cost['total']):
        return jsonify({
            'error': f"Not enough credits. Style reference upload costs {upload_cost['total']} credits.",
            'required': upload_cost['total'],
            'available': current_user.credits,
        }), 402

    logger.info("Style reference upload from user id=%s (cost=%d)", current_user.id, upload_cost['total'])

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

        signed_url = storage_service.get_signed_url(image_path, expires_in=300)
        logger.info("Analyzing style reference image...")
        analysis = llm_service.analyze_style_reference(signed_url, user=current_user)
        logger.info("Style analysis complete: %s", analysis.get('suggested_title', ''))

        logger.info("Detecting text in style reference image...")
        detected_text = llm_service.detect_text_in_image(signed_url, user=current_user)
        logger.info("Text detection complete: found %d segments", len(detected_text))

        all_text_ids = [t['id'] for t in detected_text]

        if title:
            sanitized_title = sanitize_text(title, max_length=MAX_SHORT_TEXT_LENGTH)
        else:
            sanitized_title = analysis.get('suggested_title', 'Untitled Reference')

        ref_data = {
            'user_id': current_user.id,
            'image_url': image_url,
            'image_path': image_path,
            'title': sanitized_title,
            'feeling': analysis.get('feeling', ''),
            'layout': analysis.get('layout', ''),
            'illustration_rules': analysis.get('illustration_rules', ''),
            'typography': analysis.get('typography', ''),
            'detected_text': detected_text,
            'selected_text_ids': all_text_ids,
        }

        result = get_supabase().table('style_references').insert(ref_data).execute()
        style_ref = StyleReference.from_row(result.data[0])
        logger.info("Style reference #%s saved", style_ref.id)

        response_data = storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref)
        return jsonify(response_data), 201

    except Exception as e:
        logger.error("Style reference upload failed: %s", e, exc_info=True)
        return jsonify({'error': 'Upload failed. Please try again.'}), 500

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

    updates = {}
    if 'title' in data:
        updates['title'] = sanitize_text(data['title'], max_length=MAX_SHORT_TEXT_LENGTH)

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


@generate_bp.route('/style-references/<int:ref_id>/text-selection', methods=['PUT'])
@token_required
def update_text_selection(current_user, ref_id):
    logger.info(
        "Update text selection for style reference #%d from user id=%s",
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

    style_ref = StyleReference.from_row(result.data[0])

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    selected_text_ids = data.get('selected_text_ids')
    if selected_text_ids is None:
        return jsonify({'error': 'selected_text_ids is required'}), 400

    if not isinstance(selected_text_ids, list):
        return jsonify({'error': 'selected_text_ids must be an array'}), 400

    valid_ids = {t['id'] for t in (style_ref.detected_text or [])}
    invalid_ids = [tid for tid in selected_text_ids if tid not in valid_ids]
    if invalid_ids:
        return jsonify({'error': f'Invalid text IDs: {invalid_ids}'}), 400

    if style_ref.text_layer_path:
        logger.info("Clearing cached text layer for ref #%d due to selection change", ref_id)
        storage_service.delete_file_by_path(style_ref.text_layer_path)

    updated = get_supabase().table('style_references').update({
        'selected_text_ids': selected_text_ids,
        'text_layer_path': None,
    }).eq('id', ref_id).eq('user_id', current_user.id).execute()

    style_ref = StyleReference.from_row(updated.data[0])
    logger.info("Text selection updated for ref #%d: %d texts selected", ref_id, len(selected_text_ids))

    return jsonify(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))


@generate_bp.route('/style-references/<int:ref_id>/detect-text', methods=['POST'])
@token_required
def redetect_text(current_user, ref_id):
    logger.info(
        "Re-detecting text for style reference #%d from user id=%s",
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

    style_ref = StyleReference.from_row(result.data[0])

    signed_url = storage_service.get_signed_url(style_ref.image_path, expires_in=300)
    logger.info("Running text detection on ref #%d...", ref_id)
    detected_text = llm_service.detect_text_in_image(signed_url)
    logger.info("Text detection complete: found %d segments", len(detected_text))

    all_text_ids = [t['id'] for t in detected_text]

    update_data = {
        'detected_text': detected_text,
        'selected_text_ids': all_text_ids,
    }

    if style_ref.text_layer_path:
        logger.info("Clearing cached text layer for ref #%d", ref_id)
        storage_service.delete_file_by_path(style_ref.text_layer_path)
        update_data['text_layer_path'] = None
        update_data['text_layer_cleaned'] = False

    updated = get_supabase().table('style_references').update(
        update_data
    ).eq('id', ref_id).eq('user_id', current_user.id).execute()

    style_ref = StyleReference.from_row(updated.data[0])
    return jsonify(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))


@generate_bp.route('/style-references/<int:ref_id>/crop', methods=['POST'])
@token_required
def crop_image(current_user, ref_id):
    from app.services.image_service import image_service

    logger.info(
        "Cropping image for style reference #%d from user id=%s",
        ref_id, current_user.id,
    )

    data = request.get_json()
    if not data or 'crop' not in data:
        return jsonify({'error': 'Missing crop data'}), 400

    crop = data['crop']
    required_fields = ['x', 'y', 'width', 'height']
    for field in required_fields:
        if field not in crop:
            return jsonify({'error': f'Missing crop field: {field}'}), 400
        if not isinstance(crop[field], (int, float)):
            return jsonify({'error': f'Invalid crop field type: {field}'}), 400

    if crop['width'] <= 0 or crop['height'] <= 0:
        return jsonify({'error': 'Crop dimensions must be positive'}), 400

    result = get_supabase().table('style_references').select('*').eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning(
            "Style reference #%d not found for user id=%s",
            ref_id, current_user.id,
        )
        return jsonify({'error': 'Style reference not found'}), 404

    style_ref = StyleReference.from_row(result.data[0])

    if not style_ref.original_image_path:
        logger.info("No original_image_path for ref #%d, saving current image as original", ref_id)
        get_supabase().table('style_references').update({
            'original_image_path': style_ref.image_path
        }).eq('id', ref_id).eq('user_id', current_user.id).execute()
        style_ref.original_image_path = style_ref.image_path

    signed_url = storage_service.get_signed_url(style_ref.original_image_path, expires_in=300)

    import requests as http_requests
    response = http_requests.get(signed_url, timeout=60)
    response.raise_for_status()
    image_bytes = response.content

    logger.info("Cropping ref #%d: x=%.1f%%, y=%.1f%%, w=%.1f%%, h=%.1f%%",
                ref_id, crop['x'], crop['y'], crop['width'], crop['height'])

    cropped_bytes = image_service.crop_image_by_percent(
        image_bytes,
        x=crop['x'],
        y=crop['y'],
        width=crop['width'],
        height=crop['height'],
    )

    upload_result = storage_service.upload_file(
        file_data=cropped_bytes,
        filename="reference.png",
        content_type="image/png",
        folder='references',
    )
    new_image_path = storage_service.extract_path(upload_result) or ''

    update_data = {
        'image_url': upload_result,
        'image_path': new_image_path,
    }

    if style_ref.clean_image_path:
        storage_service.delete_file_by_path(style_ref.clean_image_path)
        update_data['clean_image_path'] = None

    if style_ref.text_layer_path:
        storage_service.delete_file_by_path(style_ref.text_layer_path)
        update_data['text_layer_path'] = None
        update_data['text_layer_cleaned'] = False

    updated = get_supabase().table('style_references').update(
        update_data
    ).eq('id', ref_id).eq('user_id', current_user.id).execute()

    style_ref = StyleReference.from_row(updated.data[0])
    logger.info("Image cropped successfully for ref #%d", ref_id)
    return jsonify(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))


@generate_bp.route('/style-references/<int:ref_id>/regenerate-clean', methods=['POST'])
@token_required
def regenerate_clean_background(current_user, ref_id):
    from app.services.image_service import image_service

    logger.info(
        "Regenerating clean background for style reference #%d from user id=%s",
        ref_id, current_user.id,
    )

    result = get_supabase().table('style_references').select('*').eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        return jsonify({'error': 'Style reference not found'}), 404

    style_ref = StyleReference.from_row(result.data[0])

    if style_ref.clean_image_path:
        storage_service.delete_file_by_path(style_ref.clean_image_path)

    signed_url = storage_service.get_signed_url(style_ref.image_path, expires_in=600)
    logger.info("Generating clean background for ref #%d...", ref_id)

    try:
        result_img = image_service.generate_clean_background(signed_url)
        variant_url = result_img['image_url']

        upload = storage_service.upload_from_url(variant_url, folder='references')

        updated = get_supabase().table('style_references').update({
            'clean_image_path': upload['path']
        }).eq('id', ref_id).eq('user_id', current_user.id).execute()

        style_ref = StyleReference.from_row(updated.data[0])
        logger.info("Clean background regenerated for ref #%d", ref_id)
        return jsonify(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))

    except Exception as e:
        logger.error("Failed to regenerate clean background: %s", e, exc_info=True)
        return jsonify({'error': 'Failed to generate clean background. Please try again.'}), 500


@generate_bp.route('/style-references/<int:ref_id>/regenerate-text-layer', methods=['POST'])
@token_required
def regenerate_text_layer(current_user, ref_id):
    from app.services.image_service import image_service

    logger.info(
        "Regenerating text layer for style reference #%d from user id=%s",
        ref_id, current_user.id,
    )

    result = get_supabase().table('style_references').select('*').eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        return jsonify({'error': 'Style reference not found'}), 404

    style_ref = StyleReference.from_row(result.data[0])

    if style_ref.text_layer_path:
        storage_service.delete_file_by_path(style_ref.text_layer_path)

    signed_url = storage_service.get_signed_url(style_ref.image_path, expires_in=600)

    selected_texts = None
    if style_ref.detected_text and style_ref.selected_text_ids:
        selected_ids = set(style_ref.selected_text_ids)
        selected_texts = [t for t in style_ref.detected_text if t.get('id') in selected_ids]

    logger.info("Generating text layer for ref #%d...", ref_id)

    try:
        result_img = image_service.generate_text_layer(signed_url, selected_texts=selected_texts)
        variant_url = result_img['image_url']

        text_layer_cleaned = False
        verification = llm_service.verify_text_layer(variant_url)
        if not verification.get('is_clean', True) and verification.get('artifacts'):
            artifacts = verification['artifacts']
            artifacts_desc = ', '.join([f"{a['description']} ({a['location']})" for a in artifacts])
            logger.info("Text layer has %d artifacts, cleaning up...", len(artifacts))

            cleanup_result = image_service.cleanup_text_layer(variant_url, artifacts_desc)
            variant_url = cleanup_result['image_url']
            text_layer_cleaned = True

        upload = storage_service.upload_from_url(variant_url, folder='references')

        updated = get_supabase().table('style_references').update({
            'text_layer_path': upload['path'],
            'text_layer_cleaned': text_layer_cleaned,
            'text_layer_selected_texts': selected_texts,
        }).eq('id', ref_id).eq('user_id', current_user.id).execute()

        style_ref = StyleReference.from_row(updated.data[0])
        logger.info("Text layer regenerated for ref #%d (cleaned=%s)", ref_id, text_layer_cleaned)
        return jsonify(storage_service.sign_style_ref_dict(style_ref.to_dict(), style_ref))

    except Exception as e:
        logger.error("Failed to regenerate text layer: %s", e, exc_info=True)
        return jsonify({'error': 'Failed to generate text layer. Please try again.'}), 500


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
