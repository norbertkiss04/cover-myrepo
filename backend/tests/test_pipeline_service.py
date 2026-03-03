import pytest
from unittest.mock import patch

from app.models.generation import Generation
from app.services.pipeline_service import (
    run_standard_pipeline,
    run_style_ref_pipeline,
    run_template_pipeline,
    GenerationCancelled,
    _check_cancelled,
)


@pytest.fixture
def mock_generation():
    return Generation(
        id=42,
        user_id=1,
        book_title='Test Book',
        author_name='Test Author',
        cover_ideas='dark forest',
        description='A dark fantasy novel',
        genres=['Fantasy'],
        mood='dark',
        aspect_ratio='2:3',
        status='generating',
    )


@pytest.fixture
def book_data():
    return {
        'book_title': 'Test Book',
        'author_name': 'Test Author',
        'cover_ideas': 'dark forest',
        'description': 'A dark fantasy novel',
        'genres': ['Fantasy'],
        'mood': 'dark',
        'color_preference': None,
        'character_description': None,
        'keywords': None,
    }


class TestCheckCancelled:

    def test_raises_when_status_is_not_generating(self, app):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 1,
                'status': 'failed',
            })
            with pytest.raises(GenerationCancelled):
                _check_cancelled(1)

    def test_does_not_raise_when_still_generating(self, app):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 1,
                'status': 'generating',
            })
            _check_cancelled(1)

    def test_does_not_raise_when_gen_not_found(self, app):
        with app.app_context():
            _check_cancelled(999)


class TestRunStandardPipeline:

    @patch('app.services.pipeline_service.storage_service')
    @patch('app.services.pipeline_service.image_service')
    @patch('app.services.pipeline_service.llm_service')
    def test_full_4_step_flow(self, mock_llm, mock_image, mock_storage, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'book_title': 'Test Book',
                'author_name': 'Test Author',
                'status': 'generating',
                'aspect_ratio': '2:3',
            })

            mock_llm.generate_base_image_prompt.return_value = 'A dark forest scene'
            mock_image.generate_base_image.return_value = {'image_url': 'https://ext.com/base.png'}
            mock_storage.upload_from_url.return_value = {
                'public_url': 'https://storage.com/base.png',
                'path': 'base/uuid.png',
            }
            mock_storage.get_signed_url.return_value = 'https://signed.com/base.png'
            mock_llm.generate_text_overlay_prompt.return_value = 'Add title at top'
            mock_image.generate_image_with_text.return_value = {'image_url': 'https://ext.com/final.png'}
            mock_storage.upload_from_url.side_effect = [
                {'public_url': 'https://storage.com/base.png', 'path': 'base/uuid.png'},
                {'public_url': 'https://storage.com/final.png', 'path': 'covers/uuid.png'},
            ]

            progress_calls = []

            def on_progress(step, total, message):
                progress_calls.append((step, total, message))

            result = run_standard_pipeline(
                42, mock_generation, book_data, '2:3',
                on_progress=on_progress,
            )

            assert result.status == 'completed'
            assert result.final_image_url == 'https://storage.com/final.png'

            mock_llm.generate_base_image_prompt.assert_called_once()
            mock_image.generate_base_image.assert_called_once()
            mock_llm.generate_text_overlay_prompt.assert_called_once()
            mock_image.generate_image_with_text.assert_called_once()

            assert len(progress_calls) == 4
            assert progress_calls[0][0] == 1
            assert progress_calls[3][0] == 4

    @patch('app.services.pipeline_service.storage_service')
    @patch('app.services.pipeline_service.image_service')
    @patch('app.services.pipeline_service.llm_service')
    def test_base_image_only_2_step_flow(self, mock_llm, mock_image, mock_storage, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'book_title': 'Test Book',
                'author_name': 'Test Author',
                'status': 'generating',
                'aspect_ratio': '2:3',
            })

            mock_llm.generate_base_image_prompt.return_value = 'A dark forest scene'
            mock_image.generate_base_image.return_value = {'image_url': 'https://ext.com/base.png'}
            mock_storage.upload_from_url.return_value = {
                'public_url': 'https://storage.com/base.png',
                'path': 'base/uuid.png',
            }

            progress_calls = []

            def on_progress(step, total, message):
                progress_calls.append((step, total, message))

            result = run_standard_pipeline(
                42, mock_generation, book_data, '2:3',
                on_progress=on_progress,
                base_image_only=True,
            )

            assert result.status == 'completed'
            assert result.final_image_url == 'https://storage.com/base.png'

            mock_llm.generate_text_overlay_prompt.assert_not_called()
            mock_image.generate_image_with_text.assert_not_called()

            assert len(progress_calls) == 2
            assert progress_calls[0][1] == 2
            assert progress_calls[1][1] == 2

    @patch('app.services.pipeline_service.storage_service')
    @patch('app.services.pipeline_service.image_service')
    @patch('app.services.pipeline_service.llm_service')
    def test_cancellation_raises(self, mock_llm, mock_image, mock_storage, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'status': 'failed',
            })

            mock_llm.generate_base_image_prompt.return_value = 'A prompt'

            with pytest.raises(GenerationCancelled):
                run_standard_pipeline(
                    42, mock_generation, book_data, '2:3',
                )


