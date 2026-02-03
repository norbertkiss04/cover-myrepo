import pytest


class TestGetApiToken:

    def test_without_auth(self, client):
        response = client.get('/auth/api-token')

        assert response.status_code == 401
        data = response.get_json()
        assert 'error' in data

    def test_non_admin_forbidden(self, client, auth_headers):
        response = client.get('/auth/api-token', headers=auth_headers)

        assert response.status_code == 403
        data = response.get_json()
        assert 'admin' in data['error'].lower()

    def test_admin_no_token(self, client, admin_auth_headers):
        response = client.get('/auth/api-token', headers=admin_auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['has_token'] is False
        assert data['token'] is None

    def test_admin_with_token(self, client, admin_auth_headers, app):
        users = app._test_store.get('users', [])
        for user in users:
            if user.get('email') == 'admin@example.com':
                user['api_token'] = 'ic_existing_token_123'
                break

        response = client.get('/auth/api-token', headers=admin_auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['has_token'] is True
        assert data['token'] == 'ic_existing_token_123'


class TestCreateApiToken:

    def test_without_auth(self, client):
        response = client.post('/auth/api-token')

        assert response.status_code == 401

    def test_non_admin_forbidden(self, client, auth_headers):
        response = client.post('/auth/api-token', headers=auth_headers)

        assert response.status_code == 403
        data = response.get_json()
        assert 'admin' in data['error'].lower()

    def test_admin_generates_token(self, client, admin_auth_headers, app):
        response = client.post('/auth/api-token', headers=admin_auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert 'token' in data
        assert data['token'].startswith('ic_')
        assert len(data['token']) == 67

        users = app._test_store.get('users', [])
        admin_user = next((u for u in users if u.get('email') == 'admin@example.com'), None)
        assert admin_user is not None
        assert admin_user['api_token'] == data['token']

    def test_admin_regenerates_token(self, client, admin_auth_headers, app):
        response1 = client.post('/auth/api-token', headers=admin_auth_headers)
        assert response1.status_code == 200
        token1 = response1.get_json()['token']

        response2 = client.post('/auth/api-token', headers=admin_auth_headers)
        assert response2.status_code == 200
        token2 = response2.get_json()['token']

        assert token1 != token2
        assert token2.startswith('ic_')

        users = app._test_store.get('users', [])
        admin_user = next((u for u in users if u.get('email') == 'admin@example.com'), None)
        assert admin_user['api_token'] == token2


class TestRevokeApiToken:

    def test_without_auth(self, client):
        response = client.delete('/auth/api-token')

        assert response.status_code == 401

    def test_non_admin_forbidden(self, client, auth_headers):
        response = client.delete('/auth/api-token', headers=auth_headers)

        assert response.status_code == 403
        data = response.get_json()
        assert 'admin' in data['error'].lower()

    def test_no_token_to_revoke(self, client, admin_auth_headers):
        response = client.delete('/auth/api-token', headers=admin_auth_headers)

        assert response.status_code == 400
        data = response.get_json()
        assert 'no' in data['error'].lower() or 'revoke' in data['error'].lower()

    def test_revoke_success(self, client, admin_auth_headers, app):
        create_response = client.post('/auth/api-token', headers=admin_auth_headers)
        assert create_response.status_code == 200

        users = app._test_store.get('users', [])
        admin_user = next((u for u in users if u.get('email') == 'admin@example.com'), None)
        assert admin_user['api_token'] is not None

        response = client.delete('/auth/api-token', headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'revoked' in data['message'].lower()

        assert admin_user['api_token'] is None

    def test_get_after_revoke_shows_no_token(self, client, admin_auth_headers, app):
        client.post('/auth/api-token', headers=admin_auth_headers)
        client.delete('/auth/api-token', headers=admin_auth_headers)

        response = client.get('/auth/api-token', headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data['has_token'] is False
        assert data['token'] is None
