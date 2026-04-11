from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal, List
from datetime import datetime
from bson import ObjectId

from app.core.database import db
from app.common.utils.dependencies import get_current_user
from app.modules.transport.service import get_distance_km, calculate_fare, DEFAULT_FARES

router = APIRouter(prefix="/transport", tags=["transport"])


# ─── Request / Response bodies ────────────────────────────────────────────────

class FareQuoteRequest(BaseModel):
    pickup_address: str
    drop_address: str
    vehicle_type: Literal["BIKE", "CAR", "VAN"]


class TransportBookRequest(BaseModel):
    booking_id: str
    event_id: str
    pickup_address: str
    drop_address: str
    vehicle_type: Literal["BIKE", "CAR", "VAN"]
    notes: Optional[str] = None


class AssignDriverRequest(BaseModel):
    driver_id: str
    driver_name: str
    driver_phone: str


class FareUpdateRequest(BaseModel):
    vehicle_type: Literal["BIKE", "CAR", "VAN"]
    base_fare: float
    per_km_rate: float


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_fare_doc(vehicle_type: str) -> Optional[dict]:
    return await db.transport_fares.find_one({"vehicle_type": vehicle_type})


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    if "created_at" in doc and doc["created_at"]:
        doc["created_at"] = doc["created_at"].isoformat()
    if "updated_at" in doc and doc["updated_at"]:
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


# ─── Public: Fare Rates ───────────────────────────────────────────────────────

@router.get("/fares")
async def get_fare_rates():
    """Return current fare rates for all vehicle types."""
    rates = []
    for vtype, defaults in DEFAULT_FARES.items():
        doc = await db.transport_fares.find_one({"vehicle_type": vtype})
        rates.append({
            "vehicle_type": vtype,
            "base_fare": doc["base_fare"] if doc else defaults["base_fare"],
            "per_km_rate": doc["per_km_rate"] if doc else defaults["per_km_rate"],
        })
    return rates


# ─── Authenticated: Fare Quote (Google Maps) ─────────────────────────────────

