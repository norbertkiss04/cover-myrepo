import io

import pytest
from unittest.mock import patch
from PIL import Image

from app.services.image_service import ImageService, IMAGE_MODEL, detect_and_crop_border


@pytest.fixture
def image_service(app):
    with app.app_context():
        app.config['WAVESPEED_API_KEY'] = 'test-key'
        app.config['WAVESPEED_BASE_URL'] = 'https://test.wavespeed.ai/api/v3'
        yield ImageService()


class TestSizeParams:

    def test_uses_aspect_ratio_and_resolution(self, image_service):
        params = image_service._get_size_params('16:9')

        assert params == {'aspect_ratio': '16:9', 'resolution': '2k', 'output_format': 'png'}

    def test_maps_paperback_ratio_to_model_ratio(self, image_service):
        params = image_service._get_size_params('1:1.5')

        assert params['aspect_ratio'] == '2:3'

    def test_unknown_ratio_falls_back_to_kindle(self, image_service):
        params = image_service._get_size_params('7:5')

        assert params['aspect_ratio'] == '2:3'


class TestRequests:

    @patch.object(ImageService, '_poll', return_value='https://cdn.test/out.png')
    @patch.object(ImageService, '_submit', return_value='job-1')
    def test_base_image_uses_text_to_image_endpoint(self, mock_submit, mock_poll, image_service):
        result = image_service.generate_base_image('a lighthouse at dusk', '9:16')

        url, payload = mock_submit.call_args[0]
        assert url == f'https://test.wavespeed.ai/api/v3/{IMAGE_MODEL}'
        assert payload['prompt'] == 'a lighthouse at dusk'
        assert payload['aspect_ratio'] == '9:16'
        assert 'size' not in payload
        assert result == {'image_url': 'https://cdn.test/out.png'}

    @patch.object(ImageService, '_poll', return_value='https://cdn.test/out.png')
    @patch.object(ImageService, '_submit', return_value='job-1')
    def test_text_edit_uses_edit_endpoint_with_images(self, mock_submit, mock_poll, image_service):
        image_service.generate_image_with_text('https://cdn.test/base.png', 'add the title', '2:3')

        url, payload = mock_submit.call_args[0]
        assert url == f'https://test.wavespeed.ai/api/v3/{IMAGE_MODEL}/edit'
        assert payload['images'] == ['https://cdn.test/base.png']
        assert payload['aspect_ratio'] == '2:3'

    @patch.object(ImageService, '_poll', return_value='https://cdn.test/out.png')
    @patch.object(ImageService, '_submit', return_value='job-1')
    def test_clean_background_uses_edit_endpoint(self, mock_submit, mock_poll, image_service):
        image_service.generate_clean_background('https://cdn.test/ref.png')

        url, payload = mock_submit.call_args[0]
        assert url.endswith('/edit')
        assert payload['images'] == ['https://cdn.test/ref.png']


class TestBorderCrop:

    def _png(self, img):
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()

    def test_removes_uniform_border(self):
        img = Image.new('RGB', (100, 100), (255, 255, 255))
        img.paste(Image.new('RGB', (80, 80), (200, 30, 30)), (10, 10))

        cropped = detect_and_crop_border(self._png(img))

        assert Image.open(io.BytesIO(cropped)).size == (80, 80)

    def test_returns_none_without_border(self):
        img = Image.new('RGB', (50, 50), (0, 0, 0))
        img.putpixel((0, 0), (255, 255, 255))
        img.putpixel((49, 49), (255, 255, 255))

        assert detect_and_crop_border(self._png(img)) is None
