from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime

class User(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["USER", "ORGANIZER", "ADMIN", "VENDOR"] = "USER"
    is_verified: bool = False
    is_blocked: bool = False
    # Organisation email verification
    org_email: Optional[str] = None
    org_domain: Optional[str] = None
    org_verified: bool = False
    # Loyalty tracking (auto-updated by booking confirmation)
    total_confirmed_bookings: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
