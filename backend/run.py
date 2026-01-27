
import logging
import os
from app import create_app, socketio

logger = logging.getLogger(__name__)

app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV', 'development') == 'development'
    logger.info("Starting InstaCover API on port %d (debug=%s)", port, debug)
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)
