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

    def upload_bytes(self, data: bytes, folder: str = 'uploads', content_type: str = 'image/png') -> dict:
        client = self._get_client()

        ext = 'png' if 'png' in content_type else 'jpg'
        filename = f"{folder}/{uuid.uuid4()}.{ext}"

        size_kb = len(data) / 1024
        logger.info("Uploading bytes to storage: %s (%.1f KB)", filename, size_kb)

        client.storage.from_(self._bucket).upload(
            path=filename,
            file=data,
            file_options={"content-type": content_type}
        )

        public_url = self._get_public_url(filename)
        logger.info("Bytes upload complete: %s", filename)
        return {'public_url': public_url, 'path': filename}

    def extract_path(self, public_url: str):
        """Extract the storage path from a full public URL. Returns None if not matched."""
        bucket = current_app.config['SUPABASE_STORAGE_BUCKET']
        marker = f"/public/{bucket}/"
        if marker in public_url:
            return public_url.split(marker)[-1]
        return None

    def sign_url(self, public_url: str, expires_in: int = 3600) -> str:
        """Return a signed URL for a public URL. Falls back to the original URL on failure."""
        path = self.extract_path(public_url)
        if not path:
            return public_url
        signed = self.get_signed_url(path, expires_in=expires_in)
        return signed or public_url

    def sign_generation_dict(self, gen_dict: dict) -> dict:
        """Sign base_image_url and final_image_url in a generation dict in-place."""
        if gen_dict.get('base_image_url'):
            gen_dict['base_image_url'] = self.sign_url(gen_dict['base_image_url'])
        if gen_dict.get('final_image_url'):
            gen_dict['final_image_url'] = self.sign_url(gen_dict['final_image_url'])
        return gen_dict

    def sign_style_ref_dict(self, ref_dict: dict, style_ref) -> dict:
        if style_ref.image_path:
            signed = self.get_signed_url(style_ref.image_path, expires_in=3600)
            if signed:
                ref_dict['image_url'] = signed
        if style_ref.clean_image_path:
            signed = self.get_signed_url(style_ref.clean_image_path, expires_in=3600)
            if signed:
                ref_dict['clean_image_url'] = signed
        if style_ref.text_layer_path:
            signed = self.get_signed_url(style_ref.text_layer_path, expires_in=3600)
            if signed:
                ref_dict['text_layer_url'] = signed
        return ref_dict

    def delete_file(self, file_url: str) -> bool:
        client = self._get_client()

        try:
            path = self.extract_path(file_url)
            if path:
                logger.info("Deleting file from storage: %s", path)
                client.storage.from_(self._bucket).remove([path])
                logger.info("File deleted: %s", path)
                return True
            logger.warning("Could not extract path from URL: %s", file_url)
            return False
        except Exception as e:
            logger.error("Failed to delete file: %s", e)
            return False

    def delete_file_by_path(self, path: str) -> bool:
        client = self._get_client()

        try:
            logger.info("Deleting file from storage by path: %s", path)
            client.storage.from_(self._bucket).remove([path])
            logger.info("File deleted: %s", path)
            return True
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
