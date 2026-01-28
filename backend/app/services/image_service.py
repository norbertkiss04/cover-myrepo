import io
import time
import logging
import requests
from PIL import Image
from flask import current_app

logger = logging.getLogger(__name__)

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

    def generate_image_with_text(self, base_image_url, text_prompt, aspect_ratio='2:3'):
        self._get_config()

        payload = {
            'prompt': text_prompt,
            'images': [base_image_url],
            'enable_base64_output': False,
            'enable_sync_mode': False,
        }

        job_id = self._submit(
            f'{self.base_url}/bytedance/seedream-v4.5/edit',
            payload
        )
        image_url = self._poll(job_id)
        return {'image_url': image_url}

    def compose_reference_on_canvas(self, image_bytes, aspect_ratio='2:3', cover=False):
        from app.models.generation import ASPECT_RATIOS
        ratio_info = ASPECT_RATIOS.get(aspect_ratio, ASPECT_RATIOS['2:3'])
        canvas_w = ratio_info['width']
        canvas_h = ratio_info['height']

        mode = "cover" if cover else "fit"
        logger.info(
            "Composing reference image onto %dx%d canvas (aspect_ratio=%s, mode=%s)",
            canvas_w, canvas_h, aspect_ratio, mode,
        )

        ref_img = Image.open(io.BytesIO(image_bytes))
        if ref_img.mode != 'RGB':
            ref_img = ref_img.convert('RGB')

        ref_w, ref_h = ref_img.size
        if cover:
            scale = max(canvas_w / ref_w, canvas_h / ref_h)
        else:
            scale = min(canvas_w / ref_w, canvas_h / ref_h)
        new_w = round(ref_w * scale)
        new_h = round(ref_h * scale)

        ref_img = ref_img.resize((new_w, new_h), Image.LANCZOS)

        canvas = Image.new('RGB', (canvas_w, canvas_h), (255, 255, 255))
        offset_x = (canvas_w - new_w) // 2
        offset_y = (canvas_h - new_h) // 2
        canvas.paste(ref_img, (offset_x, offset_y))

        logger.info(
            "Reference %dx%d scaled to %dx%d, centered on %dx%d canvas (offset=%d,%d, mode=%s)",
            ref_w, ref_h, new_w, new_h, canvas_w, canvas_h, offset_x, offset_y, mode,
        )

        buf = io.BytesIO()
        canvas.save(buf, format='JPEG', quality=90)
        return buf.getvalue()

image_service = ImageService()
