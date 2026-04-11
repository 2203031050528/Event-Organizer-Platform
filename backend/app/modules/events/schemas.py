from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class AgendaItem(BaseModel):
    id: str = Field(alias="_id")
    title: str
    startTime: str
    endTime: str
    speaker: Optional[str] = ""
    room: Optional[str] = ""
    description: Optional[str] = ""
    type: str  # TALK | WORKSHOP | BREAK | PANEL


# ================= REQUEST SCHEMAS =================

class EventCreate(BaseModel):
    title: str
    description: Optional[str]
    category: str
    tags: Optional[List[str]] = None
    type: str  # ONLINE | OFFLINE | HYBRID

    city: str
    venue: Optional[str]

    start_date: datetime
    end_date: datetime

    banner_url: Optional[str] = None
    status: str  # DRAFT | PUBLISHED
    agenda: Optional[List[AgendaItem]] = []

    # ── Demo Video (Feature 2) ──────────────────────────────
    demo_video_url: Optional[str] = None          # YouTube / Vimeo / Cloudinary
    demo_video_type: Optional[str] = None         # "YOUTUBE" | "VIMEO" | "UPLOAD"
    demo_thumbnail_url: Optional[str] = None      # explicit thumbnail override

    # ── Pre-Launch Discount (Feature 3) ────────────────────
    pre_launch_discount_pct: Optional[float] = None   # e.g. 20  → 20% off
    pre_launch_ends_at: Optional[datetime] = None     # cut-off datetime (UTC)

    @field_validator("start_date", "end_date", "pre_launch_ends_at", mode="before")
    @classmethod
    def parse_datetime(cls, value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                if len(value) == 16:
                    value += ":00"
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    type: Optional[str] = None

    city: Optional[str] = None
    venue: Optional[str] = None

    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    banner_url: Optional[str] = None
    status: Optional[str] = None
    agenda: Optional[List[AgendaItem]] = None

    # ── Demo Video ──────────────────────────────────────────
    demo_video_url: Optional[str] = None
    demo_video_type: Optional[str] = None
    demo_thumbnail_url: Optional[str] = None

    # ── Pre-Launch Discount ─────────────────────────────────
    pre_launch_discount_pct: Optional[float] = None
    pre_launch_ends_at: Optional[datetime] = None

    @field_validator("start_date", "end_date", "pre_launch_ends_at", mode="before")
    @classmethod
    def parse_datetime(cls, value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            # Handle both ISO format and datetime-local format (YYYY-MM-DDTHH:MM)
            try:
                # Try parsing as ISO format first
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                # Try adding seconds if missing (datetime-local format)
                if len(value) == 16:  # YYYY-MM-DDTHH:MM
                    value += ":00"
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value


# ================= RESPONSE SCHEMA =================

class EventOut(BaseModel):
    id: str
    organizer_id: str

    title: str
    description: Optional[str]
    category: str
    tags: Optional[List[str]] = None
    type: str

    city: str
    venue: Optional[str]

    start_date: datetime
    end_date: datetime

    banner_url: Optional[str]
    status: str
    agenda: Optional[List[AgendaItem]] = []
    created_at: datetime

    # ── Demo Video ──────────────────────────────────────────
    demo_video_url: Optional[str] = None
    demo_video_type: Optional[str] = None
    demo_thumbnail_url: Optional[str] = None

    # ── Pre-Launch Discount ─────────────────────────────────
    pre_launch_discount_pct: Optional[float] = None
    pre_launch_ends_at: Optional[datetime] = None


class EventTicketOut(BaseModel):
    id: str
    event_id: str
    title: str
    price: float
    quantity: int
    sold: int = 0
    created_at: Optional[datetime] = None


class EventWithTicketsOut(EventOut):
    tickets: List[EventTicketOut] = Field(default_factory=list)


# ================= ADDON SCHEMAS =================

class AddonCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    total_quantity: int
    image_url: Optional[str] = None


class AddonOut(BaseModel):
    id: str
    event_id: str
    name: str
    description: Optional[str] = None
    price: float
    total_quantity: int
    sold_quantity: int
    image_url: Optional[str] = None
    created_at: datetime
