import logging
import uuid
import requests
from flask import current_app
from supabase import create_client, Client

logger = logging.getLogger(__name__)

class StorageService:
    
    def __init__(self):
        self._client: Client = None
        self._bucket: str = None
    
    def _get_client(self) -> Client:
        if not self._client:
            url = current_app.config['SUPABASE_URL']
            if not url.endswith('/'):
                url = url + '/'
            self._client = create_client(
                url,
                current_app.config['SUPABASE_SERVICE_KEY']
            )
            self._bucket = current_app.config['SUPABASE_STORAGE_BUCKET']
            logger.info("Storage client initialized (bucket=%s)", self._bucket)
        return self._client
    
    def _get_public_url(self, path: str) -> str:
        supabase_url = current_app.config['SUPABASE_URL'].rstrip('/')
        bucket = current_app.config['SUPABASE_STORAGE_BUCKET']
        return f"{supabase_url}/storage/v1/object/public/{bucket}/{path}"
    
    def upload_from_url(self, image_url: str, folder: str = 'covers') -> dict:
        client = self._get_client()
        
        logger.info("Downloading image from external URL (%s/...)", folder)
        logger.debug("Source URL: %s", image_url)
        response = requests.get(image_url, timeout=60)
        response.raise_for_status()
        
        content_type = response.headers.get('Content-Type', 'image/png')
        ext = 'png' if 'png' in content_type else 'jpg'
        size_kb = len(response.content) / 1024
        logger.info(
            "Downloaded %.1f KB (%s, content-type=%s)",
            size_kb, folder, content_type,
        )
        
        filename = f"{folder}/{uuid.uuid4()}.{ext}"
        
        logger.info("Uploading to storage: %s", filename)
        result = client.storage.from_(self._bucket).upload(
            path=filename,
            file=response.content,
            file_options={"content-type": content_type}
        )
        
        public_url = self._get_public_url(filename)
        logger.info("Upload complete: %s", filename)
        return {'public_url': public_url, 'path': filename}
    
    def upload_file(self, file_data: bytes, filename: str, content_type: str = 'image/png', folder: str = 'uploads') -> str:
        client = self._get_client()
        
        ext = filename.rsplit('.', 1)[-1] if '.' in filename else 'png'
        unique_filename = f"{folder}/{uuid.uuid4()}.{ext}"
        
        size_kb = len(file_data) / 1024
        logger.info(
            "Uploading file to storage: %s (%.1f KB, %s)",
            unique_filename, size_kb, content_type,
        )
        
        result = client.storage.from_(self._bucket).upload(
            path=unique_filename,
            file=file_data,
            file_options={"content-type": content_type}
        )
        
        public_url = self._get_public_url(unique_filename)
        logger.info("File upload complete: %s", unique_filename)
        return public_url
    
    def delete_file(self, file_url: str) -> bool:
        client = self._get_client()
        
        try:
            bucket = current_app.config['SUPABASE_STORAGE_BUCKET']
            marker = f"/public/{bucket}/"
            
            if marker in file_url:
                path = file_url.split(marker)[-1]
                logger.info("Deleting file from storage: %s", path)
                client.storage.from_(self._bucket).remove([path])
                logger.info("File deleted: %s", path)
                return True
            logger.warning("Could not extract path from URL: %s", file_url)
            return False
        except Exception as e:
            logger.error("Failed to delete file: %s", e)
            return False
    
    def get_signed_url(self, path: str, expires_in: int = 3600) -> str:
        client = self._get_client()
        
        try:
            logger.debug("Generating signed URL for %s (expires_in=%ds)", path, expires_in)
            result = client.storage.from_(self._bucket).create_signed_url(
                path=path,
                expires_in=expires_in
            )
            return result.get('signedURL')
        except Exception as e:
            logger.error("Failed to generate signed URL for %s: %s", path, e)
            return None

storage_service = StorageService()
