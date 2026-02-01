import json
import logging
import os
import requests
from flask import current_app

from app.services.credit_service import deduct_llm_credit, InsufficientCreditsError

logger = logging.getLogger(__name__)

_prompts_cache = None

STYLE_ANALYSIS_MODEL = 'google/gemini-3-flash-preview'


def _load_prompts():
    global _prompts_cache
    if _prompts_cache is None:
        prompts_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'prompts.json')
        with open(prompts_path, 'r') as f:
            _prompts_cache = json.load(f)
    return _prompts_cache


def get_prompt_schema(name):
    prompts = _load_prompts()
    return prompts['schemas'][name]


def get_prompt(category, key):
    prompts = _load_prompts()
    return prompts['prompts'][category][key]


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


def _build_style_analysis_section(style_analysis, mode='both'):
    if not style_analysis:
        return ""

    if mode == 'text':
        template_key = 'style_analysis_template_text'
        required_keys = ['typography']
    elif mode == 'background':
        template_key = 'style_analysis_template_background'
        required_keys = ['feeling', 'layout', 'illustration_rules']
    else:
        template_key = 'style_analysis_template_both'
        required_keys = ['feeling', 'layout', 'illustration_rules', 'typography']

    has_content = any(style_analysis.get(k) for k in required_keys)
    if not has_content:
        return ""

    template = get_prompt('style_reference', template_key)
    return template.format(
        feeling=style_analysis.get('feeling', ''),
        layout=style_analysis.get('layout', ''),
        illustration_rules=style_analysis.get('illustration_rules', ''),
        typography=style_analysis.get('typography', ''),
    )


