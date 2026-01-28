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

STYLE_ANALYSIS_SCHEMA = {
    "name": "style_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "title": "Short Title",
            },
            "feeling": {
                "type": "string",
                "title": "Feeling & Atmosphere",
            },
            "layout": {
                "type": "string",
                "title": "Layout & Composition",
            },
            "illustration_rules": {
                "type": "string",
                "title": "Illustration Rules / Visual Style",
            },
            "typography": {
                "type": "string",
                "title": "Typography Analysis",
            },
        },
        "required": ["title", "feeling", "layout", "illustration_rules", "typography"],
        "additionalProperties": False,
    },
}

BORDER_DETECTION_SCHEMA = {
    "name": "border_detection",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "has_border": {
                "type": "boolean",
            },
        },
        "required": ["has_border"],
        "additionalProperties": False,
    },
}

BORDER_DETECTION_PROMPT = """Analyze this image and determine if it has any borders, margins, or empty space around the edges.

Look for:
- White borders or margins on any edge (top, bottom, left, right)
- Colored borders or frames that are not part of the artwork
- Empty/blank space that looks like padding or letterboxing
- The image not filling the entire canvas edge-to-edge

If the image content fills the entire canvas with no visible borders or margins, set has_border to false.
If there are ANY borders, margins, or empty space around the edges, set has_border to true."""

STYLE_ANALYSIS_PROMPT = """Act as an expert Senior Art Director and Book Cover Designer. Analyze the visual style of the provided image to create a transferable design brief. 

Ignore the specific subject matter (e.g., do not describe "a dog" or "a mermaid"); instead, describe the artistic techniques and design choices so they can be applied to a completely different subject.

IMPORTANT: Do NOT use percentages, pixel values, or specific numbers in your analysis. Use only relative descriptive terms.

Provide your analysis for these areas:

1. Feeling: Describe the emotional resonance and atmosphere. What is the psychological hook? (e.g., whimsical, terrifying, authoritative, romantic). Who is the target audience and what promise does the cover make to them?

2. Layout & Subject Focus: Analyze the composition and what the image emphasizes:
   - Composition structure (rule of thirds, central symmetry, diagonal, top-heavy, bottom-heavy)
   - Primary subject type (single figure, couple, group of people, object, environment/landscape, abstract pattern)
   - Subject prominence (fills most of frame, medium presence, small element in larger scene)
   - Subject placement (centered, off-center left/right, rule-of-thirds intersection, full bleed edge-to-edge)
   - Figure-ground relationship (subject dominates over background, balanced with background, background-dominant)
   - Negative space location and amount (minimal, moderate, abundant; where located)
   - How text interacts with imagery (framed by it, overlapping it, isolated in negative space)

3. Illustration Rules (or Visual Style): Describe the medium and artistic technique. If illustrated: Analyze the line work (clean vs. sketchy), shading (cel-shaded, gradient, cross-hatched), and texture (grainy, paper, smooth digital). If photographic: Describe the lighting (soft, harsh, cinematic), depth of field, and color grading. Color Palette: Describe the dominant colors, saturation levels, and contrast.

4. Typography: Provide typography specifications using ONLY relative terms (NO percentages, pixels, or numbers):

   TITLE TEXT:
   - Font category (Serif, Sans-Serif, Slab Serif, Display, Script, Handwritten, Blackletter)
   - Weight (Thin, Light, Regular, Medium, Bold, Black, Ultra Black)
   - Case (ALL CAPS, Title Case, lowercase)
   - Color with approximate hex code (e.g., "neon mint green ~#50FFB0")
   - Size relative to cover (small, medium, large, dominant)
   - Vertical position (top, upper-third, middle, lower-third, bottom)
   - Horizontal alignment (left, center, right)
   - Letter spacing (tight, normal, wide)
   - Effects (drop shadow with direction, glow, outline/stroke, emboss, gradient, distressed, metallic)

   AUTHOR NAME:
   - Same categories as title
   - Size relative to title (much smaller, smaller, similar)
   - Position relative to title (above title, below title with gap, at opposite end of cover)

   SUBTITLE (if present, otherwise state "No subtitle"):
   - Same categories as above

5. Title: Provide a short title (maximum 2 words) that captures the core visual style or mood of this cover design. Examples: "Gothic Horror", "Pastel Romance", "Noir Thriller", "Vintage Western", "Minimalist Sci-Fi"."""

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
and a style analysis from a reference image. The reference image will be provided alongside your prompt 
to the image generation model.

Your task is to create a SINGLE, comprehensive image generation prompt that:
1. Describes the new book cover's visual content (imagery, composition, colors, mood)
2. INCLUDES the book title and author name as text elements on the cover
3. Specifies typography style, placement, and hierarchy for the title and author name
4. Instructs the model to use the reference image ONLY for visual style — NOT its subject matter
5. NEVER include nudity, exposed intimate body parts, or explicit sexual acts in the prompt — even for erotic or romance genres, keep all figures clothed or tastefully obscured (e.g. silhouettes, draped fabric, suggestive but covered poses)
6. Keep the prompt under 800 characters for best results
7. Return your response as JSON with a single "prompt" field

CRITICAL: The prompt must explicitly state that the reference image is for STYLE REFERENCE ONLY. 
The new cover must depict entirely new imagery appropriate for the book described, 
while matching the artistic style, color palette, composition approach, and typography feel of the reference.

