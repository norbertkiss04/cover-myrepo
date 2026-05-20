import logging
from datetime import datetime, timedelta, timezone

from app.services.storage_service import storage_service
from app.utils.db import get_supabase

logger = logging.getLogger(__name__)


def _parse_created_at(value):
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    return None


def cleanup_stale_generated_covers(days=7, limit=500):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = get_supabase().table('generations').select('*').eq(
        'status', 'completed'
    ).order('created_at', desc=False).limit(limit).execute()

    deleted_count = 0
    storage_delete_count = 0

    for row in result.data or []:
        created_at = _parse_created_at(row.get('created_at'))
        if not created_at or created_at >= cutoff:
            continue
        if row.get('style_reference_id') is not None:
            continue
        if row.get('cover_template_id') is not None:
            continue

        generation_id = row.get('id')
        image_urls = {row.get('base_image_url'), row.get('final_image_url')}
        for image_url in image_urls:
            if image_url and storage_service.delete_file(image_url):
                storage_delete_count += 1

        get_supabase().table('generations').delete().eq('id', generation_id).execute()
        deleted_count += 1

    if deleted_count:
        logger.info(
            "Cleaned up %d stale generated cover rows and %d storage objects",
            deleted_count,
            storage_delete_count,
        )

    return {'deleted_generations': deleted_count, 'deleted_files': storage_delete_count}


def cleanup_stale_generated_covers_safe():
    try:
        return cleanup_stale_generated_covers()
    except Exception as exc:
        logger.warning("Stale generated cover cleanup failed: %s", exc, exc_info=True)
        return {'deleted_generations': 0, 'deleted_files': 0}
