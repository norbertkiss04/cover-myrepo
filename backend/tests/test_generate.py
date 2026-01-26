"""Test generation endpoints."""
import pytest


def test_get_genres(client):
    """Test that /api/genres returns available genres."""
    response = client.get('/api/genres')
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'genres' in data
    assert len(data['genres']) > 0
    assert 'Fantasy' in data['genres']


def test_get_moods(client):
    """Test that /api/moods returns available moods."""
    response = client.get('/api/moods')
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'moods' in data
    assert len(data['moods']) > 0


def test_get_aspect_ratios(client):
    """Test that /api/aspect-ratios returns available ratios."""
    response = client.get('/api/aspect-ratios')
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'aspect_ratios' in data
    assert '2:3' in data['aspect_ratios']
    assert data['aspect_ratios']['2:3']['name'] == 'Kindle Standard'


def test_create_generation_requires_auth(client):
    """Test that /api/generate requires authentication."""
    response = client.post('/api/generate', json={
        'book_title': 'Test Book',
        'author_name': 'Test Author',
        'summary': 'A test summary',
        'genres': ['Fantasy'],
        'mood': 'Epic & Grand'
    })
    
    assert response.status_code == 401


def test_create_generation_validates_required_fields(client, auth_headers):
    """Test that /api/generate validates required fields."""
    # Missing book_title
    response = client.post('/api/generate', 
        headers=auth_headers,
        json={
            'author_name': 'Test Author',
            'summary': 'A test summary',
            'genres': ['Fantasy'],
            'mood': 'Epic & Grand'
        }
    )
    
    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data
    assert 'book_title' in data['error']


def test_create_generation_validates_genres_is_list(client, auth_headers):
    """Test that /api/generate requires genres to be a list."""
    response = client.post('/api/generate',
        headers=auth_headers,
        json={
            'book_title': 'Test Book',
            'author_name': 'Test Author',
            'summary': 'A test summary',
            'genres': 'Fantasy',  # Should be a list
            'mood': 'Epic & Grand'
        }
    )
    
    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data
    assert 'genres' in data['error']


def test_create_generation_validates_aspect_ratio(client, auth_headers):
    """Test that /api/generate validates aspect ratio."""
    response = client.post('/api/generate',
        headers=auth_headers,
        json={
            'book_title': 'Test Book',
            'author_name': 'Test Author',
            'summary': 'A test summary',
            'genres': ['Fantasy'],
            'mood': 'Epic & Grand',
            'aspect_ratio': 'invalid'
        }
    )
    
    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data
    assert 'aspect_ratio' in data['error']


def test_get_generations_requires_auth(client):
    """Test that /api/generations requires authentication."""
    response = client.get('/api/generations')
    
    assert response.status_code == 401


def test_get_generations_empty(client, auth_headers):
    """Test that /api/generations returns empty list for new user."""
    response = client.get('/api/generations', headers=auth_headers)
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'generations' in data
    assert data['total'] == 0
