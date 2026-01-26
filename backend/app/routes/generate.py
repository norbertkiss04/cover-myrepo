import base64
import logging
import math
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app

from app.models.generation import Generation, ASPECT_RATIOS
from app.models.style_reference import StyleReference
from app.routes.auth import token_required
from app.services.llm_service import llm_service
from app.services.image_service import image_service
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

generate_bp = Blueprint('generate', __name__)

# Max image size: 5MB of raw bytes (~6.7MB base64)
MAX_IMAGE_BASE64_SIZE = 7 * 1024 * 1024  # 7MB base64 limit

# Available genres for the dropdown
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

# Available moods
AVAILABLE_MOODS = [
    'Dark & Mysterious',
    'Light & Cheerful',
    'Epic & Grand',
    'Romantic & Soft',
    'Tense & Suspenseful',
    'Whimsical & Playful',
    'Elegant & Sophisticated',
    'Bold & Dynamic',
    'Serene & Peaceful',
    'Gritty & Raw'
]


def _sb():
    """Get the Supabase client from the current app."""
    return current_app.supabase


@generate_bp.route('/genres', methods=['GET'])
def get_genres():
    """Get available genres."""
    return jsonify({'genres': AVAILABLE_GENRES})


@generate_bp.route('/moods', methods=['GET'])
def get_moods():
    """Get available moods."""
    return jsonify({'moods': AVAILABLE_MOODS})


@generate_bp.route('/aspect-ratios', methods=['GET'])
def get_aspect_ratios():
    """Get available aspect ratios."""
    return jsonify({'aspect_ratios': ASPECT_RATIOS})


# ── Style Reference Endpoints ──


@generate_bp.route('/analyze-style', methods=['POST'])
@token_required
def analyze_style(current_user):
    """
    Upload a reference image and analyze its visual style via Gemini vision.

    Expected JSON body:
    {
        "image": "data:image/png;base64,..."
    }

    Returns the saved StyleReference with analysis results.
    """
    data = request.get_json()
    image_data_url = data.get('image')

    if not image_data_url:
        return jsonify({'error': 'Missing required field: image'}), 400

    # Validate it's a data URL
    if not image_data_url.startswith('data:image/'):
        return jsonify({'error': 'Image must be a base64 data URL (data:image/...)'}), 400

    # Validate size
    if len(image_data_url) > MAX_IMAGE_BASE64_SIZE:
        return jsonify({'error': 'Image too large. Maximum size is 5MB.'}), 400

    logger.info("Style analysis request from user id=%s", current_user.id)

    try:
        # Decode base64 to upload to storage
        # Format: data:image/png;base64,iVBOR...
        header, b64_data = image_data_url.split(',', 1)
        content_type = header.split(':')[1].split(';')[0]  # e.g. image/png
        ext = content_type.split('/')[-1]  # e.g. png
        if ext == 'jpeg':
            ext = 'jpg'

        image_bytes = base64.b64decode(b64_data)
        logger.info("Decoded image: %.1f KB (%s)", len(image_bytes) / 1024, content_type)

        # Upload to Supabase Storage
        upload_result = storage_service.upload_file(
            file_data=image_bytes,
            filename=f"reference.{ext}",
            content_type=content_type,
            folder='references',
        )
        # upload_file returns a public URL string
        image_url = upload_result
        # Extract storage path from public URL for potential deletion later
        bucket = current_app.config['SUPABASE_STORAGE_BUCKET']
        marker = f"/public/{bucket}/"
        image_path = image_url.split(marker)[-1] if marker in image_url else ''

        logger.info("Reference image uploaded: %s", image_path)

        # Analyze via Gemini vision
        logger.info("Calling Gemini vision for style analysis...")
        analysis = llm_service.analyze_style_reference(image_data_url)
        logger.info("Style analysis complete")

        # Save to database
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

        return jsonify(style_ref.to_dict()), 201

    except Exception as e:
        logger.error("Style analysis failed: %s", e, exc_info=True)
        return jsonify({'error': 'Style analysis failed', 'details': str(e)}), 500


@generate_bp.route('/style-references', methods=['GET'])
@token_required
def get_style_references(current_user):
    """Get all style references for the current user."""
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
    """Delete a style reference and its image from storage."""
    logger.info("Delete request for style reference #%d from user id=%s", ref_id, current_user.id)

    result = _sb().table('style_references').select('*').eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Style reference #%d not found for user id=%s", ref_id, current_user.id)
        return jsonify({'error': 'Style reference not found'}), 404

    ref = StyleReference.from_row(result.data[0])

    # Delete image from storage
    if ref.image_url:
        logger.info("Deleting reference image from storage: %s", ref.image_path)
        storage_service.delete_file(ref.image_url)

    # Delete DB record
    _sb().table('style_references').delete().eq(
        'id', ref_id
    ).eq('user_id', current_user.id).execute()

    logger.info("Style reference #%d deleted", ref_id)
    return jsonify({'message': 'Style reference deleted successfully'})