NOTE: The reference image may be placed on a white canvas with white padding/letterboxing to enforce 
the desired output resolution and aspect ratio. Ignore any white borders or strips around the reference — 
they are NOT part of the style. The actual style reference is the image content within."""

_STYLE_REF_SYSTEM_PROMPT_NO_TEXT = """You are an expert book cover designer. You will be given details about a new book 
and a style analysis from a reference image. The reference image will be provided alongside your prompt 
to the image generation model.

Your task is to create a SINGLE, comprehensive image generation prompt that:
1. Describes the new book cover's visual content (imagery, composition, colors, mood)
2. DO NOT include any text, titles, or author names in the image — this is a text-free illustration
3. Instructs the model to use the reference image ONLY for visual style — NOT its subject matter
4. NEVER include nudity, exposed intimate body parts, or explicit sexual acts in the prompt — even for erotic or romance genres, keep all figures clothed or tastefully obscured (e.g. silhouettes, draped fabric, suggestive but covered poses)
5. Keep the prompt under 800 characters for best results
6. Return your response as JSON with a single "prompt" field

CRITICAL: The prompt must explicitly state that the reference image is for STYLE REFERENCE ONLY. 
The new cover must depict entirely new imagery appropriate for the book described, 
while matching the artistic style, color palette, and composition approach of the reference.

NOTE: The reference image may be placed on a white canvas with white padding/letterboxing to enforce 
the desired output resolution and aspect ratio. Ignore any white borders or strips around the reference — 
they are NOT part of the style. The actual style reference is the image content within."""


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


def _build_style_analysis_content(style_analysis, include_typography=True):
    parts = ["\n--- Visual Style Reference (apply these artistic rules to the cover) ---"]

    if style_analysis.get('feeling'):
        parts.append(f"Feeling & Atmosphere: {style_analysis['feeling']}")
    if style_analysis.get('layout'):
        parts.append(f"Layout & Composition: {style_analysis['layout']}")
    if style_analysis.get('illustration_rules'):
        parts.append(f"Illustration Style: {style_analysis['illustration_rules']}")
    if include_typography and style_analysis.get('typography'):
        parts.append(f"Typography: {style_analysis['typography']}")

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

    def analyze_style_reference(self, image_data_url):
        logger.info("Analyzing style reference image via Gemini vision")

        messages = [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'image_url',
                        'image_url': {
                            'url': image_data_url,
                        },
                    },
                    {
                        'type': 'text',
                        'text': STYLE_ANALYSIS_PROMPT,
                    },
                ],
            }
        ]

        result = self._make_request(
            messages,
            schema=STYLE_ANALYSIS_SCHEMA,
            model='google/gemini-3-flash-preview',
        )

        logger.info("Style analysis complete (title=%s, feeling=%d chars, layout=%d chars, illustration=%d chars, typography=%d chars)",
                     result.get('title', ''),
                     len(result.get('feeling', '')),
                     len(result.get('layout', '')),
                     len(result.get('illustration_rules', '')),
                     len(result.get('typography', '')))

        return result

    def detect_border(self, image_data_url):
        logger.info("Checking image for borders via Gemini vision")

        messages = [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'image_url',
                        'image_url': {
                            'url': image_data_url,
                        },
                    },
                    {
                        'type': 'text',
                        'text': BORDER_DETECTION_PROMPT,
                    },
                ],
            }
        ]

        result = self._make_request(
            messages,
            schema=BORDER_DETECTION_SCHEMA,
            model='google/gemini-3-flash-preview',
        )

        logger.info("Border detection complete (has_border=%s)", result.get('has_border'))
        return result

    def generate_base_image_prompt(self, book_data, style_analysis=None, base_image_only=False):
        text_rule = _TEXT_RULE_BASE_IMAGE_ONLY if base_image_only else _TEXT_RULE_STANDARD
        system_prompt = _BASE_IMAGE_SYSTEM_PROMPT.format(text_rule=text_rule)

        user_content = "Create an image generation prompt for a book cover with these details:\n"
        user_content += _build_book_details_content(book_data, include_title=not base_image_only)

        if style_analysis:
            user_content += _build_style_analysis_content(style_analysis)

        user_content += "\n\nGenerate the image prompt now:"

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=PROMPT_SCHEMA)
        return result['prompt']

    def generate_text_overlay_prompt(self, book_data, style_analysis=None):
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

        if style_analysis and style_analysis.get('typography'):
            user_content += f"""
--- Typography Reference (apply this typography style) ---
{style_analysis['typography']}
"""

        user_content += "\nGenerate the text overlay prompt now:"

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=PROMPT_SCHEMA)
        return result['prompt']

    def generate_style_referenced_prompt(self, book_data, style_analysis, include_text=True):
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

        user_content += f"""
Style Analysis of Reference Image:
- Feeling & Atmosphere: {style_analysis.get('feeling', '')}
- Layout & Composition: {style_analysis.get('layout', '')}
- Illustration Style: {style_analysis.get('illustration_rules', '')}
"""

        if include_text:
            user_content += f"- Typography: {style_analysis.get('typography', '')}\n"
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

    def generate_style_referenced_prompt_no_text(self, book_data, style_analysis):
        return self.generate_style_referenced_prompt(book_data, style_analysis, include_text=False)

llm_service = LLMService()
