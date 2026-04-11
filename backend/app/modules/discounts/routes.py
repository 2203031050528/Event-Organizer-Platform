from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import db
from app.common.utils.dependencies import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/discounts", tags=["discounts"])

VALID_TYPES = {
    "PROMO_CODE", "EARLY_BIRD", "GROUP", "SEASONAL",
    "STUDENT", "FIRST_TIME", "LOYALTY", "ORGANIZATION", "PRE_LAUNCH"
}


class DiscountCreate(BaseModel):
    code: str
    type: str                        # PERCENTAGE | FIXED_AMOUNT  (the value kind)
    value: float
    discount_type: str = "PROMO_CODE"  # one of VALID_TYPES
    applies_to_ticket: str = "ALL"
    usage_limit: int = 100
    expires_at: Optional[str] = None
    event_id: Optional[str] = None

    # Auto-apply (no code entry required from user)
    is_auto_apply: bool = False
    priority: int = 0

    # Early Bird / Pre-Launch timing window
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None

    # Group discount
    min_quantity: int = 2

    # Seasonal — list of month numbers [1..12]
    months: Optional[List[int]] = None

    # Student / Organization domain allow-list
    org_domains: Optional[List[str]] = None

    # Loyalty
    min_past_bookings: int = 1


class DiscountUpdate(BaseModel):
    code: Optional[str] = None
    type: Optional[str] = None
    value: Optional[float] = None
    discount_type: Optional[str] = None
    applies_to_ticket: Optional[str] = None
    usage_limit: Optional[int] = None
    expires_at: Optional[str] = None
    event_id: Optional[str] = None
    is_auto_apply: Optional[bool] = None
    priority: Optional[int] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    min_quantity: Optional[int] = None
    months: Optional[List[int]] = None
    org_domains: Optional[List[str]] = None
    min_past_bookings: Optional[int] = None


class ValidateRequest(BaseModel):
    code: str
    event_id: str
    ticket_id: str


@router.post("/validate")
async def validate_discount(body: ValidateRequest, current_user=Depends(get_current_user())):
    """Validate a single promo code and return the discount details."""
    code_upper = body.code.strip().upper()
    now = datetime.utcnow()

    doc = await db.discount_codes.find_one({"code": code_upper})
    if not doc:
        raise HTTPException(status_code=404, detail="Invalid discount code")

    if doc.get("expires_at") and doc["expires_at"] < now:
        raise HTTPException(status_code=400, detail="This discount code has expired")

    if doc.get("usage_limit") and doc.get("used_count", 0) >= doc["usage_limit"]:
        raise HTTPException(status_code=400, detail="This discount code has reached its usage limit")

    if doc.get("event_id") and str(doc["event_id"]) != body.event_id:
        raise HTTPException(status_code=400, detail="This code is not valid for this event")

    return {
        "code": code_upper,
        "type": doc["type"],
        "value": doc["value"],
        "discount_type": doc.get("discount_type", "PROMO_CODE"),
        "applies_to_ticket": doc.get("applies_to_ticket", "ALL"),
        "message": f"Code applied: {doc['value']}{'%' if doc['type'] == 'PERCENTAGE' else '₹'} off"
    }


# ── Organizer CRUD ─────────────────────────────────────────────────────────────

@router.get("/organizer")
async def list_organizer_discounts(current_user=Depends(get_current_user(required_role="ORGANIZER"))):
    docs = await db.discount_codes.find({"organizer_id": str(current_user["_id"])}).to_list(100)
    for d in docs:
        d["_id"] = str(d["_id"])
        for dt_field in ("expires_at", "valid_from", "valid_until"):
            if d.get(dt_field):
                d[dt_field] = d[dt_field].isoformat()
        if d.get("event_id"):
            d["event_id"] = str(d["event_id"])
    return docs


@router.post("/organizer")
async def create_discount(body: DiscountCreate, current_user=Depends(get_current_user(required_role="ORGANIZER"))):
    if body.discount_type not in VALID_TYPES:
        raise HTTPException(400, f"discount_type must be one of: {', '.join(VALID_TYPES)}")

    existing = await db.discount_codes.find_one({"code": body.code.strip().upper()})
    if existing:
        raise HTTPException(status_code=400, detail="A code with this name already exists")

    def _parse_dt(val: Optional[str]):
        if not val:
            return None
        try:
            return datetime.fromisoformat(val)
        except ValueError:
            return None

    doc = {
        "organizer_id": str(current_user["_id"]),
        "code": body.code.strip().upper(),
        "type": body.type,
        "value": body.value,
        "discount_type": body.discount_type,
        "applies_to_ticket": body.applies_to_ticket,
        "usage_limit": body.usage_limit,
        "used_count": 0,
        "expires_at": _parse_dt(body.expires_at),
        "event_id": body.event_id,
        "is_auto_apply": body.is_auto_apply,
        "priority": body.priority,
        "valid_from": _parse_dt(body.valid_from),
        "valid_until": _parse_dt(body.valid_until),
        "min_quantity": body.min_quantity,
        "months": body.months or [],
        "org_domains": body.org_domains or [],
        "min_past_bookings": body.min_past_bookings,
        "created_at": datetime.utcnow(),
    }
    result = await db.discount_codes.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Discount code created"}


@router.put("/organizer/{code_id}")
async def update_discount(code_id: str, body: DiscountUpdate, current_user=Depends(get_current_user(required_role="ORGANIZER"))):
    update_data = body.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    for dt_field in ("expires_at", "valid_from", "valid_until"):
        if dt_field in update_data:
            val = update_data[dt_field]
            if val is not None:
                try:
                    update_data[dt_field] = datetime.fromisoformat(val)
                except ValueError:
                    raise HTTPException(400, f"Invalid {dt_field} format. Use ISO format.")
            else:
                update_data[dt_field] = None

    if "code" in update_data:
        update_data["code"] = update_data["code"].strip().upper()
        existing = await db.discount_codes.find_one(
            {"code": update_data["code"], "_id": {"$ne": ObjectId(code_id)}}
        )
        if existing:
            raise HTTPException(status_code=400, detail="A code with this name already exists")

    result = await db.discount_codes.update_one(
        {"_id": ObjectId(code_id), "organizer_id": str(current_user["_id"])},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found or not owned by organizer")
    return {"message": "Discount code updated successfully"}


@router.delete("/organizer/{code_id}")
async def delete_discount(code_id: str, current_user=Depends(get_current_user(required_role="ORGANIZER"))):
    await db.discount_codes.delete_one({"_id": ObjectId(code_id), "organizer_id": str(current_user["_id"])})
    return {"message": "Deleted"}