class LLMService:

    def __init__(self):
        self.api_key = None
        self.base_url = None

    def _get_config(self):
        if not self.api_key:
            self.api_key = current_app.config['OPENROUTER_API_KEY']
            self.base_url = current_app.config['OPENROUTER_BASE_URL']

    def _make_request(self, messages, schema=None, model='x-ai/grok-4.1-fast', user=None):
        self._get_config()

        if user is not None:
            result = deduct_llm_credit(user)
            if not result['success']:
                raise InsufficientCreditsError(required=1, available=result['remaining'])
            logger.info("Deducted 1 LLM credit for user id=%s", user.id)

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
        import json_repair
        import re

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.debug("Standard JSON parsing failed, attempting repair...")

        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if match:
            extracted = match.group(1)
            try:
                return json.loads(extracted)
            except json.JSONDecodeError:
                try:
                    result = json_repair.loads(extracted)
                    logger.info("JSON repair successful (from code block)")
                    return result
                except Exception:
                    pass

        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            raw_json = match.group(0)
            try:
                return json.loads(raw_json)
            except json.JSONDecodeError:
                try:
                    result = json_repair.loads(raw_json)
                    logger.info("JSON repair successful (from raw extraction)")
                    return result
                except Exception as e:
                    logger.warning("JSON repair failed: %s", e)
                    raise ValueError(f"Could not parse or repair JSON from LLM response: {content[:200]}")

        raise ValueError(f"Could not find JSON in LLM response: {content[:200]}")

    def analyze_style_reference(self, image_url, user=None):
        system_prompt = get_prompt('style_analysis', 'system')
        user_text = get_prompt('style_analysis', 'user_template')

        messages = [
            {'role': 'system', 'content': system_prompt},
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': user_text},
                    {'type': 'image_url', 'image_url': {'url': image_url}},
                ],
            },
        ]

        logger.info("Analyzing style reference image with %s", STYLE_ANALYSIS_MODEL)
        result = self._make_request(
            messages,
            schema=get_prompt_schema('style_analysis'),
            model=STYLE_ANALYSIS_MODEL,
            user=user,
        )
        logger.info("Style analysis complete: suggested_title='%s'", result.get('suggested_title', ''))
        return result

    def detect_text_in_image(self, image_url, user=None):
        system_prompt = get_prompt('text_detection', 'system')
        user_text = get_prompt('text_detection', 'user_template')

        messages = [
            {'role': 'system', 'content': system_prompt},
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': user_text},
                    {'type': 'image_url', 'image_url': {'url': image_url}},
                ],
            },
        ]

        logger.info("Detecting text in image with %s", STYLE_ANALYSIS_MODEL)
        result = self._make_request(
            messages,
            schema=get_prompt_schema('text_detection'),
            model=STYLE_ANALYSIS_MODEL,
            user=user,
        )
        detected_texts = result.get('detected_texts', [])
        logger.info("Text detection complete: found %d text segments", len(detected_texts))
        return detected_texts

    def verify_text_layer(self, image_url, user=None):
        system_prompt = get_prompt('text_layer_verification', 'system')
        user_text = get_prompt('text_layer_verification', 'user_template')

        messages = [
            {'role': 'system', 'content': system_prompt},
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': user_text},
                    {'type': 'image_url', 'image_url': {'url': image_url}},
                ],
            },
        ]

        logger.info("Verifying text layer cleanliness with %s", STYLE_ANALYSIS_MODEL)
        result = self._make_request(
            messages,
            schema=get_prompt_schema('text_layer_verification'),
            model=STYLE_ANALYSIS_MODEL,
            user=user,
        )
        is_clean = result.get('is_clean', True)
        artifacts = result.get('artifacts', [])
        logger.info("Text layer verification: is_clean=%s, artifacts=%d", is_clean, len(artifacts))
        return result

    def generate_base_image_prompt(self, book_data, base_image_only=False, user=None):
        text_rules = get_prompt('base_image', 'text_rules')
        text_rule = text_rules['base_image_only'] if base_image_only else text_rules['standard']
        system_prompt = get_prompt('base_image', 'system').format(text_rule=text_rule)

        book_details = _build_book_details_content(book_data, include_title=not base_image_only)
        user_content = get_prompt('base_image', 'user_template').format(book_details=book_details)

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=get_prompt_schema('cover_prompt'), user=user)
        return result['prompt']

    def generate_text_overlay_prompt(self, book_data, user=None):
        system_prompt = get_prompt('text_overlay', 'system')

        title = book_data.get('book_title', '')
        author = book_data.get('author_name', '')
        genres = ', '.join(book_data.get('genres', []))

        genre_line = f"Genre: {genres}\n" if genres else ""
        cover_ideas_line = f"Cover Ideas: {book_data.get('cover_ideas')}\n" if book_data.get('cover_ideas') else ""

        user_content = get_prompt('text_overlay', 'user_template').format(
            title=title,
            author=author,
            genre_line=genre_line,
            cover_ideas_line=cover_ideas_line
        )

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=get_prompt_schema('cover_prompt'), user=user)
        return result['prompt']

    def generate_style_referenced_prompt(self, book_data, include_text=True, style_analysis=None, reference_mode='both', user=None):
        if include_text:
            system_prompt = get_prompt('style_reference', 'system_with_text')
        else:
            system_prompt = get_prompt('style_reference', 'system_no_text')

        extra_details_parts = []
        prefix = "- " if include_text else ""

        if book_data.get('cover_ideas'):
            extra_details_parts.append(f"{prefix}Cover Ideas: {book_data.get('cover_ideas')}")

        if book_data.get('description'):
            extra_details_parts.append(f"{prefix}Description: {book_data.get('description')}")

        if book_data.get('genres'):
            extra_details_parts.append(f"{prefix}Genre(s): {', '.join(book_data.get('genres', []))}")

        if book_data.get('character_description'):
            extra_details_parts.append(f"{prefix}Main Character: {book_data.get('character_description')}")

        extra_details = "\n".join(extra_details_parts)
        if extra_details:
            extra_details += "\n"

        style_analysis_section = _build_style_analysis_section(style_analysis, mode=reference_mode)

        if include_text:
            user_content = get_prompt('style_reference', 'user_template_with_text').format(
                title=book_data.get('book_title'),
                author=book_data.get('author_name'),
                extra_details=extra_details,
                style_analysis_section=style_analysis_section,
            )
        else:
            user_content = get_prompt('style_reference', 'user_template_no_text').format(
                extra_details=extra_details,
                style_analysis_section=style_analysis_section,
            )

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=get_prompt_schema('cover_prompt'), user=user)
        return result['prompt']

    def generate_style_referenced_prompt_no_text(self, book_data, style_analysis=None, reference_mode='both', user=None):
        return self.generate_style_referenced_prompt(book_data, include_text=False, style_analysis=style_analysis, reference_mode=reference_mode, user=user)

    def generate_simple_text_replacement_prompt(self, book_data, selected_texts, cover_ideas=None, user=None):
        if not selected_texts:
            book_title = book_data.get('book_title', '')
            author_name = book_data.get('author_name', '')
            return f"Replace the text on this book cover with title '{book_title}' and author '{author_name}'. Preserve the existing typography style, fonts, colors, and positioning."

        text_elements_list = []
        for t in selected_texts:
            text_elements_list.append(f"- \"{t.get('text', '')}\" (type: {t.get('text_type', 'unknown')}, position: {t.get('position', 'unknown')})")
        text_elements_formatted = "\n".join(text_elements_list)

        system_prompt = """You generate simple text replacement instructions for book covers.

Given:
1. Text elements currently on a book cover (with their type and position)
2. New book title and author name
3. Optional cover ideas from the user

Generate a clear, concise instruction to replace the text while preserving the typography style.

Rules:
- Replace "title" type text with the new book title
- Replace "author_name" type text with the new author name
- Remove any other text types (tagline, subtitle, series_name, publisher, other) - do not keep or replace them
- If cover_ideas contains relevant context, use it to inform your decisions
- Keep the instruction simple and focused on WHAT text to change, not HOW it should look
- Always emphasize preserving the existing typography style, fonts, colors, and positioning

Output format example:
Replace the text on this book cover while preserving the exact typography style, fonts, colors, effects, and positioning:
- Replace "[original text]" with "[new text]"
- Remove the text "[text to remove]"
Keep all other visual elements unchanged."""

        user_content = f"""Current text elements on the cover:
{text_elements_formatted}

New book details:
- Title: {book_data.get('book_title', '')}
- Author: {book_data.get('author_name', '')}

Cover ideas (for context):
{cover_ideas or "None provided"}

Generate the replacement instruction."""

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, user=user)
        return result

llm_service = LLMService()
