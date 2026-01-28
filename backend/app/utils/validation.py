import re
import logging

logger = logging.getLogger(__name__)

MAX_TITLE_LENGTH = 200
MAX_AUTHOR_LENGTH = 200
MAX_SHORT_TEXT_LENGTH = 500
MAX_LONG_TEXT_LENGTH = 2000
MAX_KEYWORD_LENGTH = 100
MAX_KEYWORDS_COUNT = 20
MAX_GENRES_COUNT = 5

INJECTION_PATTERNS = re.compile(
    r'(?:ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?'
    r'|you\s+are\s+now\s+(?:a|an)\s+'
    r'|system\s*:\s*'
    r'|<\s*(?:script|system|admin)'
    r'|\bDAN\b.*\bjailbreak\b'
    r'|override\s+(?:all\s+)?(?:safety|content|policy))',
    re.IGNORECASE,
)


def sanitize_text(value, max_length=MAX_SHORT_TEXT_LENGTH):
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value:
        return ''
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)
    return value[:max_length]


def sanitize_text_list(values, max_items=MAX_KEYWORDS_COUNT, max_item_length=MAX_KEYWORD_LENGTH):
    if not isinstance(values, list):
        return []
    result = []
    for item in values[:max_items]:
        cleaned = sanitize_text(item, max_length=max_item_length)
        if cleaned:
            result.append(cleaned)
    return result


def check_prompt_injection(text):
    if not text:
        return False
    return bool(INJECTION_PATTERNS.search(text))


def sanitize_generation_data(data):
    sanitized = {}
    sanitized['book_title'] = sanitize_text(
        data.get('book_title', ''), max_length=MAX_TITLE_LENGTH
    )
    sanitized['author_name'] = sanitize_text(
        data.get('author_name', ''), max_length=MAX_AUTHOR_LENGTH
    )
    sanitized['cover_ideas'] = sanitize_text(
        data.get('cover_ideas', ''), max_length=MAX_LONG_TEXT_LENGTH
    )
    sanitized['description'] = sanitize_text(
        data.get('description', ''), max_length=MAX_LONG_TEXT_LENGTH
    )
    sanitized['mood'] = sanitize_text(
        data.get('mood', ''), max_length=MAX_SHORT_TEXT_LENGTH
    )
    sanitized['color_preference'] = sanitize_text(
        data.get('color_preference'), max_length=MAX_SHORT_TEXT_LENGTH
    )
    sanitized['character_description'] = sanitize_text(
        data.get('character_description'), max_length=MAX_LONG_TEXT_LENGTH
    )
    sanitized['genres'] = sanitize_text_list(
        data.get('genres', []), max_items=MAX_GENRES_COUNT, max_item_length=MAX_KEYWORD_LENGTH
    )
    sanitized['keywords'] = sanitize_text_list(
        data.get('keywords', []) or [], max_items=MAX_KEYWORDS_COUNT
    )

    text_fields_to_check = [
        sanitized['book_title'],
        sanitized['author_name'],
        sanitized['cover_ideas'],
        sanitized['description'],
        sanitized['character_description'],
    ]
    for field_value in text_fields_to_check:
        if field_value and check_prompt_injection(field_value):
            logger.warning("Potential prompt injection detected in generation input")
            return None

    return sanitized
