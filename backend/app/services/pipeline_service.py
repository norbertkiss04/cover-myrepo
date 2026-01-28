import logging
import requests as http_requests
from datetime import datetime, timezone

from app.models.generation import Generation
from app.models.style_reference import StyleReference
from app.services.llm_service import llm_service
from app.services.image_service import image_service
from app.services.storage_service import storage_service
from app.utils.db import get_supabase

logger = logging.getLogger(__name__)


class GenerationCancelled(Exception):
    pass


def _check_cancelled(gen_id):
    result = get_supabase().table('generations').select('status').eq('id', gen_id).execute()
    if result.data and result.data[0]['status'] != 'generating':
        raise GenerationCancelled(f"Generation #{gen_id} was cancelled")


def run_standard_pipeline(gen_id, generation, book_data, style_analysis, aspect_ratio, on_progress=None, base_image_only=False):
    total_steps = 2 if base_image_only else 4

    def progress(step, total, message):
        _check_cancelled(gen_id)
        if on_progress:
            on_progress(step, total, message)

    progress(1, total_steps, "Generating image prompt...")
    base_prompt = llm_service.generate_base_image_prompt(
        book_data, style_analysis=style_analysis, base_image_only=base_image_only
    )
    if base_image_only:
        base_prompt += " Do not include any text, words, letters, titles, or typography anywhere in the image."
    base_prompt += " The image must fill the entire canvas edge-to-edge with absolutely no white borders, margins, or empty space."
    logger.info("Gen #%s Step 1/%d done. Prompt length: %d chars", gen_id, total_steps, len(base_prompt))
    get_supabase().table('generations').update(
        {'base_prompt': base_prompt}
    ).eq('id', generation.id).execute()

    progress(2, total_steps, "Creating base image...")
    base_result = image_service.generate_base_image(base_prompt, aspect_ratio)
    base_image_url = base_result['image_url']
    logger.info("Gen #%s Step 2/%d done. Base image URL received", gen_id, total_steps)

    base_upload = storage_service.upload_from_url(base_image_url, folder='base')
    storage_base_url = base_upload['public_url']
    base_storage_path = base_upload['path']
    get_supabase().table('generations').update(
        {'base_image_url': storage_base_url}
    ).eq('id', generation.id).execute()

    if base_image_only:
        now = datetime.now(timezone.utc).isoformat()
        update_result = get_supabase().table('generations').update({
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
    get_supabase().table('generations').update(
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
    update_result = get_supabase().table('generations').update({
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
        _check_cancelled(gen_id)
        if on_progress:
            on_progress(step, total_steps, message)

    ref_result = get_supabase().table('style_references').select('*').eq(
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
    get_supabase().table('generations').update(
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
    update_result = get_supabase().table('generations').update({
        'final_image_url': storage_final_url,
        'status': 'completed',
        'completed_at': now,
    }).eq('id', generation.id).execute()

    final_gen = Generation.from_row(update_result.data[0])
    logger.info("Gen #%s COMPLETED successfully (style-referenced)", gen_id)
    return final_gen
