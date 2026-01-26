from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class User:
    """User model for storing user account information."""
    google_id: str
    email: str
    name: str
    id: Optional[int] = None
    picture: Optional[str] = None
    preferences: Optional[dict] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> 'User':
        """Create a User from a Supabase row dict."""
        return cls(
            id=row.get('id'),
            google_id=row.get('google_id', ''),
            email=row.get('email', ''),
            name=row.get('name', ''),
            picture=row.get('picture'),
            preferences=row.get('preferences') or {},
            created_at=row.get('created_at'),
            updated_at=row.get('updated_at'),
        )

    def to_dict(self) -> dict:
        """Convert user to dictionary (public-facing)."""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'picture': self.picture,
            'preferences': self.preferences or {},
            'created_at': self.created_at,
        }

    def __repr__(self):
        return f'<User {self.email}>'
