import io
import time
import logging
import colorsys
import requests
from flask import current_app
from PIL import Image

logger = logging.getLogger(__name__)


def _colors_similar(c1, c2, tolerance):
    return (abs(c1[0] - c2[0]) <= tolerance and
            abs(c1[1] - c2[1]) <= tolerance and
            abs(c1[2] - c2[2]) <= tolerance)


def _is_uniform_row(pixels, width, y, tolerance):
    first_pixel = pixels[0, y]
    for x in range(1, width):
        if not _colors_similar(first_pixel, pixels[x, y], tolerance):
            return False
    return True


def _is_uniform_column(pixels, height, x, tolerance):
    first_pixel = pixels[x, 0]
    for y in range(1, height):
        if not _colors_similar(first_pixel, pixels[x, y], tolerance):
            return False
    return True


def _find_content_start_top(pixels, width, height, tolerance, min_border):
    for y in range(height):
        if not _is_uniform_row(pixels, width, y, tolerance):
            return y if y >= min_border else 0
    return 0


def _find_content_start_bottom(pixels, width, height, tolerance, min_border):
    for y in range(height - 1, -1, -1):
        if not _is_uniform_row(pixels, width, y, tolerance):
            return y + 1 if (height - 1 - y) >= min_border else height
    return height


def _find_content_start_left(pixels, width, height, tolerance, min_border):
    for x in range(width):
        if not _is_uniform_column(pixels, height, x, tolerance):
            return x if x >= min_border else 0
    return 0


def _find_content_start_right(pixels, width, height, tolerance, min_border):
    for x in range(width - 1, -1, -1):
        if not _is_uniform_column(pixels, height, x, tolerance):
            return x + 1 if (width - 1 - x) >= min_border else width
    return width


def detect_and_crop_border(image_bytes, tolerance=30, min_border_size=5):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    width, height = img.size
    pixels = img.load()

    top = _find_content_start_top(pixels, width, height, tolerance, min_border_size)
    bottom = _find_content_start_bottom(pixels, width, height, tolerance, min_border_size)
    left = _find_content_start_left(pixels, width, height, tolerance, min_border_size)
    right = _find_content_start_right(pixels, width, height, tolerance, min_border_size)

    if top == 0 and bottom == height and left == 0 and right == width:
        return None

    cropped = img.crop((left, top, right, bottom))

    output = io.BytesIO()
    cropped.save(output, format='PNG')
    return output.getvalue()


def get_dominant_color(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize((100, 100))

    colors = img.getcolors(maxcolors=10000)
    if not colors:
        return (128, 128, 128)

    sorted_colors = sorted(colors, key=lambda x: x[0], reverse=True)

    for count, color in sorted_colors:
        r, g, b = color
        if 20 < r < 235 or 20 < g < 235 or 20 < b < 235:
            return color

    return sorted_colors[0][1]


def get_complementary_color(rgb):
    r, g, b = [x / 255.0 for x in rgb]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h + 0.5) % 1.0
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return (int(r * 255), int(g * 255), int(b * 255))


def rgb_to_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(*rgb)


def get_contrasting_background(image_bytes):
    dominant = get_dominant_color(image_bytes)
    complement = get_complementary_color(dominant)
    hex_color = rgb_to_hex(complement)
    logger.info("Dominant color: %s, complement: %s", dominant, hex_color)
    return hex_color


