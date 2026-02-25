import pytest

def test_get_genres(client):
    response = client.get('/api/genres')

    assert response.status_code == 200
    data = response.get_json()
    assert 'genres' in data
    assert len(data['genres']) > 0
    assert 'Fantasy' in data['genres']

def test_get_aspect_ratios(client):
    response = client.get('/api/aspect-ratios')

    assert response.status_code == 200
    data = response.get_json()
    assert 'aspect_ratios' in data
    assert '2:3' in data['aspect_ratios']
    assert data['aspect_ratios']['2:3']['name'] == 'Kindle Standard'


def test_get_template_fonts(client):
    response = client.get('/api/template-fonts')

    assert response.status_code == 200
    data = response.get_json()
    assert 'fonts' in data
    assert 'Space Grotesk' in data['fonts']

def test_get_generations_requires_auth(client):
    response = client.get('/api/generations')

    assert response.status_code == 401

def test_get_generations_empty(client, auth_headers):
    response = client.get('/api/generations', headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert 'generations' in data
    assert data['total'] == 0

def test_generate_endpoint_removed(client):
    response = client.post('/api/generate', json={
        'book_title': 'Test Book',
        'author_name': 'Test Author',
    })

    assert response.status_code in (404, 405)

def test_regenerate_endpoint_removed(client):
    response = client.post('/api/generations/1/regenerate')

    assert response.status_code in (401, 404, 405)
