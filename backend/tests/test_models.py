from app.models.user import User
from app.models.generation import Generation, ASPECT_RATIOS
from app.config import INITIAL_CREDITS

def test_user_creation():
    row = {
        'id': 1,
        'google_id': 'google-123',
        'email': 'user@example.com',
        'name': 'Test User',
        'picture': 'https://example.com/pic.jpg',
        'credits': 25,
        'created_at': '2025-01-01T00:00:00Z',
        'updated_at': '2025-01-01T00:00:00Z',
    }
    user = User.from_row(row)

    assert user.id == 1
    assert user.email == 'user@example.com'
    assert user.name == 'Test User'
    assert user.picture == 'https://example.com/pic.jpg'
    assert user.credits == 25
    assert user.created_at is not None

def test_user_creation_default_credits():
    row = {
        'id': 2,
        'google_id': 'google-456',
        'email': 'new@example.com',
        'name': 'New User',
    }
    user = User.from_row(row)

    assert user.credits == INITIAL_CREDITS

def test_user_to_dict():
    user = User(
        id=2,
        google_id='google-456',
        email='dict@example.com',
        name='Dict User',
        credits=15,
    )
    user_dict = user.to_dict()

    assert user_dict['id'] == 2
    assert user_dict['email'] == 'dict@example.com'
    assert user_dict['name'] == 'Dict User'
    assert user_dict['credits'] == 15
    assert 'unlimited_credits' in user_dict
    assert 'google_id' not in user_dict

def test_generation_creation():
    row = {
        'id': 10,
        'user_id': 1,
        'book_title': 'My Book',
        'author_name': 'Author Name',
        'cover_ideas': 'A magical forest with glowing elements',
        'description': 'A great story',
        'genres': ['Fantasy', 'Romance'],
        'aspect_ratio': '2:3',
        'status': 'pending',
    }
    generation = Generation.from_row(row)

    assert generation.id == 10
    assert generation.status == 'pending'
    assert generation.cover_ideas == 'A magical forest with glowing elements'
    assert generation.genres == ['Fantasy', 'Romance']

def test_generation_aspect_ratio_info():
    generation = Generation(
        user_id=1,
        book_title='Aspect Book',
        author_name='Aspect Author',
        cover_ideas='Dark and moody cityscape',
        aspect_ratio='2:3',
    )
    gen_dict = generation.to_dict()

    assert gen_dict['aspect_ratio'] == '2:3'
    assert gen_dict['cover_ideas'] == 'Dark and moody cityscape'
    assert gen_dict['aspect_ratio_info']['name'] == 'Kindle Standard'
    assert gen_dict['aspect_ratio_info']['width'] == 1600
    assert gen_dict['aspect_ratio_info']['height'] == 2400

def test_aspect_ratios_constant():
    assert '2:3' in ASPECT_RATIOS
    assert '1:1' in ASPECT_RATIOS
    assert '16:9' in ASPECT_RATIOS
    assert ASPECT_RATIOS['2:3']['name'] == 'Kindle Standard'
