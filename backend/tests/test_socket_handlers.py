import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

from app import create_app, socketio
from app.models.user import User
from app.models.generation import Generation
from app.sockets import connected_users


def _make_supabase_user(supabase_id, email):
    user = MagicMock()
    user.id = supabase_id
    user.email = email
    user.user_metadata = {'full_name': 'Test', 'avatar_url': None}
    return user


@pytest.fixture
def socket_app():
    app = create_app('testing')

    from tests.conftest import _make_mock_supabase
    store = {}
    app.supabase = _make_mock_supabase(store)
    app._test_store = store

    supabase_id = 'socket-test-id'
    store.setdefault('users', []).append({
        'id': 1,
        'google_id': supabase_id,
        'email': 'socket@example.com',
        'name': 'Socket User',
        'picture': None,
        'credits': 30,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    mock_supabase_user = _make_supabase_user(supabase_id, 'socket@example.com')
    mock_response = MagicMock()
    mock_response.user = mock_supabase_user

    def get_user_side_effect(token):
        if token == 'valid-socket-token':
            return mock_response
        raise Exception('Invalid token')

    app.supabase.auth.get_user.side_effect = get_user_side_effect

    mock_rpc = MagicMock()
    mock_rpc_result = MagicMock()
    mock_rpc_result.data = 27
    mock_rpc.execute.return_value = mock_rpc_result
    app.supabase.rpc = MagicMock(return_value=mock_rpc)

    yield app

    connected_users.clear()


@pytest.fixture
def socket_client(socket_app):
    client = socketio.test_client(
        socket_app,
        auth={'token': 'valid-socket-token'},
    )
    yield client
    if client.is_connected():
        client.disconnect()


class TestSocketConnect:

    def test_connect_with_valid_token(self, socket_app):
        client = socketio.test_client(
            socket_app,
            auth={'token': 'valid-socket-token'},
        )
        assert client.is_connected()
        client.disconnect()

    def test_connect_without_token_rejected(self, socket_app):
        client = socketio.test_client(socket_app)
        assert not client.is_connected()

    def test_connect_with_invalid_token_rejected(self, socket_app):
        client = socketio.test_client(
            socket_app,
            auth={'token': 'bad-token'},
        )
        assert not client.is_connected()


class TestSocketDisconnect:

    def test_disconnect_cleans_up(self, socket_app):
        client = socketio.test_client(
            socket_app,
            auth={'token': 'valid-socket-token'},
        )
        assert client.is_connected()

        initial_count = len(connected_users)
        client.disconnect()
        assert len(connected_users) < initial_count or len(connected_users) == 0


class TestStartGeneration:

    @patch('app.sockets.handlers.socketio')
    def test_missing_title_returns_error(self, mock_sio, socket_client, socket_app):
        socket_client.emit('start_generation', {
            'author_name': 'Author',
            'aspect_ratio': '2:3',
        })

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        assert len(error_events) > 0
        assert 'missing' in error_events[0]['args'][0]['error'].lower() or 'required' in error_events[0]['args'][0]['error'].lower()

    @patch('app.sockets.handlers.socketio')
    def test_invalid_aspect_ratio_returns_error(self, mock_sio, socket_client, socket_app):
        socket_client.emit('start_generation', {
            'book_title': 'Test',
            'author_name': 'Author',
            'aspect_ratio': '99:1',
        })

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        assert len(error_events) > 0
        assert 'aspect_ratio' in error_events[0]['args'][0]['error'].lower() or 'invalid' in error_events[0]['args'][0]['error'].lower()

    @patch('app.sockets.handlers.socketio')
    def test_genres_must_be_array(self, mock_sio, socket_client, socket_app):
        socket_client.emit('start_generation', {
            'book_title': 'Test',
            'author_name': 'Author',
            'genres': 'Fantasy',
        })

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        assert len(error_events) > 0
        assert 'array' in error_events[0]['args'][0]['error'].lower()

    @patch('app.sockets.handlers.socketio')
    def test_active_generation_blocks_new_one(self, mock_sio, socket_client, socket_app):
        socket_app._test_store.setdefault('generations', []).append({
            'id': 1,
            'user_id': 1,
            'book_title': 'Active Book',
            'author_name': 'Author',
            'status': 'generating',
            'aspect_ratio': '2:3',
            'created_at': datetime.now(timezone.utc).isoformat(),
        })

        socket_client.emit('start_generation', {
            'book_title': 'New Book',
            'author_name': 'Author',
        })

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        assert len(error_events) > 0
        assert 'already' in error_events[0]['args'][0]['error'].lower()

    @patch('app.sockets.handlers.socketio')
    def test_base_image_only_does_not_require_title(self, mock_sio, socket_client, socket_app):
        mock_sio.start_background_task = MagicMock()
        mock_sio.emit = MagicMock()

        socket_client.emit('start_generation', {
            'base_image_only': True,
            'cover_ideas': 'Abstract art',
        })

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        no_field_errors = [e for e in error_events if 'missing' in e['args'][0].get('error', '').lower()]
        assert len(no_field_errors) == 0


class TestCancelGeneration:

    @patch('app.sockets.handlers.socketio')
    def test_no_active_generation_returns_error(self, mock_sio, socket_client, socket_app):
        socket_client.emit('cancel_generation')

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        assert len(error_events) > 0
        assert 'no active' in error_events[0]['args'][0]['error'].lower()

    @patch('app.sockets.handlers.socketio')
    def test_cancel_marks_generation_as_failed(self, mock_sio, socket_client, socket_app):
        socket_app._test_store.setdefault('generations', []).append({
            'id': 50,
            'user_id': 1,
            'book_title': 'Cancel Me',
            'author_name': 'Author',
            'status': 'generating',
            'aspect_ratio': '2:3',
            'created_at': datetime.now(timezone.utc).isoformat(),
        })

        socket_client.emit('cancel_generation')

        gen = next(
            g for g in socket_app._test_store['generations'] if g['id'] == 50
        )
        assert gen['status'] == 'failed'
        assert gen['error_message'] == 'Cancelled by user'


class TestStartRegeneration:

    @patch('app.sockets.handlers.socketio')
    def test_missing_generation_id_returns_error(self, mock_sio, socket_client, socket_app):
        socket_client.emit('start_regeneration', {})

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        assert len(error_events) > 0
        assert 'generation_id' in error_events[0]['args'][0]['error'].lower()

    @patch('app.sockets.handlers.socketio')
    def test_generation_not_found_returns_error(self, mock_sio, socket_client, socket_app):
        socket_client.emit('start_regeneration', {'generation_id': 999})

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        assert len(error_events) > 0
        assert 'not found' in error_events[0]['args'][0]['error'].lower()

    @patch('app.sockets.handlers.socketio')
    def test_active_generation_blocks_regeneration(self, mock_sio, socket_client, socket_app):
        socket_app._test_store.setdefault('generations', []).extend([
            {
                'id': 60,
                'user_id': 1,
                'book_title': 'Original',
                'author_name': 'Author',
                'status': 'completed',
                'aspect_ratio': '2:3',
                'created_at': datetime.now(timezone.utc).isoformat(),
            },
            {
                'id': 61,
                'user_id': 1,
                'book_title': 'Active',
                'author_name': 'Author',
                'status': 'generating',
                'aspect_ratio': '2:3',
                'created_at': datetime.now(timezone.utc).isoformat(),
            },
        ])

        socket_client.emit('start_regeneration', {'generation_id': 60})

        received = socket_client.get_received()
        error_events = [e for e in received if e['name'] == 'generation_error']
        assert len(error_events) > 0
        assert 'already' in error_events[0]['args'][0]['error'].lower()

    @patch('app.sockets.handlers.socketio')
    def test_regeneration_creates_new_generation(self, mock_sio, socket_client, socket_app):
        mock_sio.start_background_task = MagicMock()
        mock_sio.emit = MagicMock()

        socket_app._test_store.setdefault('generations', []).append({
            'id': 70,
            'user_id': 1,
            'book_title': 'Original Book',
            'author_name': 'Original Author',
            'cover_ideas': 'forest',
            'description': 'A test',
            'genres': ['Fantasy'],
            'mood': 'dark',
            'aspect_ratio': '2:3',
            'status': 'completed',
            'created_at': datetime.now(timezone.utc).isoformat(),
        })

        socket_client.emit('start_regeneration', {'generation_id': 70})

        new_gens = [
            g for g in socket_app._test_store['generations']
            if g.get('status') == 'generating'
        ]
        assert len(new_gens) == 1
        assert new_gens[0]['book_title'] == 'Original Book'
        assert new_gens[0]['author_name'] == 'Original Author'
