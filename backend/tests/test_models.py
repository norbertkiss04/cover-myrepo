from app.models.user import User
from app.models.generation import Generation, ASPECT_RATIOS
from app.models.style_reference import StyleReference
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
        is_admin=True,
    )
    user_dict = user.to_dict()

    assert user_dict['id'] == 2
    assert user_dict['email'] == 'dict@example.com'
    assert user_dict['name'] == 'Dict User'
    assert user_dict['credits'] == 15
    assert user_dict['is_admin'] is True
    assert user_dict['unlimited_credits'] is True
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


def test_style_reference_from_row():
    row = {
        'id': 5,
        'user_id': 1,
        'image_url': 'https://example.com/img.png',
        'image_path': 'references/img.png',
        'title': 'Gothic',
        'feeling': 'Dark and mysterious',
        'layout': 'Central symmetry',
        'illustration_rules': 'Oil painting style',
        'typography': 'Bold serif',
        'created_at': '2025-06-01T00:00:00Z',
    }
    ref = StyleReference.from_row(row)

    assert ref.id == 5
    assert ref.user_id == 1
    assert ref.image_url == 'https://example.com/img.png'
    assert ref.image_path == 'references/img.png'
    assert ref.title == 'Gothic'
    assert ref.feeling == 'Dark and mysterious'
    assert ref.layout == 'Central symmetry'
    assert ref.illustration_rules == 'Oil painting style'
    assert ref.typography == 'Bold serif'


def test_style_reference_to_dict():
    ref = StyleReference(
        id=5,
        user_id=1,
        image_url='https://example.com/img.png',
        image_path='references/img.png',
        title='Gothic',
        feeling='Dark and mysterious',
        layout='Central symmetry',
        illustration_rules='Oil painting style',
        typography='Bold serif',
        created_at='2025-06-01T00:00:00Z',
    )
    d = ref.to_dict()

    assert d['id'] == 5
    assert d['title'] == 'Gothic'
    assert d['image_url'] == 'https://example.com/img.png'
    assert d['feeling'] == 'Dark and mysterious'
    assert d['layout'] == 'Central symmetry'
    assert d['illustration_rules'] == 'Oil painting style'
    assert d['typography'] == 'Bold serif'
    assert d['created_at'] == '2025-06-01T00:00:00Z'
    assert d['clean_image_url'] is None
    assert d['text_layer_url'] is None
    assert 'image_path' not in d


def test_style_reference_get_style_analysis():
    ref = StyleReference(
        id=5,
        user_id=1,
        image_url='https://example.com/img.png',
        image_path='references/img.png',
        title='Gothic',
        feeling='Dark and mysterious',
        layout='Central symmetry',
        illustration_rules='Oil painting style',
        typography='Bold serif',
    )
    analysis = ref.get_style_analysis()

    assert analysis['feeling'] == 'Dark and mysterious'
    assert analysis['layout'] == 'Central symmetry'
    assert analysis['illustration_rules'] == 'Oil painting style'
    assert analysis['typography'] == 'Bold serif'


def test_style_reference_get_style_analysis_mode_background():
    ref = StyleReference(
        id=5,
        user_id=1,
        image_url='https://example.com/img.png',
        image_path='references/img.png',
        feeling='Dark and mysterious',
        layout='Central symmetry',
        illustration_rules='Oil painting style',
        typography='Bold serif',
    )
    analysis = ref.get_style_analysis(mode='background')

    assert analysis['feeling'] == 'Dark and mysterious'
    assert analysis['layout'] == 'Central symmetry'
    assert analysis['illustration_rules'] == 'Oil painting style'
    assert 'typography' not in analysis


def test_style_reference_get_style_analysis_mode_text():
    ref = StyleReference(
        id=5,
        user_id=1,
        image_url='https://example.com/img.png',
        image_path='references/img.png',
        feeling='Dark and mysterious',
        layout='Central symmetry',
        illustration_rules='Oil painting style',
        typography='Bold serif',
    )
    analysis = ref.get_style_analysis(mode='text')

    assert 'feeling' not in analysis
    assert 'layout' not in analysis
    assert 'illustration_rules' not in analysis
    assert analysis['typography'] == 'Bold serif'


def test_style_reference_has_analysis():
    ref_with = StyleReference(
        user_id=1,
        image_url='https://example.com/img.png',
        image_path='references/img.png',
        feeling='Dark',
    )
    assert ref_with.has_analysis() is True

    ref_without = StyleReference(
        user_id=1,
        image_url='https://example.com/img.png',
        image_path='references/img.png',
    )
    assert ref_without.has_analysis() is False


def test_generation_to_dict_includes_all_keys():
    gen = Generation(
        id=1,
        user_id=1,
        book_title='Title',
        author_name='Author',
        aspect_ratio='1:1',
    )
    d = gen.to_dict()

    expected_keys = {
        'id', 'book_title', 'author_name', 'cover_ideas', 'description',
        'genres', 'mood', 'color_preference', 'character_description',
        'keywords', 'style_analysis',
        'style_reference_id', 'cover_template_id', 'use_style_image',
        'base_image_only', 'reference_mode', 'two_step_generation',
        'aspect_ratio', 'aspect_ratio_info',
        'base_prompt', 'text_prompt', 'base_image_url', 'final_image_url',
        'current_step', 'total_steps', 'step_message', 'status',
        'error_message', 'credits_used', 'created_at', 'completed_at',
    }
    assert set(d.keys()) == expected_keys


def test_user_is_admin_default_false():
    user = User(google_id='g1', email='user@example.com', name='User')
    assert user.is_admin is False
