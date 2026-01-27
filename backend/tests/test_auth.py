import pytest

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
