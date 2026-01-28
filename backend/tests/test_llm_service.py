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


@pytest.fixture
def style_analysis():
    return {
        'title': 'Epic Fantasy',
        'feeling': 'grand and majestic',
        'layout': 'centered focal point',
        'illustration_rules': 'digital painting, high contrast',
        'typography': 'bold serif with embossing',
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
    def test_includes_style_analysis_when_provided(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'styled prompt'}

        llm.generate_base_image_prompt(book_data, style_analysis=style_analysis)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'grand and majestic' in user_content
        assert 'centered focal point' in user_content
        assert 'digital painting' in user_content

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

    @patch.object(LLMService, '_make_request')
    def test_includes_typography_from_style_analysis(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'styled text'}

        llm.generate_text_overlay_prompt(book_data, style_analysis=style_analysis)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'bold serif with embossing' in user_content


class TestGenerateStyleReferencedPrompt:

    @patch.object(LLMService, '_make_request')
    def test_returns_prompt_string(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'A styled cover'}

        result = llm.generate_style_referenced_prompt(book_data, style_analysis)

        assert result == 'A styled cover'

    @patch.object(LLMService, '_make_request')
    def test_includes_book_details(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_style_referenced_prompt(book_data, style_analysis)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'The Dragon King' in user_content
        assert 'Jane Doe' in user_content

    @patch.object(LLMService, '_make_request')
    def test_includes_style_analysis_fields(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_style_referenced_prompt(book_data, style_analysis)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'grand and majestic' in user_content
        assert 'centered focal point' in user_content
        assert 'digital painting' in user_content
        assert 'bold serif with embossing' in user_content

    @patch.object(LLMService, '_make_request')
    def test_system_prompt_includes_text_instructions(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_style_referenced_prompt(book_data, style_analysis)

        messages = mock_request.call_args[0][0]
        system_prompt = messages[0]['content']
        assert 'title and author name' in system_prompt.lower() or 'text elements' in system_prompt.lower()


class TestGenerateStyleReferencedPromptNoText:

    @patch.object(LLMService, '_make_request')
    def test_returns_prompt_string(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'Image only styled'}

        result = llm.generate_style_referenced_prompt_no_text(book_data, style_analysis)

        assert result == 'Image only styled'

    @patch.object(LLMService, '_make_request')
    def test_system_prompt_forbids_text(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_style_referenced_prompt_no_text(book_data, style_analysis)

        messages = mock_request.call_args[0][0]
        system_prompt = messages[0]['content']
        assert 'do not include any text' in system_prompt.lower() or 'text-free' in system_prompt.lower()

    @patch.object(LLMService, '_make_request')
    def test_does_not_include_typography(self, mock_request, llm, book_data, style_analysis):
        mock_request.return_value = {'prompt': 'test'}

        llm.generate_style_referenced_prompt_no_text(book_data, style_analysis)

        messages = mock_request.call_args[0][0]
        user_content = messages[1]['content']
        assert 'bold serif with embossing' not in user_content


class TestAnalyzeStyleReference:

    @patch.object(LLMService, '_make_request')
    def test_returns_analysis_dict(self, mock_request, llm):
        expected = {
            'title': 'Gothic',
            'feeling': 'dark',
            'layout': 'centered',
            'illustration_rules': 'ink wash',
            'typography': 'blackletter',
        }
        mock_request.return_value = expected

        result = llm.analyze_style_reference('data:image/png;base64,abc123')

        assert result == expected
        mock_request.assert_called_once()

    @patch.object(LLMService, '_make_request')
    def test_passes_image_url_in_messages(self, mock_request, llm):
        mock_request.return_value = {
            'title': 'T', 'feeling': 'F', 'layout': 'L',
            'illustration_rules': 'I', 'typography': 'T',
        }
        data_url = 'data:image/jpeg;base64,/9j/fake'

        llm.analyze_style_reference(data_url)

        messages = mock_request.call_args[0][0]
        image_content = messages[0]['content'][0]
        assert image_content['type'] == 'image_url'
        assert image_content['image_url']['url'] == data_url

    @patch.object(LLMService, '_make_request')
    def test_uses_gemini_model(self, mock_request, llm):
        mock_request.return_value = {
            'title': 'T', 'feeling': 'F', 'layout': 'L',
            'illustration_rules': 'I', 'typography': 'T',
        }

        llm.analyze_style_reference('data:image/png;base64,abc')

        call_kwargs = mock_request.call_args
        assert call_kwargs[1]['model'] == 'google/gemini-3-flash-preview'
