import pytest
from unittest.mock import MagicMock
from app.models.user import User
from app.services.credit_service import deduct_credits, refund_credits, is_admin
from app.services.llm_service import LLMService


class TestCreditService:
    """Tests for credit_service functions."""

    def test_deduct_credits_success(self, app):
        with app.app_context():
            user = User(google_id='g1', email='user@example.com', name='User', id=1, credits=30)

            mock_rpc = MagicMock()
            mock_result = MagicMock()
            mock_result.data = 27
            mock_rpc.execute.return_value = mock_result
            app.supabase.rpc = MagicMock(return_value=mock_rpc)

            result = deduct_credits(user, 3)

            assert result['success'] is True
            assert result['remaining'] == 27

    def test_deduct_credits_insufficient(self, app):
        with app.app_context():
            user = User(google_id='g1', email='user@example.com', name='User', id=1, credits=1)

            mock_rpc = MagicMock()
            mock_result = MagicMock()
            mock_result.data = False
            mock_rpc.execute.return_value = mock_result
            app.supabase.rpc = MagicMock(return_value=mock_rpc)

            result = deduct_credits(user, 3)

            assert result['success'] is False
            assert result['remaining'] == 1

    def test_deduct_credits_admin_bypass(self, app):
        with app.app_context():
            user = User(google_id='g1', email='owner@example.com', name='Owner', id=1, credits=5, is_admin=True)

            result = deduct_credits(user, 3)

            assert result['success'] is True
            assert result['remaining'] == 5

    def test_refund_credits_normal_user(self, app):
        with app.app_context():
            user = User(google_id='g1', email='user@example.com', name='User', id=1, credits=10)

            app._test_store.setdefault('users', []).append({
                'id': 1,
                'google_id': 'g1',
                'email': 'user@example.com',
                'name': 'User',
                'credits': 10,
            })

            result = refund_credits(user, 3)

            assert result['success'] is True
            assert result['remaining'] == 13
            assert app._test_store['users'][0]['credits'] == 13

    def test_refund_credits_admin_bypass(self, app):
        with app.app_context():
            user = User(google_id='g1', email='owner@example.com', name='Owner', id=1, credits=5, is_admin=True)

            result = refund_credits(user, 3)

            assert result['success'] is True
            assert result['remaining'] == 5

    def test_is_admin_true(self, app):
        with app.app_context():
            user = User(google_id='g1', email='owner@example.com', name='Owner', is_admin=True)

            assert is_admin(user) is True

    def test_is_admin_false(self, app):
        with app.app_context():
            user = User(google_id='g1', email='user@example.com', name='User')

            assert is_admin(user) is False


class TestLLMServiceParseJson:
    """Tests for LLMService._parse_json."""

    def setup_method(self):
        self.service = LLMService()

    def test_parse_valid_json(self):
        result = self.service._parse_json('{"prompt": "hello"}')
        assert result == {'prompt': 'hello'}

    def test_parse_json_in_code_block(self):
        content = '```json\n{"prompt": "hello"}\n```'
        result = self.service._parse_json(content)
        assert result == {'prompt': 'hello'}

    def test_parse_json_in_text(self):
        content = 'Here is the result: {"prompt": "hello"} end of response'
        result = self.service._parse_json(content)
        assert result == {'prompt': 'hello'}

    def test_parse_invalid_json_raises(self):
        with pytest.raises(ValueError, match='Could not find JSON'):
            self.service._parse_json('this is not json at all')

    def test_parse_code_block_without_json_tag(self):
        content = '```\n{"prompt": "world"}\n```'
        result = self.service._parse_json(content)
        assert result == {'prompt': 'world'}