@generate_bp.route('/style-references/<int:ref_id>', methods=['PUT'])
@token_required
def update_style_reference(current_user, ref_id):
    """
    Update a style reference's title and/or analysis fields.

    Accepts JSON body with any of: title, feeling, layout,
    illustration_rules, typography.  Only provided fields are updated.
    """
    logger.info(
        "Update request for style reference #%d from user id=%s",
        ref_id, current_user.id,
    )

    # Verify ownership
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

    # Only allow updating these fields
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


# ── Generation Endpoints ──


@generate_bp.route('/generate', methods=['POST'])
@token_required
def create_generation(current_user):
    """
    Create a new book cover generation.

    Expected JSON body:
    {
        "book_title": "string (required)",
        "author_name": "string (required)",
        "summary": "string (optional)",
        "genres": ["array of strings (optional)"],
        "mood": "string (optional)",
        "aspect_ratio": "string (default: 2:3)",
        "color_preference": "string (optional)",
        "character_description": "string (optional)",
        "keywords": ["array (optional)"],
        "reference_image_description": "string (optional)",
        "style_analysis": {
            "feeling": "string",
            "layout": "string",
            "illustration_rules": "string",
            "typography": "string"
        }
    }
    """
    data = request.get_json()
    logger.info(
        "Generation request from user id=%s, title='%s'",
        current_user.id, data.get('book_title'),
    )

    # Validate required fields
    required_fields = ['book_title', 'author_name']
    for field in required_fields:
        if not data.get(field):
            logger.warning("Validation failed: missing field '%s'", field)
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Validate genres is a list if provided
    if data.get('genres') and not isinstance(data['genres'], list):
        logger.warning("Validation failed: genres must be an array")
        return jsonify({'error': 'genres must be an array'}), 400

    # Validate aspect ratio
    aspect_ratio = data.get('aspect_ratio', '2:3')
    if aspect_ratio not in ASPECT_RATIOS:
        logger.warning("Validation failed: invalid aspect_ratio '%s'", aspect_ratio)
        return jsonify({
            'error': f'Invalid aspect_ratio. Must be one of: {list(ASPECT_RATIOS.keys())}'
        }), 400

    # Extract style analysis if provided
    style_analysis = data.get('style_analysis')

    # Insert generation record
    gen_data = {
        'user_id': current_user.id,
        'book_title': data['book_title'],
        'author_name': data['author_name'],
        'summary': data.get('summary', ''),
        'genres': data.get('genres', []),
        'mood': data.get('mood', ''),
        'aspect_ratio': aspect_ratio,
        'color_preference': data.get('color_preference'),
        'character_description': data.get('character_description'),
        'keywords': data.get('keywords'),
        'reference_image_description': data.get('reference_image_description'),
        'style_analysis': style_analysis,
        'status': 'generating',
    }

    result = _sb().table('generations').insert(gen_data).execute()
    generation = Generation.from_row(result.data[0])
    gen_id = generation.id
    logger.info("Gen #%s created (status=generating)", gen_id)

    try:
        # Step 1: Generate base image prompt using LLM
        logger.info("Gen #%s Step 1/4: Generating base image prompt via LLM...", gen_id)
        book_data = {
            'book_title': generation.book_title,
            'author_name': generation.author_name,
            'summary': generation.summary,
            'genres': generation.genres,
            'mood': generation.mood,
            'color_preference': generation.color_preference,
            'character_description': generation.character_description,
            'keywords': generation.keywords,
            'reference_image_description': generation.reference_image_description
        }

        base_prompt = llm_service.generate_base_image_prompt(
            book_data, style_analysis=style_analysis
        )
        logger.info("Gen #%s Step 1/4 done. Prompt length: %d chars", gen_id, len(base_prompt))
        _sb().table('generations').update(
            {'base_prompt': base_prompt}
        ).eq('id', generation.id).execute()

        # Step 2: Generate base image (without text)
        logger.info("Gen #%s Step 2/4: Generating base image via WaveSpeed...", gen_id)
        base_result = image_service.generate_base_image(base_prompt, aspect_ratio)
        base_image_url = base_result['image_url']
        logger.info("Gen #%s Step 2/4 done. Base image URL received", gen_id)

        # Upload base image to Supabase Storage
        logger.info("Gen #%s Uploading base image to storage...", gen_id)
        base_upload = storage_service.upload_from_url(base_image_url, folder='base')
        storage_base_url = base_upload['public_url']
        base_storage_path = base_upload['path']
        _sb().table('generations').update(
            {'base_image_url': storage_base_url}
        ).eq('id', generation.id).execute()
        logger.info("Gen #%s Base image stored", gen_id)

        # Step 3: Generate text overlay prompt
        logger.info("Gen #%s Step 3/4: Generating text overlay prompt via LLM...", gen_id)
        text_prompt = llm_service.generate_text_overlay_prompt(
            book_data, style_analysis=style_analysis
        )
        logger.info("Gen #%s Step 3/4 done. Prompt length: %d chars", gen_id, len(text_prompt))
        _sb().table('generations').update(
            {'text_prompt': text_prompt}
        ).eq('id', generation.id).execute()

        # Step 4: Generate final image with text
        # Use signed URL so WaveSpeed can download without Cloudflare blocking
        logger.info("Gen #%s Step 4/4: Generating final image with text via WaveSpeed...", gen_id)
        signed_base_url = storage_service.get_signed_url(base_storage_path, expires_in=600)
        logger.info("Gen #%s Using signed URL for base image", gen_id)
        final_prompt = f"{base_prompt}\n\nText overlay: {text_prompt}"
        final_result = image_service.generate_image_with_text(
            signed_base_url,
            final_prompt,
            aspect_ratio
        )
        final_image_url = final_result['image_url']
        logger.info("Gen #%s Step 4/4 done. Final image URL received", gen_id)

        # Upload final image to Supabase Storage
        logger.info("Gen #%s Uploading final image to storage...", gen_id)
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
        return jsonify(final_gen.to_dict()), 201

    except Exception as e:
        logger.error("Gen #%s FAILED: %s", gen_id, e, exc_info=True)
        _sb().table('generations').update({
            'status': 'failed',
            'error_message': str(e),
        }).eq('id', generation.id).execute()

        # Re-fetch to get updated state
        err_result = _sb().table('generations').select('*').eq(
            'id', generation.id
        ).execute()
        failed_gen = Generation.from_row(err_result.data[0])

        return jsonify({
            'error': 'Generation failed',
            'details': str(e),
            'generation': failed_gen.to_dict()
        }), 500


