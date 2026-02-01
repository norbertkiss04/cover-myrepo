from dataclasses import dataclass, field
from typing import Optional, List

@dataclass
class StyleReference:
    user_id: int
    image_url: str
    image_path: str
    id: Optional[int] = None
    title: Optional[str] = None
    feeling: Optional[str] = None
    layout: Optional[str] = None
    illustration_rules: Optional[str] = None
    typography: Optional[str] = None
    original_image_path: Optional[str] = None
    clean_image_path: Optional[str] = None
    text_layer_path: Optional[str] = None
    text_layer_cleaned: bool = False
    text_layer_selected_texts: Optional[List[dict]] = field(default_factory=list)
    detected_text: Optional[List[dict]] = field(default_factory=list)
    selected_text_ids: Optional[List[int]] = field(default_factory=list)
    created_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> 'StyleReference':
        return cls(
            id=row.get('id'),
            user_id=row.get('user_id'),
            image_url=row.get('image_url', ''),
            image_path=row.get('image_path', ''),
            title=row.get('title'),
            feeling=row.get('feeling'),
            layout=row.get('layout'),
            illustration_rules=row.get('illustration_rules'),
            typography=row.get('typography'),
            original_image_path=row.get('original_image_path'),
            clean_image_path=row.get('clean_image_path'),
            text_layer_path=row.get('text_layer_path'),
            text_layer_cleaned=row.get('text_layer_cleaned', False) or False,
            text_layer_selected_texts=row.get('text_layer_selected_texts') or [],
            detected_text=row.get('detected_text') or [],
            selected_text_ids=row.get('selected_text_ids') or [],
            created_at=row.get('created_at'),
        )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'title': self.title,
            'image_url': self.image_url,
            'original_image_url': None,
            'feeling': self.feeling,
            'layout': self.layout,
            'illustration_rules': self.illustration_rules,
            'typography': self.typography,
            'clean_image_url': None,
            'text_layer_url': None,
            'text_layer_cleaned': self.text_layer_cleaned,
            'detected_text': self.detected_text,
            'selected_text_ids': self.selected_text_ids,
            'created_at': self.created_at,
        }

    def get_style_analysis(self, mode: str = 'both') -> dict:
        if mode == 'text':
            return {
                'typography': self.typography or '',
            }
        elif mode == 'background':
            return {
                'feeling': self.feeling or '',
                'layout': self.layout or '',
                'illustration_rules': self.illustration_rules or '',
            }
        return {
            'feeling': self.feeling or '',
            'layout': self.layout or '',
            'illustration_rules': self.illustration_rules or '',
            'typography': self.typography or '',
        }

    def has_analysis(self) -> bool:
        return bool(self.feeling or self.layout or self.illustration_rules or self.typography)

    def __repr__(self):
        return f'<StyleReference {self.id}>'
