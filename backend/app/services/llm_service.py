import json
import logging
import requests
from flask import current_app

logger = logging.getLogger(__name__)

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

STYLE_ANALYSIS_SCHEMA = {
    "name": "style_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
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
        "required": ["feeling", "layout", "illustration_rules", "typography"],
        "additionalProperties": False,
    },
}

STYLE_ANALYSIS_PROMPT = """Act as an expert Senior Art Director and Book Cover Designer. Analyze the visual style of the provided image to create a transferable design brief. 

Ignore the specific subject matter (e.g., do not describe "a dog" or "a mermaid"); instead, describe the artistic techniques and design choices so they can be applied to a completely different subject.

Provide your analysis for these four areas:

1. Feeling: Describe the emotional resonance and atmosphere. What is the psychological hook? (e.g., whimsical, terrifying, authoritative, romantic). Who is the target audience and what promise does the cover make to them?

2. Layout: Analyze the composition structure. How is the space divided (e.g., rule of thirds, central symmetry, top-heavy)? Where is the negative space? How does the text interact with the imagery (framed by it, overlapping it, isolated from it)?

3. Illustration Rules (or Visual Style): Describe the medium and artistic technique. If illustrated: Analyze the line work (clean vs. sketchy), shading (cel-shaded, gradient, cross-hatched), and texture (grainy, paper, smooth digital). If photographic: Describe the lighting (soft, harsh, cinematic), depth of field, and color grading. Color Palette: Describe the dominant colors, saturation levels, and contrast.

4. Typography: Analyze the font choices and hierarchy. Describe the Title font (Serif, Sans-Serif, Display, Handwritten, Grunge). Describe the treatments (embossing, drop shadows, distressing, glowing, interlocking letters). How does the Author Name compare to the Title in size and weight?"""

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

        logger.info("Style analysis complete (feeling=%d chars, layout=%d chars, illustration=%d chars, typography=%d chars)",
                     len(result.get('feeling', '')),
                     len(result.get('layout', '')),
                     len(result.get('illustration_rules', '')),
                     len(result.get('typography', '')))

        return result

    def generate_base_image_prompt(self, book_data, style_analysis=None):
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

        if style_analysis:
            user_content += "\n--- Visual Style Reference (apply these artistic rules to the cover) ---\n"
            if style_analysis.get('feeling'):
                user_content += f"Feeling & Atmosphere: {style_analysis['feeling']}\n"
            if style_analysis.get('layout'):
                user_content += f"Layout & Composition: {style_analysis['layout']}\n"
            if style_analysis.get('illustration_rules'):
                user_content += f"Illustration Style: {style_analysis['illustration_rules']}\n"

        user_content += "\nGenerate the image prompt now:"

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=BASE_PROMPT_SCHEMA)
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

        result = self._make_request(messages, schema=TEXT_OVERLAY_SCHEMA)
        return result['prompt']

    def generate_style_referenced_prompt(self, book_data, style_analysis):
        system_prompt = """You are an expert book cover designer. You will be given details about a new book 
and a style analysis from a reference image. The reference image will be provided alongside your prompt 
to the image generation model.

Your task is to create a SINGLE, comprehensive image generation prompt that:
1. Describes the new book cover's visual content (imagery, composition, colors, mood)
2. INCLUDES the book title and author name as text elements on the cover
3. Specifies typography style, placement, and hierarchy for the title and author name
4. Instructs the model to use the reference image ONLY for visual style — NOT its subject matter
5. Keep the prompt under 800 characters for best results
6. Return your response as JSON with a single "prompt" field

CRITICAL: The prompt must explicitly state that the reference image is for STYLE REFERENCE ONLY. 
The new cover must depict entirely new imagery appropriate for the book described, 
while matching the artistic style, color palette, composition approach, and typography feel of the reference."""

        user_content = f"""Create a book cover image prompt using the reference image's style.

Book Details:
- Title: "{book_data.get('book_title')}"
- Author: "{book_data.get('author_name')}"
- Genre(s): {', '.join(book_data.get('genres', []))}
- Summary: {book_data.get('summary', '')}
"""

        if book_data.get('mood'):
            user_content += f"- Mood/Atmosphere: {book_data.get('mood')}\n"

        if book_data.get('color_preference'):
            user_content += f"- Color Preference: {book_data.get('color_preference')}\n"

        if book_data.get('character_description'):
            user_content += f"- Main Character: {book_data.get('character_description')}\n"

        if book_data.get('keywords'):
            user_content += f"- Key Elements: {', '.join(book_data.get('keywords', []))}\n"

        user_content += f"""
Style Analysis of Reference Image:
- Feeling & Atmosphere: {style_analysis.get('feeling', '')}
- Layout & Composition: {style_analysis.get('layout', '')}
- Illustration Style: {style_analysis.get('illustration_rules', '')}
- Typography: {style_analysis.get('typography', '')}

Generate a single prompt that creates this book cover in the style of the reference image. 
The title "{book_data.get('book_title')}" and author "{book_data.get('author_name')}" must appear as text on the cover.
Use the reference image for style only — do NOT copy its subject matter."""

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]

        result = self._make_request(messages, schema=BASE_PROMPT_SCHEMA)
        return result['prompt']

llm_service = LLMService()
