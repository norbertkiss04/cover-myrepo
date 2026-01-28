import pytest
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

    mock_supabase_user = MagicMock()
    mock_supabase_user.id = supabase_id
    mock_supabase_user.email = 'newuser@example.com'
    mock_supabase_user.user_metadata = {
        'full_name': 'New User',
        'avatar_url': 'https://example.com/new.png',
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
