import os
from dotenv import load_dotenv

load_dotenv()

INITIAL_CREDITS = 30
GENERATION_COST = 3
ANALYSIS_COST = 3

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY')

    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

    SUPABASE_STORAGE_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET', 'covers')

    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

    WAVESPEED_API_KEY = os.getenv('WAVESPEED_API_KEY')
    WAVESPEED_BASE_URL = 'https://api.wavespeed.ai/api/v3'

    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

    SENTRY_DSN = os.getenv('SENTRY_DSN', '')

    OWNER_EMAIL = os.getenv('OWNER_EMAIL', '')

class DevelopmentConfig(Config):
    DEBUG = True
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-NOT-FOR-PRODUCTION')

class ProductionConfig(Config):
    DEBUG = False

class TestingConfig(Config):
    TESTING = True
    SECRET_KEY = 'test-secret-key'
    SUPABASE_URL = 'https://test.supabase.co'
    SUPABASE_ANON_KEY = 'test-anon-key'
    SUPABASE_SERVICE_KEY = 'test-service-key'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': ProductionConfig
}
