import json
import logging
import requests
from flask import current_app

logger = logging.getLogger(__name__)

PROMPT_SCHEMA = {
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

_BASE_IMAGE_SYSTEM_PROMPT = """You are an expert book cover designer. Your task is to create a detailed 
image generation prompt for a book cover illustration. 

IMPORTANT RULES:
1. {text_rule}
2. Focus on visual elements: composition, colors, mood, key imagery
3. Be specific about style, lighting, and atmosphere
4. Consider the genre conventions for book covers
5. NEVER include nudity, exposed intimate body parts, or explicit sexual acts in the prompt — even for erotic or romance genres, keep all figures clothed or tastefully obscured (e.g. silhouettes, draped fabric, suggestive but covered poses)
6. Keep the prompt under 500 characters for best results
7. Return your response as JSON with a single "prompt" field containing the image prompt"""

_TEXT_RULE_BASE_IMAGE_ONLY = "DO NOT include any text, titles, author names, words, letters, or typography in the image — the image must be purely visual with zero text"
_TEXT_RULE_STANDARD = "DO NOT include any text, titles, or author names in the image prompt - this will be added later"

_STYLE_REF_SYSTEM_PROMPT_WITH_TEXT = """You are an expert book cover designer. You will be given details about a new book 
and a reference image will be provided alongside your prompt to the image generation model.

Your task is to create a SINGLE, comprehensive image generation prompt that:
1. Describes the new book cover's visual content (imagery, composition, colors, mood)
2. INCLUDES the book title and author name as text elements on the cover
3. Specifies typography style, placement, and hierarchy for the title and author name
4. Uses the reference image for visual style only — create new imagery appropriate for the book
5. NEVER include nudity, exposed intimate body parts, or explicit sexual acts in the prompt — even for erotic or romance genres, keep all figures clothed or tastefully obscured (e.g. silhouettes, draped fabric, suggestive but covered poses)
6. Keep the prompt under 800 characters for best results
7. Return your response as JSON with a single "prompt" field"""

_STYLE_REF_SYSTEM_PROMPT_NO_TEXT = """You are an expert book cover designer. You will be given details about a new book 
and a reference image will be provided alongside your prompt to the image generation model.

Your task is to create a SINGLE, comprehensive image generation prompt that:
1. Describes the new book cover's visual content (imagery, composition, colors, mood)
2. DO NOT include any text, titles, or author names in the image — this is a text-free illustration
3. Uses the reference image for visual style only — create new imagery appropriate for the book
4. NEVER include nudity, exposed intimate body parts, or explicit sexual acts in the prompt — even for erotic or romance genres, keep all figures clothed or tastefully obscured (e.g. silhouettes, draped fabric, suggestive but covered poses)
5. Keep the prompt under 800 characters for best results
6. Return your response as JSON with a single "prompt" field"""


def _build_book_details_content(book_data, include_title=True):
    parts = []

    if include_title and book_data.get('book_title'):
        parts.append(f"Title: {book_data.get('book_title')}")

    if book_data.get('cover_ideas'):
        parts.append(f"Cover Ideas (author's vision): {book_data.get('cover_ideas')}")

    if book_data.get('description'):
        parts.append(f"Description: {book_data.get('description')}")

    if book_data.get('genres'):
        parts.append(f"Genre(s): {', '.join(book_data.get('genres', []))}")

    if book_data.get('character_description'):
        parts.append(f"Main Character: {book_data.get('character_description')}")

    return "\n".join(parts)


class LLMService:

    def __init__(self):
        self.api_key = None
        self.base_url = None

    def _get_config(self):
        if not self.api_key:
            self.api_key = current_app.config['OPENROUTER_API_KEY']
            self.base_url = current_app.config['OPENROUTER_BASE_URL']

    def _make_request(self, messages, schema=None, model='x-ai/grok-4.1-fast'):
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
            parsed = self._parse_json(content)
            logger.info(f"LLM returned structured response with keys: {list(parsed.keys())}")
            return parsed

        return content

    def _parse_json(self, content):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            import re
            match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
            if match:
                return json.loads(match.group(1))
            match = re.search(r'\{[\s\S]*\}', content)
            if match:
                return json.loads(match.group(0))
            raise ValueError(f"Could not parse JSON from LLM response: {content[:200]}")

    def generate_base_image_prompt(self, book_data, base_image_only=False):
        text_rule = _TEXT_RULE_BASE_IMAGE_ONLY if base_image_only else _TEXT_RULE_STANDARD
        system_prompt = _BASE_IMAGE_SYSTEM_PROMPT.format(text_rule=text_rule)

        user_content = "Create an image generation prompt for a book cover with these details:\n"
        user_content += _build_book_details_content(book_data, include_title=not base_image_only)

        user_content += "\n\nGenerate the image prompt now:"

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=PROMPT_SCHEMA)
        return result['prompt']

    def generate_text_overlay_prompt(self, book_data):
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

        user_content = f"""Add text to a book cover with these specifications:

Book Title: "{title}"
Author Name: "{author}"
"""

        if genres:
            user_content += f"Genre: {genres}\n"

        if book_data.get('cover_ideas'):
            user_content += f"Cover Ideas: {book_data.get('cover_ideas')}\n"

        user_content += """
The text should be:
- Title prominently displayed
- Author name in a complementary but smaller style
- Positioned for maximum visual impact and readability
"""

        user_content += "\nGenerate the text overlay prompt now:"

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=PROMPT_SCHEMA)
        return result['prompt']

    def generate_style_referenced_prompt(self, book_data, include_text=True):
        system_prompt = _STYLE_REF_SYSTEM_PROMPT_WITH_TEXT if include_text else _STYLE_REF_SYSTEM_PROMPT_NO_TEXT

        if include_text:
            user_content = f"""Create a book cover image prompt using the reference image's style.

Book Details:
- Title: "{book_data.get('book_title')}"
- Author: "{book_data.get('author_name')}"
"""
        else:
            user_content = "Create a book cover illustration prompt using the reference image's style.\n"

        if book_data.get('cover_ideas'):
            prefix = "- " if include_text else ""
            user_content += f"{prefix}Cover Ideas: {book_data.get('cover_ideas')}\n"

        if book_data.get('description'):
            prefix = "- " if include_text else ""
            user_content += f"{prefix}Description: {book_data.get('description')}\n"

        if book_data.get('genres'):
            prefix = "- " if include_text else ""
            user_content += f"{prefix}Genre(s): {', '.join(book_data.get('genres', []))}\n"

        if book_data.get('character_description'):
            prefix = "- " if include_text else ""
            user_content += f"{prefix}Main Character: {book_data.get('character_description')}\n"

        if include_text:
            user_content += f"""
Generate a single prompt that creates this book cover in the style of the reference image. 
The title "{book_data.get('book_title')}" and author "{book_data.get('author_name')}" must appear as text on the cover.
Use the reference image for style only — do NOT copy its subject matter."""
        else:
            user_content += """
Generate a single prompt that creates this illustration in the style of the reference image. 
Do NOT include any text, titles, or lettering in the image.
Use the reference image for style only — do NOT copy its subject matter."""

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=PROMPT_SCHEMA)
        return result['prompt']

    def generate_style_referenced_prompt_no_text(self, book_data):
        return self.generate_style_referenced_prompt(book_data, include_text=False)

llm_service = LLMService()
