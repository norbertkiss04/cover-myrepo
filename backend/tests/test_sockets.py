import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

from app.models.generation import Generation
from app.sockets import _is_stale, _room_for, _check_active_generation, STALE_TIMEOUT_MINUTES


class TestIsStale:
    """Tests for _is_stale() helper."""

    def test_fresh_generation_is_not_stale(self):
        gen = Generation(
            user_id=1,
            book_title='Test',
            author_name='Author',
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        assert _is_stale(gen) is False

    def test_old_generation_is_stale(self):
        old_time = datetime.now(timezone.utc) - timedelta(minutes=STALE_TIMEOUT_MINUTES + 1)
        gen = Generation(
            user_id=1,
            book_title='Test',
            author_name='Author',
            created_at=old_time.isoformat(),
        )
        assert _is_stale(gen) is True

    def test_stale_with_z_suffix(self):
        old_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        iso_str = old_time.strftime('%Y-%m-%dT%H:%M:%SZ')
        gen = Generation(
            user_id=1,
            book_title='Test',
            author_name='Author',
            created_at=iso_str,
        )
        assert _is_stale(gen) is True

    def test_stale_with_datetime_object(self):
        old_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        gen = Generation(
            user_id=1,
            book_title='Test',
            author_name='Author',
            created_at=old_time,
        )
        assert _is_stale(gen) is True

    def test_fresh_with_naive_datetime_string(self):
        # Naive datetime (no tz info) — treated as UTC
        now = datetime.now(timezone.utc)
        iso_str = now.strftime('%Y-%m-%dT%H:%M:%S')
        gen = Generation(
            user_id=1,
            book_title='Test',
            author_name='Author',
            created_at=iso_str,
        )
        assert _is_stale(gen) is False


class TestRoomFor:
    """Tests for _room_for() helper."""

    def test_returns_correct_room_name(self):
        assert _room_for(42) == 'user_42'

    def test_string_user_id(self):
        assert _room_for('abc') == 'user_abc'


class TestCheckActiveGeneration:
    """Tests for _check_active_generation()."""

    def test_no_active_generations(self, app):
        with app.app_context():
            result = _check_active_generation(1)
            assert result is None

    def test_marks_stale_as_failed_and_returns_active(self, app):
        with app.app_context():
            old_time = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
            fresh_time = datetime.now(timezone.utc).isoformat()

            app._test_store.setdefault('generations', []).extend([
                {
                    'id': 1,
                    'user_id': 1,
                    'book_title': 'Stale Book',
                    'author_name': 'Author',
                    'status': 'generating',
                    'aspect_ratio': '2:3',
                    'created_at': old_time,
                },
                {
                    'id': 2,
                    'user_id': 1,
                    'book_title': 'Fresh Book',
                    'author_name': 'Author',
                    'status': 'generating',
                    'aspect_ratio': '2:3',
                    'created_at': fresh_time,
                },
            ])

            result = _check_active_generation(1)

            # The stale generation should be marked as failed
            stale_gen = next(
                g for g in app._test_store['generations'] if g['id'] == 1
            )
            assert stale_gen['status'] == 'failed'

            # The fresh one should be returned as active
            assert result is not None
            assert result.id == 2

    def test_all_stale_returns_none(self, app):
        with app.app_context():
            old_time = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()

            app._test_store.setdefault('generations', []).append({
                'id': 1,
                'user_id': 1,
                'book_title': 'Stale',
                'author_name': 'Author',
                'status': 'generating',
                'aspect_ratio': '2:3',
                'created_at': old_time,
            })

            result = _check_active_generation(1)

            assert result is None
            stale = app._test_store['generations'][0]
            assert stale['status'] == 'failed'
