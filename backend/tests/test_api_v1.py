import pytest
from unittest.mock import patch, MagicMock
from app.models.generation import Generation
from app.services.storage_service import storage_service


class TestApiV1Authentication:

    def test_endpoints_require_token(self, client):
        endpoints = [
            ('GET', '/api/v1/me'),
            ('GET', '/api/v1/styles'),
            ('GET', '/api/v1/styles/1'),
            ('GET', '/api/v1/templates'),
            ('GET', '/api/v1/templates/1'),
            ('POST', '/api/v1/templates'),
            ('GET', '/api/v1/settings'),
            ('POST', '/api/v1/estimate'),
            ('POST', '/api/v1/generate'),
            ('GET', '/api/v1/generations'),
            ('GET', '/api/v1/generations/1'),
        ]

        for method, path in endpoints:
            if method == 'GET':
                response = client.get(path)
            else:
                response = client.post(path, json={})

            assert response.status_code == 401, f"{method} {path} should return 401"
            data = response.get_json()
            assert 'error' in data

    def test_endpoints_reject_invalid_token(self, client):
        headers = {'Authorization': 'Bearer ic_invalid_token'}
        endpoints = [
            ('GET', '/api/v1/me'),
            ('GET', '/api/v1/styles'),
            ('GET', '/api/v1/templates'),
            ('GET', '/api/v1/settings'),
        ]

        for method, path in endpoints:
            response = client.get(path, headers=headers)
            assert response.status_code == 401, f"{method} {path} should return 401"

    def test_endpoints_reject_non_admin(self, client, non_admin_api_token_headers):
        endpoints = [
            ('GET', '/api/v1/me'),
            ('GET', '/api/v1/styles'),
            ('GET', '/api/v1/templates'),
            ('GET', '/api/v1/settings'),
        ]

        for method, path in endpoints:
            response = client.get(path, headers=non_admin_api_token_headers)
            assert response.status_code == 403, f"{method} {path} should return 403"
            data = response.get_json()
            assert 'admin' in data['error'].lower()


