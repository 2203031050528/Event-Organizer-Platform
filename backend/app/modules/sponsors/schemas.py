from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ─── Packages ─────────────────────────────────────────────────────────────────

class SponsorPackageCreate(BaseModel):
    name: str  # Platinum, Gold, Silver
    price: float = Field(gt=0)
    description: str
    available_slots: int = Field(gt=0)

class SponsorPackageOut(BaseModel):
    id: str = Field(alias="_id")
    event_id: str
    organizer_id: str
    name: str
    price: float
    description: str
    available_slots: int
    sold_slots: int = 0
    created_at: datetime


# ─── Sponsors ─────────────────────────────────────────────────────────────────

class SponsorCreate(BaseModel):
    package_id: str
    company_name: str
    contact_email: str
    website_url: Optional[str] = None
    logo_url: Optional[str] = None

class SponsorOut(BaseModel):
    id: str = Field(alias="_id")
    event_id: str
    package_id: str
    user_id: str  # The user who registered as sponsor
    company_name: str
    contact_email: str
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    status: str  # PENDING | APPROVED | REJECTED
    payment_status: str  # PENDING | COMPLETED | FAILED
    amount_paid: float
    created_at: Optional[datetime] = None

    # Additional fields attached during retrieval
    package_name: Optional[str] = None


class SponsorStatusUpdate(BaseModel):
    status: str  # PENDING | APPROVED | REJECTED
