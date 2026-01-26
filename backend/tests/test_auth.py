"""Test authentication endpoints."""
import pytest


def test_auth_me_without_token(client):
    """Test that /auth/me requires authentication."""
    response = client.get('/auth/me')
    
    assert response.status_code == 401
    data = response.get_json()
    assert 'error' in data


def test_auth_me_with_invalid_token(client):
    """Test that /auth/me rejects invalid tokens."""
    response = client.get(
        '/auth/me',
        headers={'Authorization': 'Bearer invalid-token'}
    )
    
    assert response.status_code == 401
    data = response.get_json()
    assert 'error' in data


def test_auth_me_with_valid_token(client, auth_headers):
    """Test that /auth/me returns user info with valid token."""
    response = client.get('/auth/me', headers=auth_headers)
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['email'] == 'test@example.com'
    assert data['name'] == 'Test User'


def test_logout(client, auth_headers):
    """Test logout endpoint."""
    response = client.post('/auth/logout', headers=auth_headers)
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'message' in data
