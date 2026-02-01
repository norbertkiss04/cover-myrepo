import io
import time
import logging
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


def detect_and_crop_border(image_bytes, tolerance=50, min_border_size=3):
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

    def generate_clean_background(self, image_url, aspect_ratio='2:3'):
        self._get_config()

        size = self._get_size_string(aspect_ratio)

        prompt = (
            "Remove all text, titles, words, logos, symbols, and typography from this image. "
            "Keep only the background artwork, textures, colors, and visual elements. "
            "Output a clean image without any text or lettering."
        )

        payload = {
            'prompt': prompt,
            'images': [image_url],
            'size': size,
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5/edit',
            payload
        )
        result_url = self._poll(job_id)
        return {'image_url': result_url}

    def generate_text_layer(self, image_url, aspect_ratio='2:3', selected_texts=None):
        self._get_config()

        size = self._get_size_string(aspect_ratio)

        if selected_texts and len(selected_texts) > 0:
            text_descriptions = []
            for t in selected_texts:
                text_descriptions.append(f'- "{t["text"]}" ({t["text_type"]} at {t["position"]})')
            texts_list = '\n'.join(text_descriptions)

            prompt = (
                f"Extract ONLY these specific text elements from this image:\n{texts_list}\n\n"
                "Remove ALL other text, background imagery, illustrations, and photos. "
                "Place the extracted text on a solid white background. "
                "Keep the original font style, size, color, effects, and arrangement of the specified text. "
                "The background must be pure solid white (#FFFFFF) with no gradients or textures."
            )
        else:
            prompt = (
                "Extract only the text, titles, and typography from this image. "
                "Remove all background imagery, illustrations, and photos. "
                "Place the extracted text on a solid white background. "
                "Keep the original font style, size, and arrangement of the text. "
                "The background must be pure solid white (#FFFFFF) with no gradients or textures."
            )

        payload = {
            'prompt': prompt,
            'images': [image_url],
            'size': size,
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5/edit',
            payload
        )
        result_url = self._poll(job_id)
        return {'image_url': result_url}

    def cleanup_text_layer(self, image_url, artifacts_description, aspect_ratio='2:3'):
        self._get_config()

        size = self._get_size_string(aspect_ratio)

        prompt = (
            f"Remove the following non-text elements from this image while keeping ALL text intact: {artifacts_description}. "
            "The result should contain ONLY the text/typography on a pure solid white background (#FFFFFF). "
            "Preserve the exact font style, size, color, effects, and positioning of all text. "
            "Remove any characters, illustrations, decorative elements, or background artifacts completely. "
            "The background must be pure solid white with no gradients or textures."
        )

        payload = {
            'prompt': prompt,
            'images': [image_url],
            'size': size,
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        logger.info("Cleaning up text layer, removing: %s", artifacts_description[:100])
        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5/edit',
            payload
        )
        result_url = self._poll(job_id)
        logger.info("Text layer cleanup complete")
        return {'image_url': result_url}


def blend_images_programmatic(base_image_url, text_layer_url, white_threshold=240):
    logger.info("Blending images programmatically...")

    base_response = requests.get(base_image_url, timeout=60)
    base_response.raise_for_status()
    base_img = Image.open(io.BytesIO(base_response.content)).convert('RGBA')

    text_response = requests.get(text_layer_url, timeout=60)
    text_response.raise_for_status()
    text_img = Image.open(io.BytesIO(text_response.content)).convert('RGBA')

    if text_img.size != base_img.size:
        logger.info("Resizing text layer from %s to %s", text_img.size, base_img.size)
        text_img = text_img.resize(base_img.size, Image.Resampling.LANCZOS)

    text_data = text_img.load()
    width, height = text_img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = text_data[x, y]
            if r >= white_threshold and g >= white_threshold and b >= white_threshold:
                text_data[x, y] = (r, g, b, 0)
            else:
                brightness = (r + g + b) / 3
                opacity = int(255 * (1 - brightness / 255))
                opacity = max(opacity, a)
                text_data[x, y] = (r, g, b, min(255, opacity + 50))

    result = Image.alpha_composite(base_img, text_img)
    result = result.convert('RGB')

    output = io.BytesIO()
    result.save(output, format='PNG', quality=95)
    logger.info("Programmatic blend complete, output size: %.1f KB", len(output.getvalue()) / 1024)

    return output.getvalue()


image_service = ImageService()
