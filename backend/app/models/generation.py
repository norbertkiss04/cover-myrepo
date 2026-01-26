from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List


# Available aspect ratios (class-level constant, accessible without instances)
ASPECT_RATIOS = {
    '2:3': {'width': 1600, 'height': 2400, 'name': 'Kindle Standard'},
    '1:1.5': {'width': 1800, 'height': 2700, 'name': 'Paperback'},
    '1:1': {'width': 2000, 'height': 2000, 'name': 'Square'},
    '16:9': {'width': 2560, 'height': 1440, 'name': 'Wide Banner'},
    '9:16': {'width': 1440, 'height': 2560, 'name': 'Tall/Mobile'},
}


@dataclass
class Generation:
    """Model for storing book cover generation data."""
    user_id: int
    book_title: str
    author_name: str
    summary: str
    genres: list
    mood: str
    id: Optional[int] = None
    color_preference: Optional[str] = None
    character_description: Optional[str] = None
    keywords: Optional[list] = None
    reference_image_description: Optional[str] = None
    aspect_ratio: str = '2:3'
    base_prompt: Optional[str] = None
    text_prompt: Optional[str] = None
    base_image_url: Optional[str] = None
    final_image_url: Optional[str] = None
    status: str = 'pending'
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None

    # Keep as class attribute for backward compat
    ASPECT_RATIOS = ASPECT_RATIOS

    @classmethod
    def from_row(cls, row: dict) -> 'Generation':
        """Create a Generation from a Supabase row dict."""
        return cls(
            id=row.get('id'),
            user_id=row.get('user_id'),
            book_title=row.get('book_title', ''),
            author_name=row.get('author_name', ''),
            summary=row.get('summary', ''),
            genres=row.get('genres', []),
            mood=row.get('mood', ''),
            color_preference=row.get('color_preference'),
            character_description=row.get('character_description'),
            keywords=row.get('keywords'),
            reference_image_description=row.get('reference_image_description'),
            aspect_ratio=row.get('aspect_ratio', '2:3'),
            base_prompt=row.get('base_prompt'),
            text_prompt=row.get('text_prompt'),
            base_image_url=row.get('base_image_url'),
            final_image_url=row.get('final_image_url'),
            status=row.get('status', 'pending'),
            error_message=row.get('error_message'),
            created_at=row.get('created_at'),
            completed_at=row.get('completed_at'),
        )

    def to_dict(self) -> dict:
        """Convert generation to dictionary."""
        return {
            'id': self.id,
            'book_title': self.book_title,
            'author_name': self.author_name,
            'summary': self.summary,
            'genres': self.genres,
            'mood': self.mood,
            'color_preference': self.color_preference,
            'character_description': self.character_description,
            'keywords': self.keywords,
            'reference_image_description': self.reference_image_description,
            'aspect_ratio': self.aspect_ratio,
            'aspect_ratio_info': ASPECT_RATIOS.get(self.aspect_ratio),
            'base_prompt': self.base_prompt,
            'text_prompt': self.text_prompt,
            'base_image_url': self.base_image_url,
            'final_image_url': self.final_image_url,
            'status': self.status,
            'error_message': self.error_message,
            'created_at': self.created_at,
            'completed_at': self.completed_at,
        }

    def __repr__(self):
        return f'<Generation {self.id}: {self.book_title}>'
