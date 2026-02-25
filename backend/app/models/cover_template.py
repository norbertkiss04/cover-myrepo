from dataclasses import dataclass
from typing import Optional


@dataclass
class CoverTemplate:
    user_id: int
    name: str
    aspect_ratio: str
    title_box: dict
    author_box: dict
    id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> 'CoverTemplate':
        return cls(
            id=row.get('id'),
            user_id=row.get('user_id'),
            name=row.get('name', ''),
            aspect_ratio=row.get('aspect_ratio', '2:3'),
            title_box=row.get('title_box') or {},
            author_box=row.get('author_box') or {},
            created_at=row.get('created_at'),
            updated_at=row.get('updated_at'),
        )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'aspect_ratio': self.aspect_ratio,
            'title_box': self.title_box,
            'author_box': self.author_box,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }

    def __repr__(self):
        return f'<CoverTemplate {self.id}: {self.name}>'
