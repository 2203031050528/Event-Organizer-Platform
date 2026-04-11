from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class TransportFare(BaseModel):
    """Admin-configurable fare rates per vehicle type."""
    vehicle_type: Literal["BIKE", "CAR", "VAN"]
    base_fare: float          # flat base charge (INR)
    per_km_rate: float        # INR per km
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TransportBooking(BaseModel):
    """Created when a user adds transport to their event booking."""
    booking_id: str                        # ref → bookings._id
    event_id: str
    user_id: str

    pickup_address: str
    drop_address: str
    vehicle_type: Literal["BIKE", "CAR", "VAN"]

    distance_km: float
    fare: float

    status: str = "PENDING"              # PENDING | ASSIGNED | COMPLETED | CANCELLED
    driver_id: Optional[str] = None      # ref → vendors._id (when assigned)
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None

    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
