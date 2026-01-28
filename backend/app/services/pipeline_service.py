import logging
import requests as http_requests
from datetime import datetime, timezone

from app.models.generation import Generation
from app.models.style_reference import StyleReference
from app.services.llm_service import llm_service, get_prompt
from app.services.image_service import image_service, detect_and_crop_border
from app.services.storage_service import storage_service
from app.utils.db import get_supabase

logger = logging.getLogger(__name__)

VALID_REFERENCE_MODES = ('both', 'background', 'text')


class GenerationCancelled(Exception):
    pass


def _check_and_remove_border(image_url, gen_id):
    try:
        logger.info("Gen #%s: Checking for borders...", gen_id)
        response = http_requests.get(image_url, timeout=60)
        response.raise_for_status()

        cropped_bytes = detect_and_crop_border(response.content)

        if cropped_bytes is not None:
            logger.info("Gen #%s: Border detected and cropped", gen_id)
            upload = storage_service.upload_bytes(cropped_bytes, folder='covers')
            return upload['public_url']
        else:
            logger.info("Gen #%s: No border detected", gen_id)
            return image_url
    except Exception as border_error:
        logger.warning("Gen #%s: Border detection/removal failed, using original: %s", gen_id, border_error)
        return image_url


def _check_cancelled(gen_id):
    result = get_supabase().table('generations').select('status').eq('id', gen_id).execute()
    if result.data and result.data[0]['status'] != 'generating':
        raise GenerationCancelled(f"Generation #{gen_id} was cancelled")


def ensure_reference_variant(style_ref, variant_type, user_id):
    if variant_type == 'clean':
        if style_ref.clean_image_path:
            logger.info("Using cached clean background image for ref #%s", style_ref.id)
            return storage_service.get_signed_url(style_ref.clean_image_path, expires_in=600)

        logger.info("Generating clean background image for ref #%s", style_ref.id)
        signed_original = storage_service.get_signed_url(style_ref.image_path, expires_in=600)
        result = image_service.generate_clean_background(signed_original)
        variant_url = result['image_url']

        upload = storage_service.upload_from_url(variant_url, folder='references')
        get_supabase().table('style_references').update({
            'clean_image_path': upload['path']
        }).eq('id', style_ref.id).eq('user_id', user_id).execute()

        logger.info("Clean background image cached for ref #%s", style_ref.id)
        return storage_service.get_signed_url(upload['path'], expires_in=600)

    elif variant_type == 'text':
        if style_ref.text_layer_path:
            logger.info("Using cached text layer image for ref #%s", style_ref.id)
            return storage_service.get_signed_url(style_ref.text_layer_path, expires_in=600)

        logger.info("Generating text layer image for ref #%s", style_ref.id)
        signed_original = storage_service.get_signed_url(style_ref.image_path, expires_in=600)
        result = image_service.generate_text_layer(signed_original)
        variant_url = result['image_url']

        upload = storage_service.upload_from_url(variant_url, folder='references')
        get_supabase().table('style_references').update({
            'text_layer_path': upload['path']
        }).eq('id', style_ref.id).eq('user_id', user_id).execute()

        logger.info("Text layer image cached for ref #%s", style_ref.id)
        return storage_service.get_signed_url(upload['path'], expires_in=600)

    else:
        raise ValueError(f"Invalid variant type: {variant_type}")


def run_standard_pipeline(gen_id, generation, book_data, aspect_ratio, on_progress=None, base_image_only=False):
    total_steps = 2 if base_image_only else 4

    def progress(step, total, message):
        _check_cancelled(gen_id)
        if on_progress:
            on_progress(step, total, message)

    progress(1, total_steps, "Generating image prompt...")
    base_prompt = llm_service.generate_base_image_prompt(book_data, base_image_only=base_image_only)
    if base_image_only:
        base_prompt += " Do not include any text, words, letters, titles, or typography anywhere in the image."

    logger.info("Gen #%s Step 1/%d done. Prompt length: %d chars", gen_id, total_steps, len(base_prompt))
    get_supabase().table('generations').update(
        {'base_prompt': base_prompt}
    ).eq('id', generation.id).execute()

    progress(2, total_steps, "Creating base image...")
    base_result = image_service.generate_base_image(base_prompt, aspect_ratio)
    base_image_url = base_result['image_url']
    base_image_url = _check_and_remove_border(base_image_url, gen_id)
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
    text_prompt = llm_service.generate_text_overlay_prompt(book_data)
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
    final_image_url = _check_and_remove_border(final_image_url, gen_id)

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
    gen_id, generation, book_data,
    style_reference_id, aspect_ratio, user_id, on_progress=None,
    base_image_only=False, reference_mode='both',
):
    if reference_mode not in VALID_REFERENCE_MODES:
        reference_mode = 'both'

    total_steps = 3 if reference_mode in ('background', 'text') else 2

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

    style_analysis = style_ref.get_style_analysis(mode=reference_mode) if style_ref.has_analysis() else None

    current_step = 1

    if reference_mode == 'background':
        progress(current_step, total_steps, "Preparing background reference...")
        signed_ref_url = ensure_reference_variant(style_ref, 'clean', user_id)
        current_step += 1
    elif reference_mode == 'text':
        progress(current_step, total_steps, "Preparing text reference...")
        signed_ref_url = ensure_reference_variant(style_ref, 'text', user_id)
        current_step += 1
    else:
        signed_ref_url = storage_service.get_signed_url(style_ref.image_path, expires_in=600)

    progress(current_step, total_steps, "Generating image prompt...")
    if base_image_only:
        unified_prompt = llm_service.generate_style_referenced_prompt_no_text(book_data, style_analysis=style_analysis, reference_mode=reference_mode)
    else:
        unified_prompt = llm_service.generate_style_referenced_prompt(book_data, style_analysis=style_analysis, reference_mode=reference_mode)

    logger.info("Gen #%s Step %d/%d done. Prompt length: %d chars", gen_id, current_step, total_steps, len(unified_prompt))
    get_supabase().table('generations').update(
        {'base_prompt': unified_prompt}
    ).eq('id', generation.id).execute()
    current_step += 1

    progress(current_step, total_steps, "Generating final cover...")

    reference_mode_prefix_key = f'reference_mode_prefix_{reference_mode}'
    reference_mode_prefix = get_prompt('style_reference', reference_mode_prefix_key)
    final_prompt_with_prefix = reference_mode_prefix + unified_prompt

    logger.info("Gen #%s Using reference_mode=%s, prefix length=%d chars", gen_id, reference_mode, len(reference_mode_prefix))

    final_result = image_service.generate_image_with_text(
        [signed_ref_url],
        final_prompt_with_prefix,
        aspect_ratio,
    )
    final_image_url = final_result['image_url']
    final_image_url = _check_and_remove_border(final_image_url, gen_id)

    final_upload = storage_service.upload_from_url(final_image_url, folder='covers')
    storage_final_url = final_upload['public_url']
    now = datetime.now(timezone.utc).isoformat()
    update_result = get_supabase().table('generations').update({
        'final_image_url': storage_final_url,
        'status': 'completed',
        'completed_at': now,
    }).eq('id', generation.id).execute()

    final_gen = Generation.from_row(update_result.data[0])
    logger.info("Gen #%s COMPLETED successfully (style-referenced, mode=%s)", gen_id, reference_mode)
    return final_gen
