import logging
import os
import time

from flask import Flask, request, g, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from supabase import create_client, Client

from app.config import config

try:
    from pythonjsonlogger import jsonlogger
except ImportError:
    jsonlogger = None

logger = logging.getLogger(__name__)

socketio = SocketIO()


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'production')

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    handler = logging.StreamHandler()
    if jsonlogger:
        formatter = jsonlogger.JsonFormatter(
            '%(asctime)s %(levelname)s %(name)s %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%S',
        )
    else:
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
        )
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    logger.info("Creating app with config '%s'", config_name)

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    logger.info("Config loaded")

    sentry_dsn = app.config.get('SENTRY_DSN')
    if sentry_dsn:
        try:
            import sentry_sdk
            sentry_sdk.init(
                dsn=sentry_dsn,
                traces_sample_rate=0.1,
                send_default_pii=False,
            )
            logger.info("Sentry initialized")
        except ImportError:
            logger.warning("sentry-sdk not installed, skipping Sentry init")
    else:
        logger.info("No SENTRY_DSN configured, skipping Sentry init")

    frontend_url = app.config['FRONTEND_URL']
    CORS(app, origins=[frontend_url], supports_credentials=True)
    logger.info("CORS configured for %s", frontend_url)

    if not app.config.get('TESTING'):
        supabase_url = app.config['SUPABASE_URL']
        app.supabase = create_client(
            supabase_url,
            app.config['SUPABASE_SERVICE_KEY']
        )
        logger.info("Supabase client initialized (url=%s)", supabase_url)

    socketio.init_app(app, cors_allowed_origins=[frontend_url], async_mode='threading')
    logger.info("SocketIO initialized (async_mode=threading)")

    from app.routes.auth import auth_bp
    from app.routes.generate import generate_bp

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(generate_bp, url_prefix='/api')
    logger.info("Blueprints registered: /auth, /api")

    from app import sockets as _socket_handlers
    logger.info("Socket handlers registered (%s)", _socket_handlers.__name__)

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

    @app.route('/health')
    def health():
        return {'status': 'healthy', 'service': 'instacover-api'}

    logger.info("App ready (%s)", config_name)
    return app