class TestRunStyleRefPipeline:

    @patch('app.services.pipeline_service.storage_service')
    @patch('app.services.pipeline_service.image_service')
    @patch('app.services.pipeline_service.llm_service')
    def test_full_2_step_flow(self, mock_llm, mock_image, mock_storage, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'status': 'generating',
                'aspect_ratio': '2:3',
            })
            app._test_store.setdefault('style_references', []).append({
                'id': 10,
                'user_id': 1,
                'image_url': 'https://storage.com/ref.png',
                'image_path': 'references/ref.png',
                'title': 'Dark Style',
                'feeling': 'Dark and mysterious',
                'layout': 'Central symmetry',
                'illustration_rules': 'Oil painting',
                'typography': 'Bold serif',
            })

            mock_llm.generate_style_referenced_prompt.return_value = 'Style referenced prompt'
            mock_storage.get_signed_url.return_value = 'https://signed.com/ref.png'

            mock_image.generate_image_with_text.return_value = {'image_url': 'https://ext.com/final.png'}
            mock_storage.upload_from_url.return_value = {
                'public_url': 'https://storage.com/final.png',
                'path': 'covers/uuid.png',
            }

            progress_calls = []

            def on_progress(step, total, message):
                progress_calls.append((step, total, message))

            result = run_style_ref_pipeline(
                42, mock_generation, book_data,
                10, '2:3', 1,
                on_progress=on_progress,
            )

            assert result.status == 'completed'
            assert result.final_image_url == 'https://storage.com/final.png'

            mock_llm.generate_style_referenced_prompt.assert_called_once()
            call_kwargs = mock_llm.generate_style_referenced_prompt.call_args[1]
            assert call_kwargs['style_analysis'] is not None
            assert call_kwargs['style_analysis']['feeling'] == 'Dark and mysterious'
            mock_image.generate_image_with_text.assert_called_once()

            assert len(progress_calls) == 2

    @patch('app.services.pipeline_service.storage_service')
    @patch('app.services.pipeline_service.image_service')
    @patch('app.services.pipeline_service.llm_service')
    def test_base_image_only_uses_no_text_prompt(self, mock_llm, mock_image, mock_storage, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'status': 'generating',
                'aspect_ratio': '2:3',
            })
            app._test_store.setdefault('style_references', []).append({
                'id': 10,
                'user_id': 1,
                'image_url': 'https://storage.com/ref.png',
                'image_path': 'references/ref.png',
                'title': 'Dark Style',
                'feeling': 'Dark and mysterious',
                'layout': 'Central symmetry',
                'illustration_rules': 'Oil painting',
                'typography': 'Bold serif',
            })

            mock_llm.generate_style_referenced_prompt_no_text.return_value = 'No text prompt'
            mock_storage.get_signed_url.return_value = 'https://signed.com/ref.png'

            mock_image.generate_image_with_text.return_value = {'image_url': 'https://ext.com/final.png'}
            mock_storage.upload_from_url.return_value = {
                'public_url': 'https://storage.com/final.png',
                'path': 'covers/uuid.png',
            }

            run_style_ref_pipeline(
                42, mock_generation, book_data,
                10, '2:3', 1,
                base_image_only=True,
            )

            mock_llm.generate_style_referenced_prompt_no_text.assert_called_once()
            call_kwargs = mock_llm.generate_style_referenced_prompt_no_text.call_args[1]
            assert call_kwargs['style_analysis'] is not None
            mock_llm.generate_style_referenced_prompt.assert_not_called()

    @patch('app.services.pipeline_service.storage_service')
    @patch('app.services.pipeline_service.image_service')
    @patch('app.services.pipeline_service.llm_service')
    def test_no_analysis_when_fields_empty(self, mock_llm, mock_image, mock_storage, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'status': 'generating',
                'aspect_ratio': '2:3',
            })
            app._test_store.setdefault('style_references', []).append({
                'id': 10,
                'user_id': 1,
                'image_url': 'https://storage.com/ref.png',
                'image_path': 'references/ref.png',
                'title': 'Dark Style',
            })

            mock_llm.generate_style_referenced_prompt.return_value = 'Style referenced prompt'
            mock_storage.get_signed_url.return_value = 'https://signed.com/ref.png'

            mock_image.generate_image_with_text.return_value = {'image_url': 'https://ext.com/final.png'}
            mock_storage.upload_from_url.return_value = {
                'public_url': 'https://storage.com/final.png',
                'path': 'covers/uuid.png',
            }

            run_style_ref_pipeline(
                42, mock_generation, book_data,
                10, '2:3', 1,
            )

            mock_llm.generate_style_referenced_prompt.assert_called_once()
            call_kwargs = mock_llm.generate_style_referenced_prompt.call_args[1]
            assert call_kwargs['style_analysis'] is None

    def test_style_reference_not_found_raises(self, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'status': 'generating',
            })

            with pytest.raises(ValueError, match='not found'):
                run_style_ref_pipeline(
                    42, mock_generation, book_data,
                    999, '2:3', 1,
                )

    @patch('app.services.pipeline_service.storage_service')
    @patch('app.services.pipeline_service.image_service')
    @patch('app.services.pipeline_service.llm_service')
    def test_cancellation_mid_pipeline(self, mock_llm, mock_image, mock_storage, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'status': 'failed',
            })
            app._test_store.setdefault('style_references', []).append({
                'id': 10,
                'user_id': 1,
                'image_url': 'https://storage.com/ref.png',
                'image_path': 'references/ref.png',
            })

            with pytest.raises(GenerationCancelled):
                run_style_ref_pipeline(
                    42, mock_generation, book_data,
                    10, '2:3', 1,
                )


