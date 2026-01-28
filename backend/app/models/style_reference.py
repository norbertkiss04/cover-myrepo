from dataclasses import dataclass
from typing import Optional

@dataclass
class StyleReference:
    user_id: int
    image_url: str
    image_path: str
    id: Optional[int] = None
    title: Optional[str] = None
    created_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> 'StyleReference':
        return cls(
            id=row.get('id'),
            user_id=row.get('user_id'),
            image_url=row.get('image_url', ''),
            image_path=row.get('image_path', ''),
            title=row.get('title'),
            created_at=row.get('created_at'),
        )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'title': self.title,
            'image_url': self.image_url,
            'created_at': self.created_at,
        }

    def __repr__(self):
        return f'<StyleReference {self.id}>'
