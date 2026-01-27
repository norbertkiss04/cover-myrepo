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
            created_at=row.get('created_at'),
            updated_at=row.get('updated_at'),
        )

    def is_owner(self) -> bool:
        try:
            from flask import current_app
            owner_email = current_app.config.get('OWNER_EMAIL', '')
            return bool(owner_email and self.email == owner_email)
        except RuntimeError:
            return False

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'picture': self.picture,
            'preferences': self.preferences or {},
            'credits': self.credits,
            'unlimited_credits': self.is_owner(),
            'created_at': self.created_at,
        }

    def __repr__(self):
        return f'<User {self.email}>'
