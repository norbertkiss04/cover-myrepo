import re
from copy import deepcopy

from app.models.generation import ASPECT_RATIOS
from app.utils.validation import sanitize_text

MAX_TEMPLATE_NAME_LENGTH = 120

HEX_COLOR_RE = re.compile(r'^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$')

TEMPLATE_FONT_FAMILIES = {
    'Space Grotesk': "'Space Grotesk', sans-serif",
    'DM Sans': "'DM Sans', sans-serif",
    'Playfair Display': "'Playfair Display', serif",
    'Merriweather': "'Merriweather', serif",
    'Bebas Neue': "'Bebas Neue', sans-serif",
    'Oswald': "'Oswald', sans-serif",
    'Inter': "'Inter', sans-serif",
    'Manrope': "'Manrope', sans-serif",
    'Montserrat': "'Montserrat', sans-serif",
    'Lora': "'Lora', serif",
    'Cormorant Garamond': "'Cormorant Garamond', serif",
    'Libre Baskerville': "'Libre Baskerville', serif",
    'Cinzel': "'Cinzel', serif",
    'Abril Fatface': "'Abril Fatface', serif",
}

DEFAULT_TEMPLATE_BOX = {
    'x': 8.0,
    'y': 8.0,
    'width': 84.0,
    'height': 22.0,
    'font_family': 'Space Grotesk',
    'font_size': 124,
    'font_weight': 700,
    'font_color': '#FFFFFF',
    'text_align': 'center',
    'line_height': 1.05,
    'letter_spacing': 0.0,
    'uppercase': False,
    'italic': False,
    'shadow_color': '#00000099',
    'shadow_blur': 8,
    'shadow_x': 0,
    'shadow_y': 2,
    'opacity': 1.0,
}

DEFAULT_TITLE_BOX = {
    **DEFAULT_TEMPLATE_BOX,
    'y': 9.0,
    'height': 24.0,
    'font_size': 128,
}

DEFAULT_AUTHOR_BOX = {
    **DEFAULT_TEMPLATE_BOX,
    'y': 80.0,
    'height': 12.0,
    'font_size': 62,
    'font_weight': 600,
    'uppercase': True,
    'letter_spacing': 1.4,
}

ALLOWED_TEXT_ALIGN = {'left', 'center', 'right'}