class TestGetMe:

    def test_returns_user_info(self, client, api_token_headers):
        response = client.get('/api/v1/me', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['id'] == 101
        assert data['email'] == 'apiuser@example.com'
        assert data['name'] == 'API User'
        assert data['credits'] == 500
        assert data['unlimited_credits'] is True


class TestGetStyles:

    def test_empty_list(self, client, api_token_headers):
        with patch.object(storage_service, 'sign_style_ref_dict', side_effect=lambda d, r: d):
            response = client.get('/api/v1/styles', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['styles'] == []

    def test_with_data(self, client, api_token_headers, app):
        app._test_store.setdefault('style_references', []).append({
            'id': 1,
            'user_id': 101,
            'image_url': 'https://test.supabase.co/storage/v1/object/public/covers/ref.png',
            'image_path': 'covers/ref.png',
            'title': 'Test Style',
            'feeling': 'Warm',
            'layout': 'Centered',
            'illustration_rules': 'Simple',
            'typography': 'Serif',
            'detected_text': [],
            'selected_text_ids': [],
            'created_at': '2025-01-01T00:00:00Z',
        })

        with patch.object(storage_service, 'sign_style_ref_dict', side_effect=lambda d, r: d):
            response = client.get('/api/v1/styles', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert len(data['styles']) == 1
        assert data['styles'][0]['title'] == 'Test Style'

    def test_only_returns_own_styles(self, client, api_token_headers, app):
        app._test_store.setdefault('style_references', []).extend([
            {
                'id': 1,
                'user_id': 101,
                'image_url': 'https://example.com/own.png',
                'image_path': 'own.png',
                'title': 'Own Style',
                'created_at': '2025-01-01T00:00:00Z',
            },
            {
                'id': 2,
                'user_id': 999,
                'image_url': 'https://example.com/other.png',
                'image_path': 'other.png',
                'title': 'Other Style',
                'created_at': '2025-01-01T00:00:00Z',
            },
        ])

        with patch.object(storage_service, 'sign_style_ref_dict', side_effect=lambda d, r: d):
            response = client.get('/api/v1/styles', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert len(data['styles']) == 1
        assert data['styles'][0]['title'] == 'Own Style'


class TestGetStyleById:

    def test_not_found(self, client, api_token_headers):
        response = client.get('/api/v1/styles/999', headers=api_token_headers)

        assert response.status_code == 404
        data = response.get_json()
        assert 'not found' in data['error'].lower()

    def test_other_user_not_found(self, client, api_token_headers, app):
        app._test_store.setdefault('style_references', []).append({
            'id': 10,
            'user_id': 999,
            'image_url': 'https://example.com/other.png',
            'image_path': 'other.png',
            'title': 'Other User Style',
            'created_at': '2025-01-01T00:00:00Z',
        })

        response = client.get('/api/v1/styles/10', headers=api_token_headers)

        assert response.status_code == 404

    def test_success(self, client, api_token_headers, app):
        app._test_store.setdefault('style_references', []).append({
            'id': 5,
            'user_id': 101,
            'image_url': 'https://example.com/style.png',
            'image_path': 'style.png',
            'title': 'My Style',
            'feeling': 'Cool',
            'layout': 'Left',
            'illustration_rules': 'Detailed',
            'typography': 'Sans-serif',
            'detected_text': [],
            'selected_text_ids': [],
            'created_at': '2025-01-01T00:00:00Z',
        })

        with patch.object(storage_service, 'sign_style_ref_dict', side_effect=lambda d, r: d):
            response = client.get('/api/v1/styles/5', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['title'] == 'My Style'


class TestTemplates:

    def test_list_templates_empty(self, client, api_token_headers):
        response = client.get('/api/v1/templates', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['templates'] == []

    def test_create_template_success(self, client, api_token_headers):
        response = client.post('/api/v1/templates', headers=api_token_headers, json={
            'name': 'My Template',
            'aspect_ratio': '2:3',
        })

        assert response.status_code == 201
        data = response.get_json()
        assert data['name'] == 'My Template'
        assert data['aspect_ratio'] == '2:3'
        assert 'title_box' in data
        assert 'author_box' in data

    def test_get_template_success(self, client, api_token_headers, app):
        app._test_store.setdefault('cover_templates', []).append({
            'id': 10,
            'user_id': 101,
            'name': 'Stored',
            'aspect_ratio': '2:3',
            'title_box': {},
            'author_box': {},
        })

        response = client.get('/api/v1/templates/10', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['name'] == 'Stored'

    def test_update_template_success(self, client, api_token_headers, app):
        app._test_store.setdefault('cover_templates', []).append({
            'id': 11,
            'user_id': 101,
            'name': 'Before',
            'aspect_ratio': '2:3',
            'title_box': {},
            'author_box': {},
        })

        response = client.put('/api/v1/templates/11', headers=api_token_headers, json={'name': 'After'})

        assert response.status_code == 200
        data = response.get_json()
        assert data['name'] == 'After'

    def test_delete_template_success(self, client, api_token_headers, app):
        app._test_store.setdefault('cover_templates', []).append({
            'id': 12,
            'user_id': 101,
            'name': 'Delete Me',
            'aspect_ratio': '2:3',
            'title_box': {},
            'author_box': {},
        })

        response = client.delete('/api/v1/templates/12', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True


class TestGetSettings:

    def test_returns_options(self, client, api_token_headers):
        response = client.get('/api/v1/settings', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert 'genres' in data
        assert 'aspect_ratios' in data
        assert 'reference_modes' in data
        assert 'text_blending_modes' in data
        assert 'template_fonts' in data
        assert isinstance(data['genres'], list)
        assert 'Fantasy' in data['genres']
        assert '2:3' in data['aspect_ratios']


class TestEstimate:

    def test_basic_estimate(self, client, api_token_headers):
        response = client.post('/api/v1/estimate', headers=api_token_headers, json={
            'use_style_image': False,
            'base_image_only': False,
            'two_step_generation': True,
        })

        assert response.status_code == 200
        data = response.get_json()
        assert 'total' in data
        assert 'can_afford' in data
        assert data['can_afford'] is True

    def test_estimate_with_style_ref(self, client, api_token_headers, app):
        app._test_store.setdefault('style_references', []).append({
            'id': 1,
            'user_id': 101,
            'image_url': 'https://example.com/ref.png',
            'image_path': 'ref.png',
            'clean_image_path': 'clean.png',
            'text_layer_path': None,
            'created_at': '2025-01-01T00:00:00Z',
        })

        response = client.post('/api/v1/estimate', headers=api_token_headers, json={
            'use_style_image': True,
            'style_reference_id': 1,
            'base_image_only': False,
            'reference_mode': 'both',
            'two_step_generation': True,
        })

        assert response.status_code == 200
        data = response.get_json()
        assert 'total' in data

    def test_estimate_with_cover_template(self, client, api_token_headers, app):
        app._test_store.setdefault('cover_templates', []).append({
            'id': 5,
            'user_id': 101,
            'name': 'Template',
            'aspect_ratio': '2:3',
            'title_box': {},
            'author_box': {},
        })

        response = client.post('/api/v1/estimate', headers=api_token_headers, json={
            'use_style_image': False,
            'cover_template_id': 5,
            'base_image_only': False,
            'two_step_generation': True,
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['total'] == 7


class TestGenerate:

    def test_missing_title(self, client, api_token_headers):
        response = client.post('/api/v1/generate', headers=api_token_headers, json={
            'author_name': 'Test Author',
        })

        assert response.status_code == 400
        data = response.get_json()
        assert 'book_title' in data['error']

    def test_missing_author(self, client, api_token_headers):
        response = client.post('/api/v1/generate', headers=api_token_headers, json={
            'book_title': 'Test Book',
        })

        assert response.status_code == 400
        data = response.get_json()
        assert 'author_name' in data['error']

    def test_invalid_style_ref(self, client, api_token_headers):
        response = client.post('/api/v1/generate', headers=api_token_headers, json={
            'book_title': 'Test Book',
            'author_name': 'Test Author',
            'use_style_image': True,
            'style_reference_id': 9999,
        })

        assert response.status_code == 404
        data = response.get_json()
        assert 'not found' in data['error'].lower()

    def test_insufficient_credits(self, client, api_token_headers, app):
        def mock_validate(*args, **kwargs):
            return {
                'can_afford': False,
                'user_credits': 1,
                'total': 14,
                'llm_calls': 2,
                'image_calls': 2,
            }

        with patch('app.routes.api_v1.validate_generation_credits', mock_validate):
            response = client.post('/api/v1/generate', headers=api_token_headers, json={
                'book_title': 'Test Book',
                'author_name': 'Test Author',
            })

        assert response.status_code == 402
        data = response.get_json()
        assert 'credit' in data['error'].lower()

    def test_generate_success(self, client, api_token_headers, app):
        response = client.post('/api/v1/generate', headers=api_token_headers, json={
            'book_title': 'Test Book',
            'author_name': 'Test Author',
            'genres': ['Fantasy'],
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'processing'
        assert 'generation_id' in data
        assert isinstance(data['generation_id'], int)

    def test_generate_with_cover_template(self, client, api_token_headers, app):
        app._test_store.setdefault('cover_templates', []).append({
            'id': 9,
            'user_id': 101,
            'name': 'Template',
            'aspect_ratio': '2:3',
            'title_box': {},
            'author_box': {},
        })

        response = client.post('/api/v1/generate', headers=api_token_headers, json={
            'book_title': 'Template Book',
            'author_name': 'Template Author',
            'cover_template_id': 9,
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'processing'
        assert 'generation_id' in data


class TestGetGenerations:

    def test_empty_list(self, client, api_token_headers):
        with patch.object(storage_service, 'sign_generation_dict', side_effect=lambda d: d):
            response = client.get('/api/v1/generations', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['generations'] == []
        assert data['total'] == 0

    def test_with_data(self, client, api_token_headers, app):
        app._test_store.setdefault('generations', []).append({
            'id': 1,
            'user_id': 101,
            'book_title': 'Test Book',
            'author_name': 'Test Author',
            'status': 'completed',
            'aspect_ratio': '2:3',
            'final_image_url': 'https://example.com/final.png',
            'created_at': '2025-01-01T00:00:00Z',
            'completed_at': '2025-01-01T00:01:00Z',
        })

        with patch.object(storage_service, 'sign_generation_dict', side_effect=lambda d: d):
            response = client.get('/api/v1/generations', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert len(data['generations']) == 1
        assert data['generations'][0]['book_title'] == 'Test Book'

    def test_only_completed(self, client, api_token_headers, app):
        app._test_store.setdefault('generations', []).extend([
            {
                'id': 1,
                'user_id': 101,
                'book_title': 'Completed Book',
                'author_name': 'Author',
                'status': 'completed',
                'aspect_ratio': '2:3',
                'created_at': '2025-01-01T00:00:00Z',
            },
            {
                'id': 2,
                'user_id': 101,
                'book_title': 'Failed Book',
                'author_name': 'Author',
                'status': 'failed',
                'aspect_ratio': '2:3',
                'created_at': '2025-01-01T00:00:00Z',
            },
            {
                'id': 3,
                'user_id': 101,
                'book_title': 'Generating Book',
                'author_name': 'Author',
                'status': 'generating',
                'aspect_ratio': '2:3',
                'created_at': '2025-01-01T00:00:00Z',
            },
        ])

        with patch.object(storage_service, 'sign_generation_dict', side_effect=lambda d: d):
            response = client.get('/api/v1/generations', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert len(data['generations']) == 1
        assert data['generations'][0]['book_title'] == 'Completed Book'

    def test_pagination(self, client, api_token_headers, app):
        for i in range(5):
            app._test_store.setdefault('generations', []).append({
                'id': i + 1,
                'user_id': 101,
                'book_title': f'Book {i + 1}',
                'author_name': 'Author',
                'status': 'completed',
                'aspect_ratio': '2:3',
                'created_at': f'2025-01-0{i + 1}T00:00:00Z',
            })

        with patch.object(storage_service, 'sign_generation_dict', side_effect=lambda d: d):
            response = client.get('/api/v1/generations?page=1&per_page=2', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert len(data['generations']) == 2
        assert data['total'] == 5
        assert data['page'] == 1
        assert data['per_page'] == 2
        assert data['pages'] == 3


class TestGetGenerationById:

    def test_not_found(self, client, api_token_headers):
        response = client.get('/api/v1/generations/999', headers=api_token_headers)

        assert response.status_code == 404
        data = response.get_json()
        assert 'not found' in data['error'].lower()

    def test_other_user_not_found(self, client, api_token_headers, app):
        app._test_store.setdefault('generations', []).append({
            'id': 50,
            'user_id': 999,
            'book_title': 'Other Book',
            'author_name': 'Other Author',
            'status': 'completed',
            'aspect_ratio': '2:3',
            'created_at': '2025-01-01T00:00:00Z',
        })

        response = client.get('/api/v1/generations/50', headers=api_token_headers)

        assert response.status_code == 404

    def test_success_completed(self, client, api_token_headers, app):
        app._test_store.setdefault('generations', []).append({
            'id': 25,
            'user_id': 101,
            'book_title': 'My Book',
            'author_name': 'My Author',
            'status': 'completed',
            'aspect_ratio': '2:3',
            'base_image_url': 'https://example.com/base.png',
            'final_image_url': 'https://example.com/final.png',
            'credits_used': 27,
            'created_at': '2025-01-01T00:00:00Z',
            'completed_at': '2025-01-01T00:01:00Z',
        })

        with patch.object(storage_service, 'get_signed_url', return_value='https://signed-url.com/image.png'):
            with patch.object(storage_service, 'extract_path', return_value='covers/image.png'):
                response = client.get('/api/v1/generations/25', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['generation_id'] == 25
        assert data['status'] == 'completed'
        assert 'base_image_url' in data
        assert 'cover_image_url' in data
        assert data['credits_used'] == 27

    def test_success_processing(self, client, api_token_headers, app):
        from datetime import datetime, timezone
        recent_time = datetime.now(timezone.utc).isoformat()
        app._test_store.setdefault('generations', []).append({
            'id': 26,
            'user_id': 101,
            'book_title': 'My Book',
            'author_name': 'My Author',
            'status': 'generating',
            'aspect_ratio': '2:3',
            'created_at': recent_time,
        })

        response = client.get('/api/v1/generations/26', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['generation_id'] == 26
        assert data['status'] == 'processing'
        assert 'base_image_url' not in data
        assert 'cover_image_url' not in data

    def test_success_failed(self, client, api_token_headers, app):
        app._test_store.setdefault('generations', []).append({
            'id': 27,
            'user_id': 101,
            'book_title': 'My Book',
            'author_name': 'My Author',
            'status': 'failed',
            'error_message': 'Something went wrong',
            'aspect_ratio': '2:3',
            'created_at': '2025-01-01T00:00:00Z',
        })

        response = client.get('/api/v1/generations/27', headers=api_token_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['generation_id'] == 27
        assert data['status'] == 'failed'
        assert data['error'] == 'Something went wrong'