@router.post("/quote")
async def get_fare_quote(body: FareQuoteRequest, current_user=Depends(get_current_user())):
    """
    Calculate distance via Google Maps Distance Matrix and return a fare quote.
    Call this in the frontend when the user enters pickup/drop.
    """
    try:
        distance_km = await get_distance_km(body.pickup_address, body.drop_address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    fare_doc = await _get_fare_doc(body.vehicle_type)
    fare = calculate_fare(distance_km, body.vehicle_type, fare_doc)

    return {
        "pickup_address": body.pickup_address,
        "drop_address": body.drop_address,
        "vehicle_type": body.vehicle_type,
        "distance_km": distance_km,
        "fare": fare,
        "currency": "INR",
    }


# ─── Authenticated: Multi-Quote (all vehicles at once) ───────────────────────

@router.post("/quote/all")
async def get_all_vehicle_quotes(
    body: FareQuoteRequest,
    current_user=Depends(get_current_user()),
):
    """Return fare estimates for all 3 vehicle types in one call."""
    try:
        distance_km = await get_distance_km(body.pickup_address, body.drop_address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    quotes = []
    for vtype in ["BIKE", "CAR", "VAN"]:
        fare_doc = await _get_fare_doc(vtype)
        fare = calculate_fare(distance_km, vtype, fare_doc)
        quotes.append({
            "vehicle_type": vtype,
            "distance_km": distance_km,
            "fare": fare,
            "currency": "INR",
        })
    return quotes


# ─── Authenticated: Book Transport ───────────────────────────────────────────

@router.post("/book")
async def book_transport(body: TransportBookRequest, current_user=Depends(get_current_user())):
    """
    Book transport service tied to an existing event booking.
    Distance calculated via Google Maps; fare computed from fare table.
    """
    # Validate booking belongs to this user
    booking = await db.bookings.find_one({"_id": ObjectId(body.booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking["user_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking.get("status") not in ("PENDING", "CONFIRMED"):
        raise HTTPException(status_code=400, detail="Booking must be active to add transport")

    # Check no duplicate transport booking
    existing = await db.transport_bookings.find_one({"booking_id": body.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Transport already booked for this booking")

    # Google Maps distance
    try:
        distance_km = await get_distance_km(body.pickup_address, body.drop_address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    fare_doc = await _get_fare_doc(body.vehicle_type)
    fare = calculate_fare(distance_km, body.vehicle_type, fare_doc)

    now = datetime.utcnow()
    doc = {
        "booking_id": body.booking_id,
        "event_id": body.event_id,
        "user_id": str(current_user["_id"]),
        "user_name": current_user.get("name", ""),
        "user_email": current_user.get("email", ""),
        "pickup_address": body.pickup_address,
        "drop_address": body.drop_address,
        "vehicle_type": body.vehicle_type,
        "distance_km": distance_km,
        "fare": fare,
        "status": "PENDING",
        "driver_id": None,
        "driver_name": None,
        "driver_phone": None,
        "notes": body.notes,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.transport_bookings.insert_one(doc)
    return {
        "transport_booking_id": str(result.inserted_id),
        "distance_km": distance_km,
        "fare": fare,
        "vehicle_type": body.vehicle_type,
        "status": "PENDING",
        "message": "Transport booked successfully",
    }


# ─── Authenticated: My Transport Bookings ────────────────────────────────────

@router.get("/my")
async def my_transport_bookings(current_user=Depends(get_current_user())):
    """Get the current user's transport bookings."""
    cursor = db.transport_bookings.find(
        {"user_id": str(current_user["_id"])},
        sort=[("created_at", -1)]
    )
    results = []
    async for doc in cursor:
        results.append(_serialize(doc))
    return results


@router.delete("/my/{transport_id}")
async def cancel_transport_booking(transport_id: str, current_user=Depends(get_current_user())):
    """User cancels their own transport booking."""
    doc = await db.transport_bookings.find_one({"_id": ObjectId(transport_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Transport booking not found")
    if doc["user_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your booking")
    if doc["status"] == "COMPLETED":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed booking")

    await db.transport_bookings.update_one(
        {"_id": ObjectId(transport_id)},
        {"$set": {"status": "CANCELLED", "updated_at": datetime.utcnow()}}
    )
    return {"message": "Transport booking cancelled"}


# ─── Organizer: Manage Event Transports ──────────────────────────────────────

@router.get("/event/{event_id}")
async def get_event_transports(
    event_id: str,
    status: Optional[str] = None,
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    """Organizer sees all transport bookings for their event."""
    # Verify event ownership
    event = await db.events.find_one({"_id": ObjectId(event_id), "organizer_id": current_user["_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found or not yours")

    query: dict = {"event_id": event_id}
    if status:
        query["status"] = status.upper()

    cursor = db.transport_bookings.find(query, sort=[("created_at", -1)])
    results = []
    async for doc in cursor:
        results.append(_serialize(doc))
    return results


@router.put("/event/{event_id}/{transport_id}/assign")
async def assign_driver(
    event_id: str,
    transport_id: str,
    body: AssignDriverRequest,
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    """Organizer assigns a driver to a transport booking."""
    event = await db.events.find_one({"_id": ObjectId(event_id), "organizer_id": current_user["_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found or not yours")

    result = await db.transport_bookings.update_one(
        {"_id": ObjectId(transport_id), "event_id": event_id},
        {"$set": {
            "driver_id": body.driver_id,
            "driver_name": body.driver_name,
            "driver_phone": body.driver_phone,
            "status": "ASSIGNED",
            "updated_at": datetime.utcnow(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transport booking not found")
    return {"message": "Driver assigned successfully"}


@router.put("/event/{event_id}/{transport_id}/status")
async def update_transport_status(
    event_id: str,
    transport_id: str,
    status: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    """Organizer updates transport status (ASSIGNED → COMPLETED)."""
    valid = {"PENDING", "ASSIGNED", "COMPLETED", "CANCELLED"}
    if status.upper() not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {', '.join(valid)}")

    event = await db.events.find_one({"_id": ObjectId(event_id), "organizer_id": current_user["_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found or not yours")

    result = await db.transport_bookings.update_one(
        {"_id": ObjectId(transport_id), "event_id": event_id},
        {"$set": {"status": status.upper(), "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transport booking not found")
    return {"message": f"Status updated to {status.upper()}"}


# ─── Admin: Fare Management ───────────────────────────────────────────────────

@router.get("/admin/fares")
async def admin_get_fares(current_user=Depends(get_current_user(required_role="ADMIN"))):
    rates = []
    for vtype, defaults in DEFAULT_FARES.items():
        doc = await db.transport_fares.find_one({"vehicle_type": vtype})
        rates.append({
            "vehicle_type": vtype,
            "base_fare": doc["base_fare"] if doc else defaults["base_fare"],
            "per_km_rate": doc["per_km_rate"] if doc else defaults["per_km_rate"],
        })
    return rates


@router.put("/admin/fares")
async def admin_update_fare(body: FareUpdateRequest, current_user=Depends(get_current_user(required_role="ADMIN"))):
    """Admin sets new fare rates for a vehicle type."""
    await db.transport_fares.update_one(
        {"vehicle_type": body.vehicle_type},
        {"$set": {
            "vehicle_type": body.vehicle_type,
            "base_fare": body.base_fare,
            "per_km_rate": body.per_km_rate,
            "updated_at": datetime.utcnow(),
        }},
        upsert=True,
    )
    return {"message": f"Fare rates updated for {body.vehicle_type}"}


# ─── Admin: Overview ─────────────────────────────────────────────────────────

@router.get("/admin/overview")
async def admin_transport_overview(current_user=Depends(get_current_user(required_role="ADMIN"))):
    """Admin-level transport stats."""
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_fare": {"$sum": "$fare"},
        }},
    ]
    results = await db.transport_bookings.aggregate(pipeline).to_list(None)
    return {
        "by_status": results,
        "total_bookings": sum(r["count"] for r in results),
        "total_revenue": sum(r["total_fare"] for r in results),
    }
