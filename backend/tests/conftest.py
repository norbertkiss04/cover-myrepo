import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock
from app import create_app
from app.models.user import User
from app.models.generation import Generation

class MockQueryBuilder:

    def __init__(self, store: dict, table_name: str):
        self._store = store
        self._table = table_name
        self._filters = []
        self._operation = None
        self._payload = None
        self._order_col = None
        self._order_desc = False
        self._range_from = None
        self._range_to = None
        self._count_mode = None

    def select(self, columns='*', count=None):
        self._operation = 'select'
        self._count_mode = count
        return self

    def insert(self, data):
        self._operation = 'insert'
        self._payload = data
        return self

    def update(self, data):
        self._operation = 'update'
        self._payload = data
        return self

    def delete(self):
        self._operation = 'delete'
        return self

    def eq(self, column, value):
        self._filters.append((column, value))
        return self

    def order(self, column, desc=False):
        self._order_col = column
        self._order_desc = desc
        return self

    def range(self, start, end):
        self._range_from = start
        self._range_to = end
        return self

    def execute(self):
        rows = self._store.setdefault(self._table, [])

        if self._operation == 'select':
            return self._exec_select(rows)
        elif self._operation == 'insert':
            return self._exec_insert(rows)
        elif self._operation == 'update':
            return self._exec_update(rows)
        elif self._operation == 'delete':
            return self._exec_delete(rows)

        result = MagicMock()
        result.data = []
        result.count = 0
        return result

    def _match(self, row):
        for col, val in self._filters:
            if row.get(col) != val:
                return False
        return True

    def _exec_select(self, rows):
        matched = [r for r in rows if self._match(r)]

        if self._order_col:
            matched.sort(
                key=lambda r: r.get(self._order_col, ''),
                reverse=self._order_desc,
            )

        total = len(matched)

        if self._range_from is not None and self._range_to is not None:
            matched = matched[self._range_from:self._range_to + 1]

        result = MagicMock()
        result.data = matched
        result.count = total
        return result

    def _exec_insert(self, rows):
        data = dict(self._payload)
        max_id = max((r.get('id', 0) for r in rows), default=0)
        data.setdefault('id', max_id + 1)
        data.setdefault('status', 'pending')
        rows.append(data)

        result = MagicMock()
        result.data = [data]
        return result

    def _exec_update(self, rows):
        updated = []
        for row in rows:
            if self._match(row):
                row.update(self._payload)
                updated.append(row)

        result = MagicMock()
        result.data = updated
        return result

    def _exec_delete(self, rows):
        to_keep = [r for r in rows if not self._match(r)]
        removed = [r for r in rows if self._match(r)]
        rows.clear()
        rows.extend(to_keep)

        result = MagicMock()
        result.data = removed
        return result

class MockRpcBuilder:

    def __init__(self, store, func_name, params):
        self._store = store
        self._func_name = func_name
        self._params = params

    def _parse_datetime(self, value):
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        return None

    def execute(self):
        result = MagicMock()
        if self._func_name == 'deduct_credits':
            user_id = self._params.get('p_user_id')
            amount = self._params.get('p_amount')
            users = self._store.get('users', [])
            for user in users:
                if user.get('id') == user_id:
                    if user.get('credits', 0) >= amount:
                        user['credits'] -= amount
                        result.data = user['credits']
                    else:
                        result.data = False
                    return result
            result.data = False
            return result
        elif self._func_name == 'refund_credits':
            user_id = self._params.get('p_user_id')
            amount = self._params.get('p_amount')
            users = self._store.get('users', [])
            for user in users:
                if user.get('id') == user_id:
                    user['credits'] = user.get('credits', 0) + amount
                    result.data = user['credits']
                    return result
            result.data = None
            return result
        elif self._func_name == 'consume_invite':
            code = self._params.get('p_code')
            google_id = self._params.get('p_google_id')
            invites = self._store.get('invites', [])
            now = datetime.now(timezone.utc)
            for invite in invites:
                if invite.get('code') != code:
                    continue
                if invite.get('used_at'):
                    continue
                expires_at = self._parse_datetime(invite.get('expires_at'))
                if not expires_at or expires_at <= now:
                    continue
                invite['used_at'] = now.isoformat()
                invite['used_by_google_id'] = google_id
                result.data = True
                return result
            result.data = False
            return result
        result.data = None
        return result


