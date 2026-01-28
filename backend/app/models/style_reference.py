from dataclasses import dataclass
from typing import Optional

@dataclass
class StyleReference:
    user_id: int
    image_url: str
    image_path: str
    id: Optional[int] = None
    clean_image_url: Optional[str] = None
    clean_image_path: Optional[str] = None
    title: Optional[str] = None
    feeling: Optional[str] = None
    layout: Optional[str] = None
    illustration_rules: Optional[str] = None
    typography: Optional[str] = None
    created_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> 'StyleReference':
        return cls(
            id=row.get('id'),
            user_id=row.get('user_id'),
            image_url=row.get('image_url', ''),
            image_path=row.get('image_path', ''),
            clean_image_url=row.get('clean_image_url'),
            clean_image_path=row.get('clean_image_path'),
            title=row.get('title'),
            feeling=row.get('feeling'),
            layout=row.get('layout'),
            illustration_rules=row.get('illustration_rules'),
            typography=row.get('typography'),
            created_at=row.get('created_at'),
        )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'title': self.title,
            'image_url': self.image_url,
            'clean_image_url': self.clean_image_url,
            'feeling': self.feeling,
            'layout': self.layout,
            'illustration_rules': self.illustration_rules,
            'typography': self.typography,
            'created_at': self.created_at,
        }

    def __repr__(self):
        return f'<StyleReference {self.id}>'