class ImageService:

    def __init__(self):
        self.api_key = None
        self.base_url = None

    def _get_config(self):
        if not self.api_key:
            self.api_key = current_app.config['WAVESPEED_API_KEY']
            self.base_url = current_app.config['WAVESPEED_BASE_URL']

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def _get_size_string(self, aspect_ratio):
        from app.models.generation import ASPECT_RATIOS
        ratio_info = ASPECT_RATIOS.get(aspect_ratio, ASPECT_RATIOS['2:3'])
        return f"{ratio_info['width']}*{ratio_info['height']}"

    def _submit(self, url, payload):
        logger.info(f"Submitting job to {url}")

        r = requests.post(url, headers=self._headers(), json=payload, timeout=30)
        if r.status_code != 200:
            raise ValueError(f"WaveSpeed submit failed: {r.status_code} {r.text}")

        job_id = r.json()["data"]["id"]
        logger.info(f"Job submitted, id: {job_id}")
        return job_id

    def _poll(self, job_id, interval=1):
        url = f"{self.base_url}/predictions/{job_id}/result"
        logger.info(f"Polling for result (id: {job_id})...")
        poll_count = 0

        while True:
            r = requests.get(url, headers=self._headers(), timeout=30)
            if r.status_code != 200:
                raise ValueError(f"Poll failed: {r.status_code} {r.text}")

            data = r.json()["data"]
            poll_count += 1

            if poll_count % 10 == 0:
                logger.debug(f"Still waiting (status: {data['status']}, poll #{poll_count})")

            if data["status"] == "completed":
                logger.info("Job completed successfully")
                output = data["outputs"][0]

                if isinstance(output, dict):
                    image_url = output.get("url") or output.get("image_url") or output.get("image_base64")
                elif isinstance(output, str):
                    image_url = output
                else:
                    image_url = str(output)

                return image_url

            if data["status"] == "failed":
                raise RuntimeError(f"Job failed: {data.get('error')}")

            if poll_count >= 120:
                raise RuntimeError(f"Job timed out after {poll_count} polls")

            time.sleep(interval)

    def generate_base_image(self, prompt, aspect_ratio='2:3'):
        self._get_config()

        size = self._get_size_string(aspect_ratio)

        payload = {
            'prompt': prompt,
            'size': size,
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5',
            payload
        )
        image_url = self._poll(job_id)
        return {'image_url': image_url}

    def generate_image_with_text(self, image_urls, text_prompt, aspect_ratio='2:3'):
        self._get_config()

        if isinstance(image_urls, str):
            image_urls = [image_urls]

        size = self._get_size_string(aspect_ratio)

        payload = {
            'prompt': text_prompt,
            'images': image_urls,
            'size': size,
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5/edit',
            payload
        )
        image_url = self._poll(job_id)
        return {'image_url': image_url}

    def remove_text_from_image(self, image_url):
        self._get_config()

        payload = {
            'prompt': (
                'Remove all text, words, letters, typography, titles, author names, '
                'subtitles, taglines, and decorative borders from this image. '
                'Fill the removed areas naturally with the surrounding background and imagery. '
                'Keep only the illustration, artwork, and visual elements. '
                'The result should look like a complete image that never had any text.'
            ),
            'images': [image_url],
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        logger.info("Submitting text removal job to WaveSpeed")
        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5/edit',
            payload
        )
        image_url = self._poll(job_id)
        logger.info("Text removal complete")
        return {'image_url': image_url}

    def isolate_text_layer(self, image_url, background_color):
        self._get_config()

        payload = {
            'prompt': (
                f'Remove all illustrations, photos, artwork, people, objects, and backgrounds. '
                f'Keep only the book title and author name text. '
                f'Fill removed areas with solid {background_color}. '
                f'Do not alter the text.'
            ),
            'images': [image_url],
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        logger.info("Submitting text layer isolation job (bg=%s)", background_color)
        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5/edit',
            payload
        )
        image_url = self._poll(job_id)
        logger.info("Text layer isolation complete")
        return {'image_url': image_url}

    def cleanup_text_layer(self, image_url, removal_prompt, background_color):
        self._get_config()

        payload = {
            'prompt': (
                f'{removal_prompt} '
                f'Fill the removed area with solid {background_color}. '
                f'Do not alter the text.'
            ),
            'images': [image_url],
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        logger.info("Submitting text layer cleanup job")
        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5/edit',
            payload
        )
        image_url = self._poll(job_id)
        logger.info("Text layer cleanup complete")
        return {'image_url': image_url}

image_service = ImageService()
