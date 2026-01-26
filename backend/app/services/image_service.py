import time
import logging
import requests
from flask import current_app

logger = logging.getLogger(__name__)


class ImageService:
    """Service for interacting with WaveSpeed Seedream v4.5 API for image generation."""

    def __init__(self):
        self.api_key = None
        self.base_url = None

    def _get_config(self):
        """Get configuration from Flask app context."""
        if not self.api_key:
            self.api_key = current_app.config['WAVESPEED_API_KEY']
            self.base_url = current_app.config['WAVESPEED_BASE_URL']

    def _headers(self):
        """Get request headers."""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def _get_size_string(self, aspect_ratio):
        """Get WaveSpeed size string (W*H format) for an aspect ratio."""
        from app.models.generation import ASPECT_RATIOS
        ratio_info = ASPECT_RATIOS.get(aspect_ratio, ASPECT_RATIOS['2:3'])
        return f"{ratio_info['width']}*{ratio_info['height']}"

    def _submit(self, url, payload):
        """Submit a job to WaveSpeed and return the job ID."""
        logger.info(f"Submitting job to {url}")
        logger.debug(f"Payload: {payload}")

        r = requests.post(url, headers=self._headers(), json=payload, timeout=30)
        if r.status_code != 200:
            raise ValueError(f"WaveSpeed submit failed: {r.status_code} {r.text}")

        job_id = r.json()["data"]["id"]
        logger.info(f"Job submitted, id: {job_id}")
        return job_id

    def _poll(self, job_id, interval=1):
        """
        Poll for job result. Returns the image URL.
        Follows the same pattern as the reference project.
        """
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

                # output can be a URL string or a dict
                if isinstance(output, dict):
                    image_url = output.get("url") or output.get("image_url") or output.get("image_base64")
                elif isinstance(output, str):
                    image_url = output
                else:
                    image_url = str(output)

                return image_url

            if data["status"] == "failed":
                raise RuntimeError(f"Job failed: {data.get('error')}")

            # Cap at 120 polls (2 minutes at 1s interval)
            if poll_count >= 120:
                raise RuntimeError(f"Job timed out after {poll_count} polls")

            time.sleep(interval)

    def generate_base_image(self, prompt, aspect_ratio='2:3'):
        """
        Generate the base book cover image without text using Seedream v4.5.

        Args:
            prompt: The image generation prompt
            aspect_ratio: Aspect ratio string (e.g., '2:3')

        Returns:
            dict with image_url
        """
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
        """
        Generate final cover by adding text to the base image using Seedream v4.5 edit.

        Args:
            base_image_url: URL of the base image
            text_prompt: Prompt describing the text overlay
            aspect_ratio: Aspect ratio string

        Returns:
            dict with image_url
        """
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


# Singleton instance
image_service = ImageService()
