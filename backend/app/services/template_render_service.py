import html
import logging

from app.models.generation import ASPECT_RATIOS
from app.utils.template_validation import TEMPLATE_FONT_FAMILIES

logger = logging.getLogger(__name__)

GOOGLE_FONTS_HREF = (
    'https://fonts.googleapis.com/css2?'
    'family=Space+Grotesk:wght@400;500;600;700;800;900&'
    'family=DM+Sans:wght@400;500;600;700;800&'
    'family=Playfair+Display:wght@400;500;600;700;800;900&'
    'family=Merriweather:wght@300;400;700;900&'
    'family=Bebas+Neue&'
    'family=Oswald:wght@300;400;500;600;700&'
    'family=Inter:wght@400;500;600;700;800;900&'
    'family=Manrope:wght@400;500;600;700;800&'
    'family=Montserrat:wght@400;500;600;700;800;900&'
    'family=Lora:wght@400;500;600;700&'
    'family=Cormorant+Garamond:wght@400;500;600;700&'
    'family=Libre+Baskerville:wght@400;700&'
    'family=Cinzel:wght@400;500;600;700;800&'
    'family=Abril+Fatface&display=swap'
)


def _normalize_box_for_render(box):
    if not isinstance(box, dict):
        return {}
    return box


def _resolve_text_shadow(box):
    shadow_x = int(box.get('shadow_x', 0))
    shadow_y = int(box.get('shadow_y', 0))
    shadow_blur = int(box.get('shadow_blur', 0))
    shadow_color = box.get('shadow_color', '#00000000')
    return f'{shadow_x}px {shadow_y}px {shadow_blur}px {shadow_color}'


def _build_box_css(box):
    normalized = _normalize_box_for_render(box)
    text_align = normalized.get('text_align', 'center')

    if text_align == 'left':
        justify_content = 'flex-start'
    elif text_align == 'right':
        justify_content = 'flex-end'
    else:
        justify_content = 'center'

    font_family_name = normalized.get('font_family', 'Space Grotesk')
    font_stack = TEMPLATE_FONT_FAMILIES.get(font_family_name, TEMPLATE_FONT_FAMILIES['Space Grotesk'])
    text_transform = 'uppercase' if normalized.get('uppercase') else 'none'
    font_style = 'italic' if normalized.get('italic') else 'normal'

    return (
        f"left:{float(normalized.get('x', 0))}%;"
        f"top:{float(normalized.get('y', 0))}%;"
        f"width:{float(normalized.get('width', 100))}%;"
        f"height:{float(normalized.get('height', 20))}%;"
        f"color:{normalized.get('font_color', '#FFFFFF')};"
        f"font-family:{font_stack};"
        f"font-size:{int(normalized.get('font_size', 64))}px;"
        f"font-weight:{int(normalized.get('font_weight', 700))};"
        f"text-align:{text_align};"
        f"line-height:{float(normalized.get('line_height', 1.1))};"
        f"letter-spacing:{float(normalized.get('letter_spacing', 0))}px;"
        f"text-transform:{text_transform};"
        f"font-style:{font_style};"
        f"opacity:{float(normalized.get('opacity', 1))};"
        f"text-shadow:{_resolve_text_shadow(normalized)};"
        f"justify-content:{justify_content};"
    )


def _build_html(base_image_url, width, height, title_box, author_box, book_title, author_name):
    title_text = html.escape(book_title or '')
    author_text = html.escape(author_name or '')

    title_css = _build_box_css(title_box)
    author_css = _build_box_css(author_box)

    return f"""
<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />
    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />
    <link href=\"{GOOGLE_FONTS_HREF}\" rel=\"stylesheet\" />
    <style>
      html, body {{
        margin: 0;
        width: {width}px;
        height: {height}px;
        overflow: hidden;
        background: #000;
      }}
      #canvas {{
        position: relative;
        width: {width}px;
        height: {height}px;
        overflow: hidden;
        background-image: url('{base_image_url}');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }}
      .text-box {{
        position: absolute;
        display: flex;
        align-items: flex-start;
        box-sizing: border-box;
        white-space: pre-wrap;
        overflow-wrap: break-word;
        word-break: break-word;
        padding: 0.2em;
      }}
      #title-box {{
        {title_css}
      }}
      #author-box {{
        {author_css}
      }}
    </style>
  </head>
  <body>
    <div id=\"canvas\">
      <div id=\"title-box\" class=\"text-box\">{title_text}</div>
      <div id=\"author-box\" class=\"text-box\">{author_text}</div>
    </div>
  </body>
</html>
"""


class TemplateRenderService:
    def render_cover_from_template(self, base_image_url, template, book_title, author_name, aspect_ratio='2:3'):
        ratio = ASPECT_RATIOS.get(aspect_ratio, ASPECT_RATIOS['2:3'])
        width = ratio['width']
        height = ratio['height']

        title_box = (template or {}).get('title_box') or {}
        author_box = (template or {}).get('author_box') or {}

        html_content = _build_html(
            base_image_url=base_image_url,
            width=width,
            height=height,
            title_box=title_box,
            author_box=author_box,
            book_title=book_title,
            author_name=author_name,
        )

        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise RuntimeError('Playwright dependency is missing') from exc

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox'],
            )
            context = browser.new_context(
                viewport={'width': width, 'height': height},
                device_scale_factor=1,
            )
            page = context.new_page()
            page.set_content(html_content, wait_until='networkidle')
            page.evaluate('() => document.fonts.ready')
            image_bytes = page.locator('#canvas').screenshot(type='png')
            context.close()
            browser.close()
            logger.info('Rendered template cover (%sx%s)', width, height)
            return image_bytes


template_render_service = TemplateRenderService()