def _parse_float(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return float(stripped)
        except ValueError:
            return None
    return None


def _parse_int(value):
    parsed = _parse_float(value)
    if parsed is None:
        return None
    return int(round(parsed))


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    return None


def _parse_color(value):
    if not isinstance(value, str):
        return None
    color = value.strip()
    if not HEX_COLOR_RE.fullmatch(color):
        return None
    return color.upper()


def _validate_range(value, min_value, max_value):
    return min_value <= value <= max_value


def normalize_template_box(raw_box):
    if raw_box is None:
        raw_box = {}

    if not isinstance(raw_box, dict):
        return None, 'must be an object'

    x = _parse_float(raw_box.get('x', DEFAULT_TEMPLATE_BOX['x']))
    y = _parse_float(raw_box.get('y', DEFAULT_TEMPLATE_BOX['y']))
    width = _parse_float(raw_box.get('width', DEFAULT_TEMPLATE_BOX['width']))
    height = _parse_float(raw_box.get('height', DEFAULT_TEMPLATE_BOX['height']))

    if x is None or y is None or width is None or height is None:
        return None, 'position and size values must be numbers'

    if not _validate_range(x, 0, 100) or not _validate_range(y, 0, 100):
        return None, 'x and y must be between 0 and 100'

    if not _validate_range(width, 5, 100) or not _validate_range(height, 5, 100):
        return None, 'width and height must be between 5 and 100'

    font_family = raw_box.get('font_family', DEFAULT_TEMPLATE_BOX['font_family'])
    if not isinstance(font_family, str) or font_family not in TEMPLATE_FONT_FAMILIES:
        return None, f'font_family must be one of {list(TEMPLATE_FONT_FAMILIES.keys())}'

    font_size = _parse_int(raw_box.get('font_size', DEFAULT_TEMPLATE_BOX['font_size']))
    font_weight = _parse_int(raw_box.get('font_weight', DEFAULT_TEMPLATE_BOX['font_weight']))
    if font_size is None or font_weight is None:
        return None, 'font_size and font_weight must be numbers'

    if not _validate_range(font_size, 8, 400):
        return None, 'font_size must be between 8 and 400'

    if font_weight not in {100, 200, 300, 400, 500, 600, 700, 800, 900}:
        return None, 'font_weight must be one of 100..900'

    font_color = _parse_color(raw_box.get('font_color', DEFAULT_TEMPLATE_BOX['font_color']))
    if font_color is None:
        return None, 'font_color must be a HEX color'

    text_align = raw_box.get('text_align', DEFAULT_TEMPLATE_BOX['text_align'])
    if text_align not in ALLOWED_TEXT_ALIGN:
        return None, "text_align must be one of ['left', 'center', 'right']"

    line_height = _parse_float(raw_box.get('line_height', DEFAULT_TEMPLATE_BOX['line_height']))
    letter_spacing = _parse_float(raw_box.get('letter_spacing', DEFAULT_TEMPLATE_BOX['letter_spacing']))
    if line_height is None or letter_spacing is None:
        return None, 'line_height and letter_spacing must be numbers'

    if not _validate_range(line_height, 0.8, 3.0):
        return None, 'line_height must be between 0.8 and 3.0'

    if not _validate_range(letter_spacing, -10, 20):
        return None, 'letter_spacing must be between -10 and 20'

    uppercase = _parse_bool(raw_box.get('uppercase', DEFAULT_TEMPLATE_BOX['uppercase']))
    italic = _parse_bool(raw_box.get('italic', DEFAULT_TEMPLATE_BOX['italic']))
    if uppercase is None or italic is None:
        return None, 'uppercase and italic must be booleans'

    shadow_color = _parse_color(raw_box.get('shadow_color', DEFAULT_TEMPLATE_BOX['shadow_color']))
    if shadow_color is None:
        return None, 'shadow_color must be a HEX color'

    shadow_blur = _parse_int(raw_box.get('shadow_blur', DEFAULT_TEMPLATE_BOX['shadow_blur']))
    shadow_x = _parse_int(raw_box.get('shadow_x', DEFAULT_TEMPLATE_BOX['shadow_x']))
    shadow_y = _parse_int(raw_box.get('shadow_y', DEFAULT_TEMPLATE_BOX['shadow_y']))
    if shadow_blur is None or shadow_x is None or shadow_y is None:
        return None, 'shadow_blur, shadow_x and shadow_y must be numbers'

    if not _validate_range(shadow_blur, 0, 60):
        return None, 'shadow_blur must be between 0 and 60'
    if not _validate_range(shadow_x, -40, 40) or not _validate_range(shadow_y, -40, 40):
        return None, 'shadow_x and shadow_y must be between -40 and 40'

    opacity = _parse_float(raw_box.get('opacity', DEFAULT_TEMPLATE_BOX['opacity']))
    if opacity is None or not _validate_range(opacity, 0, 1):
        return None, 'opacity must be between 0 and 1'

    if x + width > 100:
        x = max(0.0, 100.0 - width)
    if y + height > 100:
        y = max(0.0, 100.0 - height)

    normalized = {
        'x': round(x, 3),
        'y': round(y, 3),
        'width': round(width, 3),
        'height': round(height, 3),
        'font_family': font_family,
        'font_size': font_size,
        'font_weight': font_weight,
        'font_color': font_color,
        'text_align': text_align,
        'line_height': round(line_height, 3),
        'letter_spacing': round(letter_spacing, 3),
        'uppercase': uppercase,
        'italic': italic,
        'shadow_color': shadow_color,
        'shadow_blur': shadow_blur,
        'shadow_x': shadow_x,
        'shadow_y': shadow_y,
        'opacity': round(opacity, 3),
    }
    return normalized, None


def normalize_template_payload(data, require_name=True, require_aspect_ratio=False, allow_partial=False):
    if not isinstance(data, dict):
        return None, 'Invalid payload'

    payload = {}

    if 'name' in data or require_name:
        name = sanitize_text(data.get('name'), max_length=MAX_TEMPLATE_NAME_LENGTH)
        if not name:
            return None, 'name is required'
        payload['name'] = name

    if 'aspect_ratio' in data or require_aspect_ratio:
        aspect_ratio = data.get('aspect_ratio')
        if not isinstance(aspect_ratio, str) or aspect_ratio not in ASPECT_RATIOS:
            return None, f'aspect_ratio must be one of {list(ASPECT_RATIOS.keys())}'
        payload['aspect_ratio'] = aspect_ratio

    if 'title_box' in data or (not allow_partial):
        title_box, title_error = normalize_template_box(data.get('title_box', DEFAULT_TITLE_BOX))
        if title_error:
            return None, f'title_box {title_error}'
        payload['title_box'] = title_box

    if 'author_box' in data or (not allow_partial):
        author_box, author_error = normalize_template_box(data.get('author_box', DEFAULT_AUTHOR_BOX))
        if author_error:
            return None, f'author_box {author_error}'
        payload['author_box'] = author_box

    if not payload:
        return None, 'No valid fields provided'

    return payload, None


def get_default_template_payload(aspect_ratio='2:3'):
    if aspect_ratio not in ASPECT_RATIOS:
        aspect_ratio = '2:3'

    return {
        'name': 'Untitled Template',
        'aspect_ratio': aspect_ratio,
        'title_box': deepcopy(DEFAULT_TITLE_BOX),
        'author_box': deepcopy(DEFAULT_AUTHOR_BOX),
    }
