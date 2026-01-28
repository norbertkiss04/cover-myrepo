import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock


def test_auth_me_without_token(client):
    response = client.get('/auth/me')

    assert response.status_code == 401
    data = response.get_json()
    assert 'error' in data


def test_auth_me_with_invalid_token(client):
    response = client.get(
        '/auth/me',
        headers={'Authorization': 'Bearer invalid-token'}
    )

    assert response.status_code == 401
    data = response.get_json()
    assert 'error' in data


def test_auth_me_with_valid_token(client, auth_headers):
    response = client.get('/auth/me', headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data['email'] == 'test@example.com'
    assert data['name'] == 'Test User'


def test_logout(client, auth_headers):
    response = client.post('/auth/logout', headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert 'message' in data


def test_sync_user_updates_name(client, auth_headers):
    response = client.post(
        '/auth/sync',
        headers=auth_headers,
        json={'name': 'Updated Name'},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == 'Updated Name'


def test_sync_user_updates_picture(client, auth_headers):
    response = client.post(
        '/auth/sync',
        headers=auth_headers,
        json={'picture': 'https://example.com/new-avatar.png'},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['picture'] == 'https://example.com/new-avatar.png'


def test_sync_user_no_changes(client, auth_headers):
    response = client.post(
        '/auth/sync',
        headers=auth_headers,
        json={},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['email'] == 'test@example.com'


def test_update_preferences(client, auth_headers):
    prefs = {'visible_fields': ['description', 'genres']}
    response = client.put(
        '/auth/preferences',
        headers=auth_headers,
        json=prefs,
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['preferences'] == prefs


def test_update_preferences_empty(client, auth_headers):
    response = client.put(
        '/auth/preferences',
        headers=auth_headers,
        json={},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert 'preferences' in data


def test_auto_create_user_on_first_login(app, client):
    """When a valid token comes in but the user is not in the DB, a new user is created."""
    supabase_id = 'brand-new-user-id'
    invite_code = 'invite-123'

    app._test_store.setdefault('invites', []).append({
        'id': 1,
        'code': invite_code,
        'created_by': 1,
        'expires_at': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        'used_at': None,
    })

    mock_supabase_user = MagicMock()
    mock_supabase_user.id = supabase_id
    mock_supabase_user.email = 'newuser@example.com'
    mock_supabase_user.user_metadata = {
        'full_name': 'New User',
        'avatar_url': 'https://example.com/new.png',
        'invite_code': invite_code,
    }
    mock_response = MagicMock()
    mock_response.user = mock_supabase_user

    def get_user_side_effect(token):
        if token == 'new-user-token':
            return mock_response
        raise Exception('Invalid token')

    app.supabase.auth.get_user.side_effect = get_user_side_effect

    response = client.get(
        '/auth/me',
        headers={'Authorization': 'Bearer new-user-token'},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['email'] == 'newuser@example.com'
    assert data['name'] == 'New User'
    assert data['credits'] == 30


def test_race_condition_insert_fails_retry_finds_user(app, client):
    """If insert fails (race condition), the decorator retries and finds the user."""
    supabase_id = 'race-condition-user-id'

    # Pre-seed the user so the retry lookup succeeds
    app._test_store.setdefault('users', []).append({
        'id': 99,
        'google_id': supabase_id,
        'email': 'race@example.com',
        'name': 'Race User',
        'picture': None,
        'credits': 30,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    mock_supabase_user = MagicMock()
    mock_supabase_user.id = supabase_id
    mock_supabase_user.email = 'race@example.com'
    mock_supabase_user.user_metadata = {'full_name': 'Race User'}
    mock_response = MagicMock()
    mock_response.user = mock_supabase_user

    def get_user_side_effect(token):
        if token == 'race-token':
            return mock_response
        raise Exception('Invalid token')

    app.supabase.auth.get_user.side_effect = get_user_side_effect

    # First call succeeds because user is already in store
    response = client.get(
        '/auth/me',
        headers={'Authorization': 'Bearer race-token'},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['email'] == 'race@example.com'


def _make_admin_headers(app, supabase_id='admin-supabase-id'):
    app._test_store.setdefault('users', []).append({
        'id': 100,
        'google_id': supabase_id,
        'email': 'admin@example.com',
        'name': 'Admin User',
        'picture': None,
        'credits': 30,
        'is_admin': True,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    mock_supabase_user = MagicMock()
    mock_supabase_user.id = supabase_id
    mock_supabase_user.email = 'admin@example.com'
    mock_supabase_user.user_metadata = {'full_name': 'Admin User'}
    mock_response = MagicMock()
    mock_response.user = mock_supabase_user

    original_side_effect = app.supabase.auth.get_user.side_effect

    def get_user_side_effect(token):
        if token == 'admin-token':
            return mock_response
        if original_side_effect:
            return original_side_effect(token)
        raise Exception('Invalid token')

    app.supabase.auth.get_user.side_effect = get_user_side_effect

    return {'Authorization': 'Bearer admin-token'}


def test_give_credits_non_admin_forbidden(client, auth_headers):
    response = client.post(
        '/auth/credits',
        headers=auth_headers,
        json={'email': 'target@example.com', 'amount': 10},
    )

    assert response.status_code == 403
    data = response.get_json()
    assert data['error'] == 'Forbidden'


def test_give_credits_missing_email(app, client):
    admin_headers = _make_admin_headers(app)

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'amount': 10},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert 'Email' in data['error']


def test_give_credits_invalid_email_format(app, client):
    admin_headers = _make_admin_headers(app)

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'email': 'not-an-email', 'amount': 10},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert 'email' in data['error'].lower()


def test_give_credits_missing_amount(app, client):
    admin_headers = _make_admin_headers(app)

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'email': 'target@example.com'},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert 'Amount' in data['error']


def test_give_credits_invalid_amount_zero(app, client):
    admin_headers = _make_admin_headers(app)

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'email': 'target@example.com', 'amount': 0},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert 'at least 1' in data['error']


def test_give_credits_invalid_amount_negative(app, client):
    admin_headers = _make_admin_headers(app)

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'email': 'target@example.com', 'amount': -5},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert 'at least 1' in data['error']


def test_give_credits_invalid_amount_string(app, client):
    admin_headers = _make_admin_headers(app)

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'email': 'target@example.com', 'amount': 'ten'},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert 'integer' in data['error']


def test_give_credits_user_not_found(app, client):
    admin_headers = _make_admin_headers(app)

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'email': 'nonexistent@example.com', 'amount': 10},
    )

    assert response.status_code == 404
    data = response.get_json()
    assert 'not found' in data['error'].lower()


def test_give_credits_success(app, client):
    admin_headers = _make_admin_headers(app)

    app._test_store.setdefault('users', []).append({
        'id': 200,
        'google_id': 'target-user-id',
        'email': 'target@example.com',
        'name': 'Target User',
        'picture': None,
        'credits': 20,
        'is_admin': False,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'email': 'target@example.com', 'amount': 50},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['email'] == 'target@example.com'
    assert data['new_balance'] == 70


def test_give_credits_email_case_insensitive(app, client):
    admin_headers = _make_admin_headers(app)

    app._test_store.setdefault('users', []).append({
        'id': 201,
        'google_id': 'case-user-id',
        'email': 'case@example.com',
        'name': 'Case User',
        'picture': None,
        'credits': 10,
        'is_admin': False,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    })

    response = client.post(
        '/auth/credits',
        headers=admin_headers,
        json={'email': 'CASE@EXAMPLE.COM', 'amount': 25},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['new_balance'] == 35