def _make_mock_supabase(store: dict):
    mock_supabase = MagicMock()

    def table_factory(table_name):
        return MockQueryBuilder(store, table_name)

    def rpc_factory(func_name, params=None):
        return MockRpcBuilder(store, func_name, params or {})

    mock_supabase.table = table_factory
    mock_supabase.rpc = rpc_factory

    mock_supabase.auth.get_user.side_effect = Exception('Invalid token')

    return mock_supabase

def _make_supabase_user(supabase_id, email, name='Test User', avatar_url=None):
    user = MagicMock()
    user.id = supabase_id
    user.email = email
    user.user_metadata = {
        'full_name': name,
        'avatar_url': avatar_url or 'https://example.com/avatar.png'
    }
    return user

@pytest.fixture
def app():
    app = create_app('testing')

    store = {}

    app.supabase = _make_mock_supabase(store)
    app._test_store = store

    yield app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_headers(app):
    supabase_id = 'test-supabase-id-123'

    app._test_store.setdefault('users', []).append({
        'id': 1,
        'google_id': supabase_id,
        'email': 'test@example.com',
        'name': 'Test User',
        'picture': None,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    mock_supabase_user = _make_supabase_user(
        supabase_id, 'test@example.com', 'Test User'
    )
    mock_response = MagicMock()
    mock_response.user = mock_supabase_user

    def get_user_side_effect(token):
        if token == 'valid-test-token':
            return mock_response
        raise Exception('Invalid token')

    app.supabase.auth.get_user.side_effect = get_user_side_effect

    return {'Authorization': 'Bearer valid-test-token'}

@pytest.fixture
def test_user(app):
    user_data = {
        'id': 2,
        'google_id': 'test-supabase-id-456',
        'email': 'testuser@example.com',
        'name': 'Test User',
        'picture': None,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    }
    app._test_store.setdefault('users', []).append(user_data)
    return User.from_row(user_data)

@pytest.fixture
def test_generation(app, test_user):
    gen_data = {
        'id': 1,
        'user_id': test_user.id,
        'book_title': 'Test Book',
        'author_name': 'Test Author',
        'description': 'A test book description',
        'genres': ['Fantasy', 'Adventure'],
        'mood': 'Epic & Grand',
        'aspect_ratio': '2:3',
        'status': 'completed',
        'base_image_url': 'https://example.com/base.png',
        'final_image_url': 'https://example.com/final.png',
        'color_preference': None,
        'character_description': None,
        'keywords': None,
        'base_prompt': None,
        'text_prompt': None,
        'error_message': None,
        'created_at': '2025-01-01T00:00:00Z',
        'completed_at': '2025-01-01T01:00:00Z',
    }
    app._test_store.setdefault('generations', []).append(gen_data)
    return Generation.from_row(gen_data)


@pytest.fixture
def admin_auth_headers(app):
    supabase_id = 'admin-supabase-id-123'

    app._test_store.setdefault('users', []).append({
        'id': 100,
        'google_id': supabase_id,
        'email': 'admin@example.com',
        'name': 'Admin User',
        'picture': None,
        'credits': 500,
        'is_admin': True,
        'api_token': None,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    mock_supabase_user = _make_supabase_user(
        supabase_id, 'admin@example.com', 'Admin User'
    )
    mock_response = MagicMock()
    mock_response.user = mock_supabase_user

    original_side_effect = app.supabase.auth.get_user.side_effect

    def get_user_side_effect(token):
        if token == 'valid-admin-token':
            return mock_response
        if callable(original_side_effect):
            return original_side_effect(token)
        raise Exception('Invalid token')

    app.supabase.auth.get_user.side_effect = get_user_side_effect

    return {'Authorization': 'Bearer valid-admin-token'}


@pytest.fixture
def api_token_headers(app):
    api_token = 'ic_test_api_token_1234567890abcdef'

    app._test_store.setdefault('users', []).append({
        'id': 101,
        'google_id': 'api-user-supabase-id',
        'email': 'apiuser@example.com',
        'name': 'API User',
        'picture': None,
        'credits': 500,
        'is_admin': True,
        'api_token': api_token,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    return {'Authorization': f'Bearer {api_token}'}


@pytest.fixture
def non_admin_api_token_headers(app):
    api_token = 'ic_non_admin_token_abcdef1234567890'

    app._test_store.setdefault('users', []).append({
        'id': 102,
        'google_id': 'non-admin-api-user-id',
        'email': 'nonadmin@example.com',
        'name': 'Non-Admin User',
        'picture': None,
        'credits': 100,
        'is_admin': False,
        'api_token': api_token,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    return {'Authorization': f'Bearer {api_token}'}
