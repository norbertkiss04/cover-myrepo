"""Test health check endpoint."""


def test_health_check(client):
    """Test that health endpoint returns healthy status."""
    response = client.get('/health')
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'
    assert data['service'] == 'instacover-api'
