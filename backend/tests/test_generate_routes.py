import base64
import pytest
from unittest.mock import patch, MagicMock
from app.services.storage_service import storage_service


class TestCoverTemplates:

    def test_render_cover_template_preview_requires_auth(self, client):
        response = client.post('/api/cover-templates/render-preview', json={})

        assert response.status_code == 401

    def test_render_cover_template_preview_success(self, client, auth_headers):
        image_data = f"data:image/png;base64,{base64.b64encode(b'test-image').decode('ascii')}"

        with patch(
            'app.routes.generate.template_render_service.render_cover_from_template',
            return_value=b'png-bytes',
        ) as render_mock:
            response = client.post(
                '/api/cover-templates/render-preview',
                headers=auth_headers,
                json={
                    'image': image_data,
                    'book_title': 'Test Title',
                    'author_name': 'Test Author',
                    'template': {
                        'aspect_ratio': '2:3',
                    },
                },
            )

        assert response.status_code == 200
        data = response.get_json()
        assert data['image'].startswith('data:image/png;base64,')
        render_mock.assert_called_once()

    def test_render_cover_template_preview_rejects_invalid_template(self, client, auth_headers):
        image_data = f"data:image/png;base64,{base64.b64encode(b'test-image').decode('ascii')}"

        response = client.post(
            '/api/cover-templates/render-preview',
            headers=auth_headers,
            json={
                'image': image_data,
                'template': {
                    'aspect_ratio': 'invalid',
                },
            },
        )

        assert response.status_code == 400
        data = response.get_json()
        assert 'aspect_ratio' in data['error']

    def test_render_cover_template_preview_rejects_invalid_image(self, client, auth_headers):
        response = client.post(
            '/api/cover-templates/render-preview',
            headers=auth_headers,
            json={
                'image': 'not-a-data-url',
                'template': {'aspect_ratio': '2:3'},
            },
        )

        assert response.status_code == 400
        data = response.get_json()
        assert 'data URL' in data['error']

    def test_get_cover_templates_empty(self, client, auth_headers):
        response = client.get('/api/cover-templates', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['cover_templates'] == []

    def test_create_cover_template_success(self, client, auth_headers):
        payload = {
            'name': 'Fantasy Large Title',
            'aspect_ratio': '2:3',
        }

        response = client.post('/api/cover-templates', headers=auth_headers, json=payload)

        assert response.status_code == 201
        data = response.get_json()
        assert data['name'] == 'Fantasy Large Title'
        assert data['aspect_ratio'] == '2:3'
        assert 'title_box' in data
        assert 'author_box' in data

    def test_create_cover_template_invalid_box(self, client, auth_headers):
        payload = {
            'name': 'Bad Template',
            'title_box': {
                'font_color': 'red',
            },
            'author_box': {
                'font_color': '#FFFFFF',
            },
        }

        response = client.post('/api/cover-templates', headers=auth_headers, json=payload)

        assert response.status_code == 400
        data = response.get_json()
        assert 'title_box' in data['error']

    def test_update_cover_template_success(self, client, auth_headers, app):
        app._test_store.setdefault('cover_templates', []).append({
            'id': 1,
            'user_id': 1,
            'name': 'Old Name',
            'aspect_ratio': '2:3',
            'title_box': {
                'x': 8,
                'y': 9,
                'width': 84,
                'height': 24,
                'font_family': 'Space Grotesk',
                'font_size': 128,
                'font_weight': 700,
                'font_color': '#FFFFFF',
                'text_align': 'center',
                'line_height': 1.05,
                'letter_spacing': 0,
                'uppercase': False,
                'italic': False,
                'shadow_color': '#00000099',
                'shadow_blur': 8,
                'shadow_x': 0,
                'shadow_y': 2,
                'opacity': 1,
            },
            'author_box': {
                'x': 8,
                'y': 80,
                'width': 84,
                'height': 12,
                'font_family': 'Space Grotesk',
                'font_size': 62,
                'font_weight': 600,
                'font_color': '#FFFFFF',
                'text_align': 'center',
                'line_height': 1.05,
                'letter_spacing': 1.4,
                'uppercase': True,
                'italic': False,
                'shadow_color': '#00000099',
                'shadow_blur': 6,
                'shadow_x': 0,
                'shadow_y': 2,
                'opacity': 1,
            },
        })

        response = client.put('/api/cover-templates/1', headers=auth_headers, json={'name': 'New Name'})

        assert response.status_code == 200
        data = response.get_json()
        assert data['name'] == 'New Name'

    def test_delete_cover_template_success(self, client, auth_headers, app):
        app._test_store.setdefault('cover_templates', []).append({
            'id': 2,
            'user_id': 1,
            'name': 'To Delete',
            'aspect_ratio': '2:3',
            'title_box': {},
            'author_box': {},
        })

        response = client.delete('/api/cover-templates/2', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert 'deleted' in data['message'].lower()

    def test_cover_template_scoped_to_user(self, client, auth_headers, app):
        app._test_store.setdefault('cover_templates', []).append({
            'id': 3,
            'user_id': 99,
            'name': 'Other User',
            'aspect_ratio': '2:3',
            'title_box': {},
            'author_box': {},
        })

        response = client.get('/api/cover-templates/3', headers=auth_headers)

        assert response.status_code == 404


class TestStyleReferences:
    """Tests for style reference CRUD endpoints."""

    def test_get_style_references_empty(self, client, auth_headers):
        response = client.get('/api/style-references', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['style_references'] == []

    def test_get_style_references_with_data(self, client, auth_headers, app):
        # Seed a style reference for the authenticated user (id=1)
        app._test_store.setdefault('style_references', []).append({
            'id': 1,
            'user_id': 1,
            'image_url': 'https://test.supabase.co/storage/v1/object/public/covers/ref.png',
            'image_path': 'references/ref.png',
            'title': 'Test Ref',
            'feeling': 'warm',
            'layout': 'centered',
            'illustration_rules': 'flat',
            'typography': 'serif',
            'created_at': '2025-01-01T00:00:00Z',
        })

        with patch.object(storage_service, 'get_signed_url', return_value='https://signed-url.com/ref.png'):
            response = client.get('/api/style-references', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert len(data['style_references']) == 1
        assert data['style_references'][0]['title'] == 'Test Ref'

    def test_delete_style_reference_success(self, client, auth_headers, app):
        app._test_store.setdefault('style_references', []).append({
            'id': 10,
            'user_id': 1,
            'image_url': 'https://test.supabase.co/storage/v1/object/public/covers/ref.png',
            'image_path': 'references/ref.png',
            'title': 'To Delete',
            'feeling': '',
            'layout': '',
            'illustration_rules': '',
            'typography': '',
            'created_at': '2025-01-01T00:00:00Z',
        })

        with patch.object(storage_service, 'delete_file', return_value=True):
            response = client.delete('/api/style-references/10', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert 'deleted' in data['message'].lower()

    def test_delete_style_reference_not_found(self, client, auth_headers):
        response = client.delete('/api/style-references/999', headers=auth_headers)

        assert response.status_code == 404
        data = response.get_json()
        assert 'not found' in data['error'].lower()

    def test_delete_style_reference_wrong_user(self, client, auth_headers, app):
        # Reference belongs to user_id=99, but auth user is id=1
        app._test_store.setdefault('style_references', []).append({
            'id': 20,
            'user_id': 99,
            'image_url': 'https://example.com/img.png',
            'image_path': 'references/img.png',
            'title': 'Not Mine',
            'feeling': '',
            'layout': '',
            'illustration_rules': '',
            'typography': '',
            'created_at': '2025-01-01T00:00:00Z',
        })

        response = client.delete('/api/style-references/20', headers=auth_headers)

        assert response.status_code == 404

    def test_update_style_reference_success(self, client, auth_headers, app):
        app._test_store.setdefault('style_references', []).append({
            'id': 30,
            'user_id': 1,
            'image_url': 'https://example.com/img.png',
            'image_path': 'references/img.png',
            'title': 'Original Title',
            'feeling': 'calm',
            'layout': 'grid',
            'illustration_rules': 'flat',
            'typography': 'sans',
            'created_at': '2025-01-01T00:00:00Z',
        })

        with patch.object(storage_service, 'get_signed_url', return_value=None):
            response = client.put(
                '/api/style-references/30',
                headers=auth_headers,
                json={'title': 'Updated Title'},
            )

        assert response.status_code == 200
        data = response.get_json()
        assert data['title'] == 'Updated Title'
        assert data['feeling'] == 'calm'

    def test_update_style_reference_not_found(self, client, auth_headers):
        response = client.put(
            '/api/style-references/999',
            headers=auth_headers,
            json={'title': 'Nope'},
        )

        assert response.status_code == 404

    def test_update_style_reference_no_valid_fields(self, client, auth_headers, app):
        app._test_store.setdefault('style_references', []).append({
            'id': 40,
            'user_id': 1,
            'image_url': 'https://example.com/img.png',
            'image_path': 'references/img.png',
            'title': 'Title',
            'feeling': '',
            'layout': '',
            'illustration_rules': '',
            'typography': '',
            'created_at': '2025-01-01T00:00:00Z',
        })

        response = client.put(
            '/api/style-references/40',
            headers=auth_headers,
            json={'invalid_field': 'value'},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert 'no valid fields' in data['error'].lower()


class TestGenerations:
    """Tests for generation CRUD endpoints."""

    def test_get_generations_empty(self, client, auth_headers):
        response = client.get('/api/generations', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['generations'] == []
        assert data['total'] == 0
        assert data['page'] == 1

    def test_get_generations_with_pagination(self, client, auth_headers, app):
        # Seed 5 completed generations for user id=1
        for i in range(1, 6):
            app._test_store.setdefault('generations', []).append({
                'id': i,
                'user_id': 1,
                'book_title': f'Book {i}',
                'author_name': 'Author',
                'status': 'completed',
                'aspect_ratio': '2:3',
                'created_at': f'2025-01-0{i}T00:00:00Z',
            })

        with patch.object(storage_service, 'sign_url', side_effect=lambda url: url):
            response = client.get(
                '/api/generations?page=1&per_page=2',
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.get_json()
        assert data['total'] == 5
        assert data['per_page'] == 2
        assert data['page'] == 1
        assert data['pages'] == 3
        assert len(data['generations']) == 2

    def test_get_generation_by_id_success(self, client, auth_headers, app):
        app._test_store.setdefault('generations', []).append({
            'id': 100,
            'user_id': 1,
            'book_title': 'Single Book',
            'author_name': 'Author',
            'status': 'completed',
            'aspect_ratio': '2:3',
            'base_image_url': None,
            'final_image_url': None,
            'created_at': '2025-01-01T00:00:00Z',
        })

        response = client.get('/api/generations/100', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['book_title'] == 'Single Book'

    def test_get_generation_by_id_not_found(self, client, auth_headers):
        response = client.get('/api/generations/9999', headers=auth_headers)

        assert response.status_code == 404
        data = response.get_json()
        assert 'not found' in data['error'].lower()

    def test_delete_generation_success(self, client, auth_headers, app):
        app._test_store.setdefault('generations', []).append({
            'id': 200,
            'user_id': 1,
            'book_title': 'Delete Me',
            'author_name': 'Author',
            'status': 'completed',
            'aspect_ratio': '2:3',
            'base_image_url': 'https://test.supabase.co/storage/v1/object/public/covers/base.png',
            'final_image_url': 'https://test.supabase.co/storage/v1/object/public/covers/final.png',
            'created_at': '2025-01-01T00:00:00Z',
        })

        with patch.object(storage_service, 'delete_file', return_value=True):
            response = client.delete('/api/generations/200', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert 'deleted' in data['message'].lower()

    def test_delete_generation_not_found(self, client, auth_headers):
        response = client.delete('/api/generations/9999', headers=auth_headers)

        assert response.status_code == 404


class TestHelpers:
    """Tests for storage_service URL signing helpers."""

    def test_extract_path_with_valid_url(self, app):
        with app.app_context():
            url = 'https://test.supabase.co/storage/v1/object/public/covers/base/img.png'
            result = storage_service.extract_path(url)
            assert result == 'base/img.png'

    def test_extract_path_with_no_marker(self, app):
        with app.app_context():
            result = storage_service.extract_path('https://example.com/image.png')
            assert result is None

    def test_sign_url_with_valid_path(self, app):
        with app.app_context():
            with patch.object(storage_service, 'get_signed_url', return_value='https://signed.example.com/img.png'):
                url = 'https://test.supabase.co/storage/v1/object/public/covers/base/img.png'
                result = storage_service.sign_url(url)
                assert result == 'https://signed.example.com/img.png'

    def test_sign_url_with_no_path(self, app):
        with app.app_context():
            url = 'https://example.com/image.png'
            result = storage_service.sign_url(url)
            assert result == url

    def test_sign_url_fallback_when_signing_fails(self, app):
        with app.app_context():
            with patch.object(storage_service, 'get_signed_url', return_value=None):
                url = 'https://test.supabase.co/storage/v1/object/public/covers/base/img.png'
                result = storage_service.sign_url(url)
                assert result == url

    def test_sign_generation_dict(self, app):
        with app.app_context():
            with patch.object(storage_service, 'get_signed_url', return_value='https://signed.example.com/img.png'):
                gen_dict = {
                    'base_image_url': 'https://test.supabase.co/storage/v1/object/public/covers/base.png',
                    'final_image_url': 'https://test.supabase.co/storage/v1/object/public/covers/final.png',
                }
                result = storage_service.sign_generation_dict(gen_dict)
                assert result['base_image_url'] == 'https://signed.example.com/img.png'
                assert result['final_image_url'] == 'https://signed.example.com/img.png'

    def test_sign_generation_dict_no_urls(self, app):
        with app.app_context():
            gen_dict = {'base_image_url': None, 'final_image_url': None}
            result = storage_service.sign_generation_dict(gen_dict)
            assert result['base_image_url'] is None
            assert result['final_image_url'] is None
