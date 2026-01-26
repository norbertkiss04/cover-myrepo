import logging
import os
import time

from flask import Flask, request, g
from flask_cors import CORS
from supabase import create_client, Client

from app.config import config

logger = logging.getLogger(__name__)


def create_app(config_name=None):
    """Application factory."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    # Configure logging early
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] %(levelname)s %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    logger.info("Creating app with config '%s'", config_name)

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    logger.info("Config loaded")

    # CORS - allow frontend
    frontend_url = app.config['FRONTEND_URL']
    CORS(app, origins=[frontend_url], supports_credentials=True)
    logger.info("CORS configured for %s", frontend_url)

    # Initialize Supabase client (skip in testing - will be mocked)
    if not app.config.get('TESTING'):
        supabase_url = app.config['SUPABASE_URL']
        app.supabase = create_client(
            supabase_url,
            app.config['SUPABASE_SERVICE_KEY']
        )
        logger.info("Supabase client initialized (url=%s)", supabase_url)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.generate import generate_bp

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(generate_bp, url_prefix='/api')
    logger.info("Blueprints registered: /auth, /api")

    # Request logging
    @app.before_request
    def log_request_start():
        g.request_start = time.time()
        logger.info("--> %s %s", request.method, request.path)

    @app.after_request
    def log_request_end(response):
        duration_ms = (time.time() - g.get('request_start', time.time())) * 1000
        logger.info(
            "<-- %s %s %s (%.0fms)",
            request.method, request.path, response.status_code, duration_ms,
        )
        return response

    # Health check endpoint
    @app.route('/health')
    def health():
        return {'status': 'healthy', 'service': 'instacover-api'}

    logger.info("App ready (%s)", config_name)
    return app