@generate_bp.route('/generations', methods=['GET'])
@token_required
def get_generations(current_user):
    """Get all generations for the current user."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    # Limit per_page to prevent abuse
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    logger.info(
        "Listing generations for user id=%s (page=%d, per_page=%d)",
        current_user.id, page, per_page,
    )

    # Get total count (only completed generations)
    count_result = _sb().table('generations').select(
        '*', count='exact'
    ).eq('user_id', current_user.id).eq('status', 'completed').execute()
    total = count_result.count or 0

    # Get paginated results (only completed generations)
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
    """Get a specific generation by ID."""
    logger.info("Fetching generation #%d for user id=%s", generation_id, current_user.id)
    result = _sb().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Generation #%d not found for user id=%s", generation_id, current_user.id)
        return jsonify({'error': 'Generation not found'}), 404

    generation = Generation.from_row(result.data[0])
    return jsonify(generation.to_dict())


@generate_bp.route('/generations/<int:generation_id>/regenerate', methods=['POST'])
@token_required
def regenerate(current_user, generation_id):
    """
    Regenerate a book cover with the same settings.
    Creates a new generation record.
    """
    logger.info(
        "Regenerate request for gen #%d from user id=%s",
        generation_id, current_user.id,
    )
    result = _sb().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Original generation #%d not found", generation_id)
        return jsonify({'error': 'Generation not found'}), 404

    original = Generation.from_row(result.data[0])
    logger.info(
        "Regenerating from gen #%d (title='%s')",
        generation_id, original.book_title,
    )

    # Create new generation with same settings
    new_gen_data = {
        'user_id': current_user.id,
        'book_title': original.book_title,
        'author_name': original.author_name,
        'summary': original.summary,
        'genres': original.genres,
        'mood': original.mood,
        'aspect_ratio': original.aspect_ratio,
        'color_preference': original.color_preference,
        'character_description': original.character_description,
        'keywords': original.keywords,
        'reference_image_description': original.reference_image_description,
        'style_analysis': original.style_analysis,
        'status': 'generating',
    }

    insert_result = _sb().table('generations').insert(new_gen_data).execute()
    new_generation = Generation.from_row(insert_result.data[0])
    gen_id = new_generation.id
    style_analysis = new_generation.style_analysis
    logger.info("Gen #%s created for regeneration (from #%d)", gen_id, generation_id)

    try:
        book_data = {
            'book_title': new_generation.book_title,
            'author_name': new_generation.author_name,
            'summary': new_generation.summary,
            'genres': new_generation.genres,
            'mood': new_generation.mood,
            'color_preference': new_generation.color_preference,
            'character_description': new_generation.character_description,
            'keywords': new_generation.keywords,
            'reference_image_description': new_generation.reference_image_description
        }

        # Generate new prompts (might be slightly different due to temperature)
        logger.info("Gen #%s Step 1/4: Generating base image prompt via LLM...", gen_id)
        base_prompt = llm_service.generate_base_image_prompt(
            book_data, style_analysis=style_analysis
        )
        logger.info("Gen #%s Step 1/4 done. Prompt length: %d chars", gen_id, len(base_prompt))
        _sb().table('generations').update(
            {'base_prompt': base_prompt}
        ).eq('id', new_generation.id).execute()

        # Generate new base image
        logger.info("Gen #%s Step 2/4: Generating base image via WaveSpeed...", gen_id)
        base_result = image_service.generate_base_image(
            base_prompt, new_generation.aspect_ratio
        )
        logger.info("Gen #%s Step 2/4 done. Base image URL received", gen_id)

        logger.info("Gen #%s Uploading base image to storage...", gen_id)
        base_upload = storage_service.upload_from_url(
            base_result['image_url'], folder='base'
        )
        storage_base_url = base_upload['public_url']
        base_storage_path = base_upload['path']
        _sb().table('generations').update(
            {'base_image_url': storage_base_url}
        ).eq('id', new_generation.id).execute()
        logger.info("Gen #%s Base image stored", gen_id)

        # Generate text prompt and final image
        logger.info("Gen #%s Step 3/4: Generating text overlay prompt via LLM...", gen_id)
        text_prompt = llm_service.generate_text_overlay_prompt(
            book_data, style_analysis=style_analysis
        )
        logger.info("Gen #%s Step 3/4 done. Prompt length: %d chars", gen_id, len(text_prompt))

        # Use signed URL so WaveSpeed can download without Cloudflare blocking
        logger.info("Gen #%s Step 4/4: Generating final image with text via WaveSpeed...", gen_id)
        signed_base_url = storage_service.get_signed_url(base_storage_path, expires_in=600)
        logger.info("Gen #%s Using signed URL for base image", gen_id)
        final_prompt = f"{base_prompt}\n\nText overlay: {text_prompt}"
        final_result = image_service.generate_image_with_text(
            signed_base_url,
            final_prompt,
            new_generation.aspect_ratio
        )
        logger.info("Gen #%s Step 4/4 done. Final image URL received", gen_id)

        logger.info("Gen #%s Uploading final image to storage...", gen_id)
        final_upload = storage_service.upload_from_url(
            final_result['image_url'], folder='covers'
        )
        storage_final_url = final_upload['public_url']

        now = datetime.now(timezone.utc).isoformat()
        update_result = _sb().table('generations').update({
            'text_prompt': text_prompt,
            'final_image_url': storage_final_url,
            'status': 'completed',
            'completed_at': now,
        }).eq('id', new_generation.id).execute()

        final_gen = Generation.from_row(update_result.data[0])
        logger.info("Gen #%s COMPLETED successfully (regenerated from #%d)", gen_id, generation_id)
        return jsonify(final_gen.to_dict()), 201

    except Exception as e:
        logger.error("Gen #%s FAILED: %s", gen_id, e, exc_info=True)
        _sb().table('generations').update({
            'status': 'failed',
            'error_message': str(e),
        }).eq('id', new_generation.id).execute()

        err_result = _sb().table('generations').select('*').eq(
            'id', new_generation.id
        ).execute()
        failed_gen = Generation.from_row(err_result.data[0])

        return jsonify({
            'error': 'Regeneration failed',
            'details': str(e),
            'generation': failed_gen.to_dict()
        }), 500


@generate_bp.route('/generations/<int:generation_id>', methods=['DELETE'])
@token_required
def delete_generation(current_user, generation_id):
    """Delete a generation and its associated images."""
    logger.info("Delete request for gen #%d from user id=%s", generation_id, current_user.id)
    result = _sb().table('generations').select('*').eq(
        'id', generation_id
    ).eq('user_id', current_user.id).execute()

    if not result.data:
        logger.warning("Generation #%d not found for deletion", generation_id)
        return jsonify({'error': 'Generation not found'}), 404

    generation = Generation.from_row(result.data[0])

    # Delete images from Supabase Storage
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
