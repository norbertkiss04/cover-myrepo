import json
import logging
import requests
from flask import current_app

logger = logging.getLogger(__name__)

# JSON schemas for structured output
BASE_PROMPT_SCHEMA = {
    "name": "cover_prompt",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "title": "Cover Image Prompt",
            },
        },
        "required": ["prompt"],
        "additionalProperties": False,
    },
}

TEXT_OVERLAY_SCHEMA = {
    "name": "text_overlay_prompt",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "title": "Text Overlay Prompt",
            },
        },
        "required": ["prompt"],
        "additionalProperties": False,
    },
}


class LLMService:
    """Service for interacting with OpenRouter LLM API."""

    def __init__(self):
        self.api_key = None
        self.base_url = None

    def _get_config(self):
        """Get configuration from Flask app context."""
        if not self.api_key:
            self.api_key = current_app.config['OPENROUTER_API_KEY']
            self.base_url = current_app.config['OPENROUTER_BASE_URL']

    def _make_request(self, messages, schema=None, model='x-ai/grok-4.1-fast'):
        """Make a request to OpenRouter API with optional structured JSON output."""
        self._get_config()

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://instacover.app',
            'X-Title': 'InstaCover'
        }

        payload = {
            'model': model,
            'messages': messages,
            'temperature': 0.7,
            'max_tokens': 2000,
        }

        if schema:
            payload['response_format'] = {
                'type': 'json_schema',
                'json_schema': schema,
            }

        logger.info(f"Making LLM request to {model}")

        response = requests.post(
            f'{self.base_url}/chat/completions',
            headers=headers,
            json=payload,
            timeout=120
        )

        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']

        if schema:
            # Parse structured JSON response
            parsed = self._parse_json(content)
            logger.info(f"LLM returned structured response with keys: {list(parsed.keys())}")
            return parsed

        return content

    def _parse_json(self, content):
        """Parse JSON from LLM response, handling edge cases."""
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            import re
            match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
            if match:
                return json.loads(match.group(1))
            # Try to find JSON object in the response
            match = re.search(r'\{[\s\S]*\}', content)
            if match:
                return json.loads(match.group(0))
            raise ValueError(f"Could not parse JSON from LLM response: {content[:200]}")

    def generate_base_image_prompt(self, book_data):
        """
        Generate a prompt for the base book cover image (without text).

        Args:
            book_data: dict with book_title, author_name, summary, genres, mood,
                      color_preference, character_description, keywords,
                      reference_image_description

        Returns:
            str: The image generation prompt
        """
        system_prompt = """You are an expert book cover designer. Your task is to create a detailed 
image generation prompt for a book cover illustration. 

IMPORTANT RULES:
1. DO NOT include any text, titles, or author names in the image prompt - this will be added later
2. Focus on visual elements: composition, colors, mood, key imagery
3. Be specific about style, lighting, and atmosphere
4. Consider the genre conventions for book covers
5. Keep the prompt under 500 characters for best results
6. Return your response as JSON with a single "prompt" field containing the image prompt"""

        user_content = f"""Create an image generation prompt for a book cover with these details:

Title: {book_data.get('book_title')}
Genre(s): {', '.join(book_data.get('genres', []))}
Mood/Atmosphere: {book_data.get('mood')}
Summary: {book_data.get('summary')}
"""

        if book_data.get('color_preference'):
            user_content += f"Color Preference: {book_data.get('color_preference')}\n"

        if book_data.get('character_description'):
            user_content += f"Main Character: {book_data.get('character_description')}\n"

        if book_data.get('keywords'):
            user_content += f"Key Elements: {', '.join(book_data.get('keywords', []))}\n"

        if book_data.get('reference_image_description'):
            user_content += f"Style Reference: {book_data.get('reference_image_description')}\n"

        user_content += "\nGenerate the image prompt now:"

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=BASE_PROMPT_SCHEMA)
        return result['prompt']

    def generate_text_overlay_prompt(self, book_data, base_image_description=None):
        """
        Generate a prompt for adding text (title, author) to the cover.

        Args:
            book_data: dict with book_title, author_name, genres, mood
            base_image_description: optional description of the base image

        Returns:
            str: The text overlay prompt
        """
        system_prompt = """You are an expert in book cover typography and design. Your task is to create 
a detailed prompt for adding text to a book cover image.

IMPORTANT RULES:
1. Specify exact text to add (title and author name)
2. Describe font style, size relationships, and positioning
3. Consider genre-appropriate typography (e.g., fantasy = ornate, thriller = bold)
4. Ensure text placement has good contrast and readability
5. Keep the prompt clear and actionable
6. Return your response as JSON with a single "prompt" field containing the text overlay prompt"""

        title = book_data.get('book_title', '')
        author = book_data.get('author_name', '')
        genres = ', '.join(book_data.get('genres', []))
        mood = book_data.get('mood', '')

        user_content = f"""Add text to a book cover with these specifications:

Book Title: "{title}"
Author Name: "{author}"
Genre: {genres}
Cover Mood: {mood}

The text should be:
- Title prominently displayed
- Author name in a complementary but smaller style
- Positioned for maximum visual impact and readability

Generate the text overlay prompt now:"""

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=TEXT_OVERLAY_SCHEMA)
        return result['prompt']


# Singleton instance
llm_service = LLMService()
