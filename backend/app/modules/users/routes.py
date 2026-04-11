from fastapi import APIRouter, HTTPException, Depends, Body, Query
from typing import List, Optional
from bson import ObjectId
import re

from app.core.database import db
from app.modules.users.models import User
from app.common.utils.security import hash_password, verify_password
from app.common.utils.jwt import create_access_token, create_refresh_token
from app.common.utils.dependencies import get_current_user
from fastapi.security import OAuth2PasswordRequestForm

from app.modules.events.schemas import EventWithTicketsOut

import os

router = APIRouter(prefix="/users", tags=["users"])

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

EVENT_SEARCH_PROJECTION = {
    "_id": 1,
    "organizer_id": 1,
    "title": 1,
    "description": 1,
    "category": 1,
    "type": 1,
    "city": 1,
    "venue": 1,
    "start_date": 1,
    "end_date": 1,
    "banner_url": 1,
    "status": 1,
    "created_at": 1,
}


# ================= REGISTER =================
@router.post("/register")
async def register_user(user: User):
    # 🔒 Password strength validation
    raw_password = user.password
    if len(raw_password) < 8:
        raise HTTPException(
            status_code=422,
            detail="Password must be at least 8 characters long."
        )
    if not any(c.isdigit() or not c.isalpha() for c in raw_password):
        raise HTTPException(
            status_code=422,
            detail="Password must contain at least one number or special character."
        )

    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user.password = hash_password(raw_password)
    result = await db.users.insert_one(user.dict(by_alias=True))

    return {
        "message": "User registered successfully",
        "user": {
            "id": str(result.inserted_id),
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


# ================= LOGIN =================
@router.post("/login")
async def login_user(
    form_data: OAuth2PasswordRequestForm = Depends()
):
    email = form_data.username
    password = form_data.password

    # Generic 401 — do not reveal whether email or password is wrong
    auth_error = HTTPException(
        status_code=401,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = await db.users.find_one({"email": email})
    stored_password = user.get("password") or user.get("hashed_password") if user else None
    if not user or not stored_password or not verify_password(password, stored_password):
        raise auth_error

    if user.get("is_blocked"):
        raise HTTPException(status_code=403, detail="Account is blocked. Contact support.")

    access_token = create_access_token(
        {"sub": str(user["_id"]), "role": user["role"]}
    )
    refresh_token = create_refresh_token(
        {"sub": str(user["_id"]), "role": user["role"]}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        },
    }



# ================= REFRESH =================
@router.post("/refresh")
async def refresh_token_route(
    payload: dict = Body(...),
):
    from jose import jwt, JWTError

    token = payload.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token required")

    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        user_id = decoded.get("sub")
        role = decoded.get("role")
        if not user_id or not role:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        new_access = create_access_token({"sub": user_id, "role": role})
        return {"access_token": new_access, "token_type": "bearer"}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")


# ================= USER PROFILE =================
@router.get("/me")
async def get_my_profile(current_user=Depends(get_current_user())):
    user = await db.users.find_one({"_id": current_user["_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "wishlist": user.get("wishlist", []),
    }

@router.put("/me")
async def update_my_profile(
    payload: dict = Body(...),
    current_user=Depends(get_current_user())
):
    update_data = {}
    if "name" in payload and payload["name"].strip():
        update_data["name"] = payload["name"].strip()
    if "email" in payload and payload["email"].strip():
        # Check if email is being taken by someone else
        existing = await db.users.find_one({"email": payload["email"].strip()})
        if existing and str(existing["_id"]) != str(current_user["_id"]):
            raise HTTPException(status_code=400, detail="Email already in use")
        update_data["email"] = payload["email"].strip()

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    result = await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        return {"message": "No changes made"}

    return {"message": "Profile updated successfully"}


# ================= MY BOOKINGS =================
@router.get("/me/bookings")
async def my_bookings(user=Depends(get_current_user())):
    user_id = user["_id"]
    try:
        uid = ObjectId(user_id) if not isinstance(user_id, ObjectId) else user_id
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user")

    pipeline = [
        {"$match": {"user_id": uid}},
        {"$sort": {"created_at": -1}},
        {
            "$addFields": {
                "event_object_id": {"$toObjectId": "$event_id"},
                "ticket_object_id": {"$toObjectId": "$ticket_id"}
            }
        },
        {
            "$lookup": {
                "from": "events",
                "localField": "event_object_id",
                "foreignField": "_id",
                "as": "eventData"
            }
        },
        {
            "$lookup": {
                "from": "tickets",
                "localField": "ticket_object_id",
                "foreignField": "_id",
                "as": "ticketData"
            }
        },
        {"$unwind": "$eventData"},
        {"$unwind": "$ticketData"}
    ]

    cursor = db.bookings.aggregate(pipeline)
    bookings = []

    async for b in cursor:
        event = b["eventData"]
        ticket = b["ticketData"]

        start_date = event.get("start_date")
        date_iso = start_date.isoformat() if hasattr(start_date, "isoformat") else str(start_date)
        
        location = event.get("venue") or event.get("city") or ""
        if event.get("city") and location != event.get("city"):
            location = f"{location}, {event['city']}" if location else event["city"]

        created_at = b.get("created_at")
        created_at_iso = created_at.isoformat() if created_at and hasattr(created_at, "isoformat") else (str(created_at) if created_at else "")

        bookings.append({
            "booking_id": str(b["_id"]),
            "event": {
                "id": str(event["_id"]),
                "title": event["title"],
                "date": date_iso,
                "location": location,
                "city": event.get("city", ""),
                "banner_url": event.get("banner_url"),
            },
            "ticket": {
                "id": str(ticket["_id"]),
                "title": ticket["title"],
                "price": float(ticket["price"]),
            },
            "quantity": int(b["quantity"]),
            "total_amount": float(b["total_amount"]),
            "status": b.get("status", "PENDING"),
            "created_at": created_at_iso,
        })

    return bookings


@router.delete("/me/bookings/{booking_id}")
async def cancel_user_booking(booking_id: str, current_user=Depends(get_current_user())):
    try:
        user_id = ObjectId(current_user["_id"]) if not isinstance(current_user["_id"], ObjectId) else current_user["_id"]
        booking_obj_id = ObjectId(booking_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    booking = await db.bookings.find_one({"_id": booking_obj_id, "user_id": user_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or not authorized")

    if booking["status"] == "CONFIRMED":
        # Restore ticket stock
        await db.tickets.update_one(
            {"_id": ObjectId(booking["ticket_id"])},
            {"$inc": {"sold": -booking["quantity"]}}
        )

    await db.bookings.delete_one({"_id": booking_obj_id})
    
    # Also attempt to clean up related payment record
    await db.payments.delete_one({"booking_id": booking_id})

    return {"message": "Booking deleted successfully."}


# ================= SEARCH EVENTS =================
@router.post("/me/wishlist/{event_id}")
async def add_to_wishlist(event_id: str, current_user=Depends(get_current_user())):
    try:
        user_id = ObjectId(current_user["_id"]) if not isinstance(current_user["_id"], ObjectId) else current_user["_id"]
        event_obj_id = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")

    # Verify event exists
    event = await db.events.find_one({"_id": event_obj_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await db.users.update_one(
        {"_id": user_id},
        {"$addToSet": {"wishlist": event_id}}
    )
    return {"message": "Event added to wishlist"}

@router.delete("/me/wishlist/{event_id}")
async def remove_from_wishlist(event_id: str, current_user=Depends(get_current_user())):
    try:
        user_id = ObjectId(current_user["_id"]) if not isinstance(current_user["_id"], ObjectId) else current_user["_id"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    await db.users.update_one(
        {"_id": user_id},
        {"$pull": {"wishlist": event_id}}
    )
    return {"message": "Event removed from wishlist"}

@router.get("/me/wishlist", response_model=List[EventWithTicketsOut])
async def get_wishlist(current_user=Depends(get_current_user())):
    try:
        user_id = ObjectId(current_user["_id"]) if not isinstance(current_user["_id"], ObjectId) else current_user["_id"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    wishlist_ids = user.get("wishlist", [])
    if not wishlist_ids:
        return []

    try:
        object_ids = [ObjectId(eid) for eid in wishlist_ids]
    except Exception:
        object_ids = []

    if not object_ids:
        return []

    event_cursor = db.events.find({"_id": {"$in": object_ids}}, EVENT_SEARCH_PROJECTION).sort("created_at", -1)
    events = await event_cursor.to_list(length=None)
    
    if not events:
        return []

    event_ids = [str(event["_id"]) for event in events]
    ticket_cursor = db.tickets.find({"event_id": {"$in": event_ids}})

    tickets_by_event = {eid: [] for eid in event_ids}
    async for ticket in ticket_cursor:
        eid = ticket.get("event_id")
        if not eid:
            continue

        tickets_by_event.setdefault(eid, []).append(
            {
                "id": str(ticket["_id"]),
                "event_id": eid,
                "title": ticket.get("title", ""),
                "price": float(ticket.get("price", 0)),
                "quantity": int(ticket.get("quantity", 0)),
                "sold": int(ticket.get("sold", 0)),
                "created_at": ticket.get("created_at"),
            }
        )

    for eid, ticket_list in tickets_by_event.items():
        ticket_list.sort(key=lambda t: t["price"])

    response = []
    for event in events:
        eid = str(event["_id"])
        event["id"] = eid
        event["organizer_id"] = str(event["organizer_id"])
        del event["_id"]
        event["tickets"] = tickets_by_event.get(eid, [])
        response.append(event)

    return response


# ================= SEARCH EVENTS =================
@router.get("/stats")
async def get_public_stats():
    total_events = await db.events.count_documents({"status": "PUBLISHED"})
    total_organizers = await db.organizers.count_documents({})
    
    # Get distinct cities for published events
    cities = await db.events.distinct("city", {"status": "PUBLISHED"})
    total_cities = len([c for c in cities if c and c.strip()])
    
    total_vendors = await db.event_participants.count_documents({"role": "VENDOR"})
    total_volunteers = await db.event_participants.count_documents({"role": "VOLUNTEER"})
    
    return {
        "total_events": total_events,
        "total_organizers": total_organizers,
        "total_cities": total_cities,
        "total_vendors": total_vendors,
        "total_volunteers": total_volunteers,
        "total_sponsors": 50,  # Dummy stat as requested
    }

@router.get("/search", response_model=List[EventWithTicketsOut])
async def search_events(
    q: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    venue: Optional[str] = Query(None),
    show_past: bool = Query(False),
):
    query = {"status": "PUBLISHED"}

    if not show_past:
        from datetime import datetime
        query["start_date"] = {"$gte": datetime.utcnow()}

    if q and q.strip():
        search_term = re.escape(q.strip())
        regex = {"$regex": search_term, "$options": "i"}
        query["$or"] = [
            {"title": regex},
            {"city": regex},
            {"venue": regex},
        ]

    if city and city.strip():
        query["city"] = {"$regex": city.strip(), "$options": "i"}

    if venue and venue.strip():
        query["venue"] = {"$regex": venue.strip(), "$options": "i"}

    event_cursor = db.events.find(query, EVENT_SEARCH_PROJECTION).sort("created_at", -1)
    events = await event_cursor.to_list(length=None)
    if not events:
        return []

    event_ids = [str(event["_id"]) for event in events]
    ticket_cursor = db.tickets.find({"event_id": {"$in": event_ids}})

    tickets_by_event = {event_id: [] for event_id in event_ids}
    async for ticket in ticket_cursor:
        event_id = ticket.get("event_id")
        if not event_id:
            continue

        tickets_by_event.setdefault(event_id, []).append(
            {
                "id": str(ticket["_id"]),
                "event_id": event_id,
                "title": ticket.get("title", ""),
                "price": float(ticket.get("price", 0)),
                "quantity": int(ticket.get("quantity", 0)),
                "sold": int(ticket.get("sold", 0)),
                "created_at": ticket.get("created_at"),
            }
        )

    for event_id, ticket_list in tickets_by_event.items():
        ticket_list.sort(key=lambda t: t["price"])

    response = []
    for event in events:
        event_id = str(event["_id"])
        event["id"] = event_id
        event["organizer_id"] = str(event["organizer_id"])
        del event["_id"]
        event["tickets"] = tickets_by_event.get(event_id, [])
        response.append(event)

    return response


# ================= CITIES (EVENTS GROUPED BY CITY) =================
@router.get("/cities")
async def events_by_city():
    """Return list of cities with published event counts and optional banner image."""
    pipeline = [
        {"$match": {"status": "PUBLISHED"}},
        {
            "$group": {
                "_id": "$city",
                "count": {"$sum": 1},
                "banner_url": {"$first": "$banner_url"},
            }
        },
        {"$match": {"_id": {"$nin": [None, ""]}}},
        {"$sort": {"count": -1}},
        {
            "$project": {
                "_id": 0,
                "name": "$_id",
                "events": "$count",
                "image": "$banner_url",
            }
        },
    ]
    cursor = db.events.aggregate(pipeline)
    result = []
    async for doc in cursor:
        result.append({
            "name": doc["name"],
            "events": doc["events"],
            "image": doc.get("image") or None,
        })
    return result


# ================= SUGGESTIONS =================
@router.get("/suggestions", response_model=List[str])
async def event_suggestions(q: Optional[str] = Query(None)):
    if not q or not q.strip():
        return []

    search_term = q.strip()
    # Escape regex special chars so user input doesn't break the query
    escaped = re.escape(search_term)
    regex = {"$regex": escaped, "$options": "i"}

    cursor = db.events.find(
        {
            "status": "PUBLISHED",
            "$or": [
                {"title": regex},
                {"city": regex},
                {"venue": regex},
            ],
        },
        {"_id": 0, "title": 1, "city": 1, "venue": 1},
    ).limit(12)

    suggestions = set()
    async for doc in cursor:
        for val in (doc.get("title"), doc.get("city"), doc.get("venue")):
            if val and isinstance(val, str) and val.strip():
                suggestions.add(val.strip())

    # Return as list, sorted so matching prefix appears first
    result = list(suggestions)
    result.sort(key=lambda s: (not s.lower().startswith(search_term.lower()), s.lower()))
    return result[:10]
