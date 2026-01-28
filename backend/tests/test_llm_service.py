import pytest
from unittest.mock import patch, MagicMock

from app.services.llm_service import LLMService


@pytest.fixture
def llm(app):
    with app.app_context():
        app.config['OPENROUTER_API_KEY'] = 'test-key'
        app.config['OPENROUTER_BASE_URL'] = 'https://test.openrouter.ai/api/v1'
        service = LLMService()
        yield service


@pytest.fixture
def book_data():
    return {
        'book_title': 'The Dragon King',
        'author_name': 'Jane Doe',
        'cover_ideas': 'A majestic dragon on a mountain',
        'description': 'Epic fantasy adventure',
        'genres': ['Fantasy', 'Adventure'],
        'mood': 'epic',
        'color_preference': 'blue and gold',
        'character_description': 'Tall warrior with silver armor',
        'keywords': ['dragon', 'mountain'],
    }


class TestGenerateBaseImagePrompt:

    @patch.object(LLMService, '_make_request')
    def test_returns_prompt_string(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'A majestic dragon soaring'}

        result = llm.generate_base_image_prompt(book_data)

        assert result == 'A majestic dragon soaring'
        mock_request.assert_called_once()

    @patch.object(LLMService, '_make_request')
    def test_includes_book_title_in_user_content(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_base_image_prompt(book_data)

        call_args = mock_request.call_args
        messages = call_args[0][0]
        user_content = messages[1]['content']
        assert 'The Dragon King' in user_content

    @patch.object(LLMService, '_make_request')
    def test_includes_genres(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_base_image_prompt(book_data)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'Fantasy' in user_content
        assert 'Adventure' in user_content

    @patch.object(LLMService, '_make_request')
    def test_includes_character_description(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_base_image_prompt(book_data)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'silver armor' in user_content

    @patch.object(LLMService, '_make_request')
    def test_base_image_only_excludes_title_from_user_content(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'no text image'}

        llm.generate_base_image_prompt(book_data, base_image_only=True)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'The Dragon King' not in user_content

    @patch.object(LLMService, '_make_request')
    def test_base_image_only_system_prompt_forbids_text(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_base_image_prompt(book_data, base_image_only=True)

        messages = mock_request.call_args[0][0]
        system_prompt = messages[0]['content']
        assert 'zero text' in system_prompt.lower() or 'no text' in system_prompt.lower()

    @patch.object(LLMService, '_make_request')
    def test_omits_empty_optional_fields(self, mock_request, llm):
        mock_request.return_value = {'prompt': 'minimal'}
        minimal_data = {
            'book_title': 'Simple',
            'author_name': 'Author',
        }

        llm.generate_base_image_prompt(minimal_data)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'Genre' not in user_content
        assert 'Character' not in user_content
        assert 'Description' not in user_content


class TestGenerateTextOverlayPrompt:

    @patch.object(LLMService, '_make_request')
    def test_returns_prompt_string(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'Bold title at top'}

        result = llm.generate_text_overlay_prompt(book_data)

        assert result == 'Bold title at top'

    @patch.object(LLMService, '_make_request')
    def test_includes_title_and_author(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_text_overlay_prompt(book_data)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'The Dragon King' in user_content
        assert 'Jane Doe' in user_content

    @patch.object(LLMService, '_make_request')
    def test_includes_genre(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_text_overlay_prompt(book_data)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'Fantasy' in user_content


class TestGenerateStyleReferencedPrompt:

    @patch.object(LLMService, '_make_request')
    def test_returns_prompt_string(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'A styled cover'}

        result = llm.generate_style_referenced_prompt(book_data)

        assert result == 'A styled cover'

    @patch.object(LLMService, '_make_request')
    def test_includes_book_details(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_style_referenced_prompt(book_data)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'The Dragon King' in user_content
        assert 'Jane Doe' in user_content

    @patch.object(LLMService, '_make_request')
    def test_system_prompt_includes_style_reference_instructions(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_style_referenced_prompt(book_data)

        messages = mock_request.call_args[0][0]
        system_prompt = messages[0]['content']
        assert 'style reference' in system_prompt.lower() or 'reference image' in system_prompt.lower()


class TestGenerateStyleReferencedPromptNoText:

    @patch.object(LLMService, '_make_request')
    def test_returns_prompt_string(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'Image only styled'}

        result = llm.generate_style_referenced_prompt_no_text(book_data)

        assert result == 'Image only styled'

    @patch.object(LLMService, '_make_request')
    def test_system_prompt_forbids_text(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_style_referenced_prompt_no_text(book_data)

        messages = mock_request.call_args[0][0]
        system_prompt = messages[0]['content']
        assert 'do not include any text' in system_prompt.lower() or 'text-free' in system_prompt.lower()


class TestAnalyzeStyleReference:

    @patch.object(LLMService, '_make_request')
    def test_returns_analysis_dict(self, mock_request, llm):
        mock_request.return_value = {
            'feeling': 'Dark and mysterious',
            'layout': 'Central symmetry',
            'illustration_rules': 'Oil painting style',
            'typography': 'Bold serif title',
            'suggested_title': 'Gothic Romance',
        }

        result = llm.analyze_style_reference('https://example.com/image.jpg')

        assert result['feeling'] == 'Dark and mysterious'
        assert result['layout'] == 'Central symmetry'
        assert result['illustration_rules'] == 'Oil painting style'
        assert result['typography'] == 'Bold serif title'
        assert result['suggested_title'] == 'Gothic Romance'

    @patch.object(LLMService, '_make_request')
    def test_uses_gemini_model(self, mock_request, llm):
        mock_request.return_value = {
            'feeling': 'test',
            'layout': 'test',
            'illustration_rules': 'test',
            'typography': 'test',
            'suggested_title': 'Test Style',
        }

        llm.analyze_style_reference('https://example.com/image.jpg')

        call_kwargs = mock_request.call_args[1]
        assert 'gemini' in call_kwargs['model'].lower()

    @patch.object(LLMService, '_make_request')
    def test_sends_image_in_vision_format(self, mock_request, llm):
        mock_request.return_value = {
            'feeling': 'test',
            'layout': 'test',
            'illustration_rules': 'test',
            'typography': 'test',
            'suggested_title': 'Test',
        }

        llm.analyze_style_reference('https://example.com/image.jpg')

        messages = mock_request.call_args[0][0]
        user_message = messages[1]
        assert user_message['role'] == 'user'
        assert isinstance(user_message['content'], list)
        content_types = [c['type'] for c in user_message['content']]
        assert 'text' in content_types
        assert 'image_url' in content_types


class TestStyleReferencedPromptWithAnalysis:

    @patch.object(LLMService, '_make_request')
    def test_includes_style_analysis_in_prompt(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'styled cover'}
        style_analysis = {
            'feeling': 'Whimsical and magical',
            'layout': 'Rule of thirds',
            'illustration_rules': 'Watercolor texture',
            'typography': 'Handwritten script',
        }

        llm.generate_style_referenced_prompt(book_data, style_analysis=style_analysis)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'Whimsical and magical' in user_content
        assert 'Rule of thirds' in user_content
        assert 'Watercolor texture' in user_content
        assert 'Handwritten script' in user_content

    @patch.object(LLMService, '_make_request')
    def test_works_without_analysis(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'styled cover'}

        result = llm.generate_style_referenced_prompt(book_data, style_analysis=None)

        assert result == 'styled cover'

    @patch.object(LLMService, '_make_request')
    def test_no_text_variant_includes_analysis(self, mock_request, llm, book_data):
        mock_request.return_value = {'prompt': 'styled cover'}
        style_analysis = {
            'feeling': 'Dark fantasy',
            'layout': 'Top-heavy',
            'illustration_rules': 'Digital painting',
            'typography': 'Gothic serif',
        }

        llm.generate_style_referenced_prompt_no_text(book_data, style_analysis=style_analysis)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'Dark fantasy' in user_content
