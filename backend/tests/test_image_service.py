import io
import pytest
from PIL import Image

from app.services.image_service import ImageService


def _make_image(width, height, color=(255, 0, 0)):
    img = Image.new('RGB', (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


class TestComposeReferenceOnCanvas:

    def setup_method(self):
        self.service = ImageService()

    def test_fit_mode_centers_smaller_image(self, app):
        with app.app_context():
            image_bytes = _make_image(400, 600)

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='2:3', cover=False
            )

            assert isinstance(result, bytes)
            assert len(result) > 0

            output = Image.open(io.BytesIO(result))
            assert output.size == (1600, 2400)
            assert output.format == 'JPEG'

    def test_cover_mode_fills_canvas(self, app):
        with app.app_context():
            image_bytes = _make_image(400, 600)

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='2:3', cover=True
            )

            output = Image.open(io.BytesIO(result))
            assert output.size == (1600, 2400)

    def test_square_aspect_ratio(self, app):
        with app.app_context():
            image_bytes = _make_image(500, 500)

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='1:1', cover=False
            )

            output = Image.open(io.BytesIO(result))
            assert output.size == (2000, 2000)

    def test_wide_aspect_ratio(self, app):
        with app.app_context():
            image_bytes = _make_image(800, 600)

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='16:9', cover=False
            )

            output = Image.open(io.BytesIO(result))
            assert output.size == (2560, 1440)

    def test_output_is_valid_jpeg(self, app):
        with app.app_context():
            image_bytes = _make_image(300, 400)

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='2:3', cover=False
            )

            assert result[:2] == b'\xff\xd8'

    def test_fit_mode_white_background(self, app):
        with app.app_context():
            image_bytes = _make_image(100, 100, color=(255, 0, 0))

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='2:3', cover=False
            )

            output = Image.open(io.BytesIO(result))
            corner_pixel = output.getpixel((0, 0))
            assert corner_pixel == (255, 255, 255)

    def test_cover_mode_no_white_border(self, app):
        with app.app_context():
            image_bytes = _make_image(200, 300, color=(128, 64, 32))

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='2:3', cover=True
            )

            output = Image.open(io.BytesIO(result))
            corner_pixel = output.getpixel((0, 0))
            assert corner_pixel != (255, 255, 255)

    def test_rgba_image_converted_to_rgb(self, app):
        with app.app_context():
            img = Image.new('RGBA', (200, 300), (255, 0, 0, 128))
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            image_bytes = buf.getvalue()

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='2:3', cover=False
            )

            output = Image.open(io.BytesIO(result))
            assert output.mode == 'RGB'

    def test_default_aspect_ratio_fallback(self, app):
        with app.app_context():
            image_bytes = _make_image(200, 300)

            result = self.service.compose_reference_on_canvas(
                image_bytes, aspect_ratio='unknown', cover=False
            )

            output = Image.open(io.BytesIO(result))
            assert output.size == (1600, 2400)
