from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List

ASPECT_RATIOS = {
    '2:3': {'width': 1600, 'height': 2400, 'name': 'Kindle Standard'},
    '1:1.5': {'width': 1800, 'height': 2700, 'name': 'Paperback'},
    '1:1': {'width': 2000, 'height': 2000, 'name': 'Square'},
    '16:9': {'width': 2560, 'height': 1440, 'name': 'Wide Banner'},
    '9:16': {'width': 1440, 'height': 2560, 'name': 'Tall/Mobile'},
}

@dataclass
class Generation:
    user_id: int
    book_title: str
    author_name: str
    id: Optional[int] = None
    cover_ideas: Optional[str] = None
    description: str = ''
    genres: Optional[list] = field(default_factory=list)
    mood: str = ''
    color_preference: Optional[str] = None
    character_description: Optional[str] = None
    keywords: Optional[list] = None
    style_analysis: Optional[dict] = None
    style_reference_id: Optional[int] = None
    use_style_image: bool = False
    base_image_only: bool = False
    reference_mode: str = 'both'
    two_step_generation: bool = True
    aspect_ratio: str = '2:3'
    base_prompt: Optional[str] = None
    text_prompt: Optional[str] = None
    base_image_url: Optional[str] = None
    final_image_url: Optional[str] = None
    current_step: Optional[int] = None
    total_steps: Optional[int] = None
    step_message: Optional[str] = None
    status: str = 'pending'
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None

    ASPECT_RATIOS = ASPECT_RATIOS

    @classmethod
    def from_row(cls, row: dict) -> 'Generation':
        return cls(
            id=row.get('id'),
            user_id=row.get('user_id'),
            book_title=row.get('book_title', ''),
            author_name=row.get('author_name', ''),
            cover_ideas=row.get('cover_ideas'),
            description=row.get('description', ''),
            genres=row.get('genres', []),
            mood=row.get('mood', ''),
            color_preference=row.get('color_preference'),
            character_description=row.get('character_description'),
            keywords=row.get('keywords'),
            style_analysis=row.get('style_analysis'),
            style_reference_id=row.get('style_reference_id'),
            use_style_image=row.get('use_style_image', False),
            base_image_only=row.get('base_image_only', False),
            reference_mode=row.get('reference_mode', 'both'),
            two_step_generation=row.get('two_step_generation', True),
            aspect_ratio=row.get('aspect_ratio', '2:3'),
            base_prompt=row.get('base_prompt'),
            text_prompt=row.get('text_prompt'),
            base_image_url=row.get('base_image_url'),
            final_image_url=row.get('final_image_url'),
            current_step=row.get('current_step'),
            total_steps=row.get('total_steps'),
            step_message=row.get('step_message'),
            status=row.get('status', 'pending'),
            error_message=row.get('error_message'),
            created_at=row.get('created_at'),
            completed_at=row.get('completed_at'),
        )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'book_title': self.book_title,
            'author_name': self.author_name,
            'cover_ideas': self.cover_ideas,
            'description': self.description,
            'genres': self.genres,
            'mood': self.mood,
            'color_preference': self.color_preference,
            'character_description': self.character_description,
            'keywords': self.keywords,
            'style_analysis': self.style_analysis,
            'style_reference_id': self.style_reference_id,
            'use_style_image': self.use_style_image,
            'base_image_only': self.base_image_only,
            'reference_mode': self.reference_mode,
            'two_step_generation': self.two_step_generation,
            'aspect_ratio': self.aspect_ratio,
            'aspect_ratio_info': ASPECT_RATIOS.get(self.aspect_ratio),
            'base_prompt': self.base_prompt,
            'text_prompt': self.text_prompt,
            'base_image_url': self.base_image_url,
            'final_image_url': self.final_image_url,
            'current_step': self.current_step,
            'total_steps': self.total_steps,
            'step_message': self.step_message,
            'status': self.status,
            'error_message': self.error_message,
            'created_at': self.created_at,
            'completed_at': self.completed_at,
        }

    def __repr__(self):
        return f'<Generation {self.id}: {self.book_title}>'
