from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


class VendorServiceOut(BaseModel):
    id: str = Field(alias="_id")
    vendor_id: str
    name: str
    description: str
    category: str
    price_type: Literal["FIXED", "PER_HOUR", "PER_UNIT"]
    base_price: float
    images: List[str] = []
    is_available: bool
    created_at: datetime


class VendorServiceCreate(BaseModel):
    name: str
    description: str
    category: str
    price_type: Literal["FIXED", "PER_HOUR", "PER_UNIT"]
    base_price: float
    images: Optional[List[str]] = []
    is_available: bool = True


class VendorProfileOut(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    business_name: str
    category: str
    description: str
    contact_phone: str
    contact_email: str
    address: str
    city: str
    kyc_status: Literal["PENDING", "APPROVED", "REJECTED"]
    avg_rating: float = 0.0
    total_reviews: int = 0
    is_available: bool = True
    created_at: datetime


class VendorRegister(BaseModel):
    # User info
    name: str
    email: str
    password: str
    # Vendor info
    business_name: str
    category: Literal["CATERING", "DECORATION", "TRANSPORT", "AV", "SECURITY", "OTHER"]
    description: str
    contact_phone: str
    contact_email: str
    address: str
    city: str


class VendorBookingCreate(BaseModel):
    service_id: str
    event_id: str
    date: datetime
    duration_hours: Optional[float] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None


class VendorReviewCreate(BaseModel):
    service_id: str
    rating: int = Field(ge=1, le=5)
    comment: str
