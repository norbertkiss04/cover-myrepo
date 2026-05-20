from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.services.generation_cleanup_service import (
    cleanup_stale_generated_covers,
    cleanup_stale_generated_covers_safe,
)


def _generation(row_id, created_at, **overrides):
    data = {
        'id': row_id,
        'user_id': 1,
        'book_title': 'Book',
        'author_name': 'Author',
        'status': 'completed',
        'created_at': created_at,
        'base_image_url': f'https://test.supabase.co/storage/v1/object/public/covers/base/{row_id}.png',
        'final_image_url': f'https://test.supabase.co/storage/v1/object/public/covers/covers/{row_id}.png',
        'style_reference_id': None,
        'cover_template_id': None,
    }
    data.update(overrides)
    return data


@patch('app.services.generation_cleanup_service.storage_service')
def test_deletes_old_unreferenced_non_template_generations(mock_storage, app):
    old_date = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    app._test_store['generations'] = [_generation(1, old_date)]
    mock_storage.delete_file.return_value = True

    with app.app_context():
        result = cleanup_stale_generated_covers()

    assert result == {'deleted_generations': 1, 'deleted_files': 2}
    assert app._test_store['generations'] == []
    assert mock_storage.delete_file.call_count == 2


@patch('app.services.generation_cleanup_service.storage_service')
def test_keeps_recent_generations(mock_storage, app):
    recent_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    app._test_store['generations'] = [_generation(1, recent_date)]

    with app.app_context():
        result = cleanup_stale_generated_covers()

    assert result == {'deleted_generations': 0, 'deleted_files': 0}
    assert len(app._test_store['generations']) == 1
    mock_storage.delete_file.assert_not_called()


@patch('app.services.generation_cleanup_service.storage_service')
def test_keeps_style_reference_generations(mock_storage, app):
    old_date = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    app._test_store['generations'] = [_generation(1, old_date, style_reference_id=10)]

    with app.app_context():
        result = cleanup_stale_generated_covers()

    assert result == {'deleted_generations': 0, 'deleted_files': 0}
    assert len(app._test_store['generations']) == 1
    mock_storage.delete_file.assert_not_called()


@patch('app.services.generation_cleanup_service.storage_service')
def test_keeps_template_generations(mock_storage, app):
    old_date = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    app._test_store['generations'] = [_generation(1, old_date, cover_template_id=10)]

    with app.app_context():
        result = cleanup_stale_generated_covers()

    assert result == {'deleted_generations': 0, 'deleted_files': 0}
    assert len(app._test_store['generations']) == 1
    mock_storage.delete_file.assert_not_called()


@patch('app.services.generation_cleanup_service.cleanup_stale_generated_covers')
def test_safe_cleanup_swallows_errors(mock_cleanup, app):
    mock_cleanup.side_effect = RuntimeError('cleanup failed')

    with app.app_context():
        result = cleanup_stale_generated_covers_safe()

    assert result == {'deleted_generations': 0, 'deleted_files': 0}
