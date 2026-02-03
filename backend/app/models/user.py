from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.config import INITIAL_CREDITS

@dataclass
class User:
    google_id: str
    email: str
    name: str
    id: Optional[int] = None
    picture: Optional[str] = None
    preferences: Optional[dict] = None
    credits: int = INITIAL_CREDITS
    is_admin: bool = False
    api_token: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> 'User':
        return cls(
            id=row.get('id'),
            google_id=row.get('google_id', ''),
            email=row.get('email', ''),
            name=row.get('name', ''),
            picture=row.get('picture'),
            preferences=row.get('preferences') or {},
            credits=row.get('credits', INITIAL_CREDITS),
            is_admin=bool(row.get('is_admin', False)),
            api_token=row.get('api_token'),
            created_at=row.get('created_at'),
            updated_at=row.get('updated_at'),
        )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'picture': self.picture,
            'preferences': self.preferences or {},
            'credits': self.credits,
            'is_admin': self.is_admin,
            'unlimited_credits': self.is_admin,
            'created_at': self.created_at,
        }

    def __repr__(self):
        return f'<User {self.email}>'
