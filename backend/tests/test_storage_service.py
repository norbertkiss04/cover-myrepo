import pytest
from unittest.mock import patch, MagicMock, PropertyMock

from app.services.storage_service import StorageService


@pytest.fixture
def storage(app):
    with app.app_context():
        app.config['SUPABASE_URL'] = 'https://test.supabase.co'
        app.config['SUPABASE_SERVICE_KEY'] = 'test-service-key'
        app.config['SUPABASE_STORAGE_BUCKET'] = 'covers'

        service = StorageService()
        yield service


class TestUploadFromUrl:

    @patch('app.services.storage_service.requests')
    @patch('app.services.storage_service.create_client')
    def test_downloads_and_uploads_image(self, mock_create, mock_requests, storage, app):
        with app.app_context():
            mock_response = MagicMock()
            mock_response.content = b'\x89PNG_fake_image'
            mock_response.headers = {'Content-Type': 'image/png'}
            mock_response.raise_for_status = MagicMock()
            mock_requests.get.return_value = mock_response

            mock_client = MagicMock()
            mock_bucket = MagicMock()
            mock_client.storage.from_.return_value = mock_bucket
            mock_create.return_value = mock_client

            result = storage.upload_from_url('https://ext.com/image.png', folder='base')

            assert 'public_url' in result
            assert 'path' in result
            assert 'base/' in result['path']
            assert result['path'].endswith('.png')

            mock_requests.get.assert_called_once()
            mock_bucket.upload.assert_called_once()

    @patch('app.services.storage_service.requests')
    @patch('app.services.storage_service.create_client')
    def test_jpg_content_type_uses_jpg_extension(self, mock_create, mock_requests, storage, app):
        with app.app_context():
            mock_response = MagicMock()
            mock_response.content = b'\xff\xd8\xff_fake_jpeg'
            mock_response.headers = {'Content-Type': 'image/jpeg'}
            mock_response.raise_for_status = MagicMock()
            mock_requests.get.return_value = mock_response

            mock_client = MagicMock()
            mock_bucket = MagicMock()
            mock_client.storage.from_.return_value = mock_bucket
            mock_create.return_value = mock_client

            result = storage.upload_from_url('https://ext.com/photo.jpg', folder='covers')

            assert result['path'].endswith('.jpg')


class TestUploadFile:

    @patch('app.services.storage_service.create_client')
    def test_uploads_bytes_and_returns_public_url(self, mock_create, storage, app):
        with app.app_context():
            mock_client = MagicMock()
            mock_bucket = MagicMock()
            mock_client.storage.from_.return_value = mock_bucket
            mock_create.return_value = mock_client

            result = storage.upload_file(
                file_data=b'\x89PNG_fake',
                filename='composite.jpg',
                content_type='image/jpeg',
                folder='composites',
            )

            assert isinstance(result, str)
            assert 'composites/' in result
            mock_bucket.upload.assert_called_once()

    @patch('app.services.storage_service.create_client')
    def test_uses_correct_extension(self, mock_create, storage, app):
        with app.app_context():
            mock_client = MagicMock()
            mock_bucket = MagicMock()
            mock_client.storage.from_.return_value = mock_bucket
            mock_create.return_value = mock_client

            result = storage.upload_file(
                file_data=b'\x89PNG',
                filename='test.png',
                content_type='image/png',
                folder='uploads',
            )

            assert '.png' in result


class TestDeleteFile:

    @patch('app.services.storage_service.create_client')
    def test_deletes_file_by_url(self, mock_create, storage, app):
        with app.app_context():
            mock_client = MagicMock()
            mock_bucket = MagicMock()
            mock_client.storage.from_.return_value = mock_bucket
            mock_create.return_value = mock_client

            url = 'https://test.supabase.co/storage/v1/object/public/covers/base/uuid.png'
            result = storage.delete_file(url)

            assert result is True
            mock_bucket.remove.assert_called_once_with(['base/uuid.png'])

    @patch('app.services.storage_service.create_client')
    def test_returns_false_for_non_matching_url(self, mock_create, storage, app):
        with app.app_context():
            mock_client = MagicMock()
            mock_create.return_value = mock_client

            result = storage.delete_file('https://other.com/image.png')

            assert result is False

    @patch('app.services.storage_service.create_client')
    def test_returns_false_on_exception(self, mock_create, storage, app):
        with app.app_context():
            mock_client = MagicMock()
            mock_bucket = MagicMock()
            mock_bucket.remove.side_effect = Exception('Storage error')
            mock_client.storage.from_.return_value = mock_bucket
            mock_create.return_value = mock_client

            url = 'https://test.supabase.co/storage/v1/object/public/covers/base/uuid.png'
            result = storage.delete_file(url)

            assert result is False


class TestGetSignedUrl:

    @patch('app.services.storage_service.create_client')
    def test_returns_signed_url(self, mock_create, storage, app):
        with app.app_context():
            mock_client = MagicMock()
            mock_bucket = MagicMock()
            mock_bucket.create_signed_url.return_value = {
                'signedURL': 'https://signed.supabase.co/path?token=abc'
            }
            mock_client.storage.from_.return_value = mock_bucket
            mock_create.return_value = mock_client

            result = storage.get_signed_url('base/uuid.png', expires_in=600)

            assert result == 'https://signed.supabase.co/path?token=abc'
            mock_bucket.create_signed_url.assert_called_once_with(
                path='base/uuid.png',
                expires_in=600,
            )

    @patch('app.services.storage_service.create_client')
    def test_returns_none_on_failure(self, mock_create, storage, app):
        with app.app_context():
            mock_client = MagicMock()
            mock_bucket = MagicMock()
            mock_bucket.create_signed_url.side_effect = Exception('Failed')
            mock_client.storage.from_.return_value = mock_bucket
            mock_create.return_value = mock_client

            result = storage.get_signed_url('base/uuid.png')

            assert result is None


class TestExtractPath:

    def test_extracts_path_from_valid_url(self, app):
        with app.app_context():
            service = StorageService()
            url = 'https://test.supabase.co/storage/v1/object/public/covers/base/img.png'
            result = service.extract_path(url)
            assert result == 'base/img.png'

    def test_returns_none_for_non_matching_url(self, app):
        with app.app_context():
            service = StorageService()
            result = service.extract_path('https://other.com/image.png')
            assert result is None


class TestSignStyleRefDict:

    @patch.object(StorageService, 'get_signed_url', return_value='https://signed.com/ref.png')
    def test_signs_image_url(self, mock_sign, storage, app):
        with app.app_context():
            from app.models.style_reference import StyleReference
            ref = StyleReference(
                user_id=1,
                image_url='https://test.supabase.co/storage/v1/object/public/covers/ref.png',
                image_path='references/ref.png',
                id=1,
            )
            ref_dict = ref.to_dict()

            result = storage.sign_style_ref_dict(ref_dict, ref)

            assert result['image_url'] == 'https://signed.com/ref.png'

    @patch.object(StorageService, 'get_signed_url', return_value=None)
    def test_keeps_original_when_signing_fails(self, mock_sign, storage, app):
        with app.app_context():
            from app.models.style_reference import StyleReference
            ref = StyleReference(
                user_id=1,
                image_url='https://original.com/ref.png',
                image_path='references/ref.png',
                id=1,
            )
            ref_dict = ref.to_dict()

            result = storage.sign_style_ref_dict(ref_dict, ref)

            assert result['image_url'] is None or 'image_url' in result