class TestRunTemplatePipeline:

    @patch('app.services.pipeline_service.template_render_service')
    @patch('app.services.pipeline_service.storage_service')
    @patch('app.services.pipeline_service.image_service')
    @patch('app.services.pipeline_service.llm_service')
    def test_uses_clean_reference_variant_for_template_generation(self, mock_llm, mock_image, mock_storage, mock_template_render, app, mock_generation, book_data):
        with app.app_context():
            app._test_store.setdefault('generations', []).append({
                'id': 42,
                'user_id': 1,
                'book_title': 'Test Book',
                'author_name': 'Test Author',
                'status': 'generating',
                'aspect_ratio': '2:3',
            })
            app._test_store.setdefault('cover_templates', []).append({
                'id': 7,
                'user_id': 1,
                'name': 'Template A',
                'aspect_ratio': '2:3',
                'title_box': {},
                'author_box': {},
            })
            app._test_store.setdefault('style_references', []).append({
                'id': 10,
                'user_id': 1,
                'image_url': 'https://storage.com/original.png',
                'image_path': 'references/original.png',
                'clean_image_path': 'references/clean.png',
                'title': 'Dark Style',
                'feeling': 'Dark and mysterious',
                'layout': 'Central symmetry',
                'illustration_rules': 'Oil painting',
                'typography': 'Bold serif',
            })

            mock_llm.generate_style_referenced_prompt_no_text.return_value = 'No text style prompt'
            mock_storage.get_signed_url.side_effect = [
                'https://signed.com/clean.png',
                'https://signed.com/base.png',
            ]
            mock_image.generate_image_with_text.return_value = {'image_url': 'https://ext.com/base.png'}
            mock_storage.upload_from_url.return_value = {
                'public_url': 'https://storage.com/base.png',
                'path': 'base/uuid.png',
            }
            mock_template_render.render_cover_from_template.return_value = b'png-bytes'
            mock_storage.upload_bytes.return_value = {
                'public_url': 'https://storage.com/final.png',
                'path': 'covers/uuid.png',
            }

            result = run_template_pipeline(
                gen_id=42,
                generation=mock_generation,
                book_data=book_data,
                aspect_ratio='2:3',
                cover_template_id=7,
                user_id=1,
                style_reference_id=10,
                use_style_image=True,
                reference_mode='both',
            )

            assert result.status == 'completed'
            assert result.final_image_url == 'https://storage.com/final.png'
            assert mock_image.generate_image_with_text.call_args[0][0] == ['https://signed.com/clean.png']
            assert all(call.args[0] != 'references/original.png' for call in mock_storage.get_signed_url.call_args_list)
