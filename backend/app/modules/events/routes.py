from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from typing import List, Optional
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

from app.common.utils.dependencies import get_current_user
from app.core.database import db
from app.modules.events.schemas import (
    EventCreate,
    EventUpdate,
    EventOut,
    AddonCreate,
    AddonOut,
)
from app.modules.events.addon_models import AddonDB
from app.modules.events.service import (
    create_event_service,
    update_event_service,
)

router = APIRouter(prefix="/events", tags=["events"])

EVENT_PUBLIC_PROJECTION = {
    "_id": 1,
    "organizer_id": 1,
    "title": 1,
    "description": 1,
    "category": 1,
    "tags": 1,
    "type": 1,
    "city": 1,
    "venue": 1,
    "start_date": 1,
    "end_date": 1,
    "banner_url": 1,
    "status": 1,
    "agenda": 1,
    "demo_video_url": 1,
    "demo_video_type": 1,
    "demo_thumbnail_url": 1,
    "pre_launch_discount_pct": 1,
    "pre_launch_ends_at": 1,
    "created_at": 1,
}


def _serialize_event(event: dict) -> dict:
    event["id"] = str(event.pop("_id"))
    event["organizer_id"] = str(event["organizer_id"])
    return event


# ================= CREATE EVENT =================
@router.post("/")
async def create_event(
    payload: EventCreate,
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    try:
        event_id = await create_event_service(payload, current_user["_id"])
        return {"event_id": event_id, "message": "Event created"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ================= UPDATE EVENT =================
@router.put("/{event_id}")
async def update_event(
    event_id: str,
    payload: EventUpdate,
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    try:
        obj_id = ObjectId(event_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid event id")

    try:
        matched = await update_event_service(obj_id, payload, current_user["_id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if matched == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"message": "Event updated"}


# ================= DELETE EVENT =================
@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    try:
        obj_id = ObjectId(event_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid event id")

    result = await db.events.delete_one(
        {"_id": obj_id, "organizer_id": current_user["_id"]}
    )

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"message": "Event deleted"}


# ================= LIST EVENTS (PUBLIC) =================
@router.get("/", response_model=List[EventOut])
async def list_events(
    city: Optional[str] = None,
    category: Optional[str] = None,
    status: str = "PUBLISHED",
    limit: int = Query(10, ge=1, le=50),
    skip: int = Query(0, ge=0),
):
    query = {"status": status.strip().upper()}

    if city and city.strip():
        query["city"] = city.strip()
    if category and category.strip():
        query["category"] = category.strip()

    cursor = (
        db.events.find(query, EVENT_PUBLIC_PROJECTION)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    events = await cursor.to_list(length=limit)
    return [_serialize_event(event) for event in events]


# ================= GET SINGLE EVENT =================
@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: str):
    try:
        obj_id = ObjectId(event_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid event id")

    event = await db.events.find_one({"_id": obj_id}, EVENT_PUBLIC_PROJECTION)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return _serialize_event(event)


# ================= UPDATE AGENDA =================
from app.modules.events.schemas import AgendaItem

@router.put("/{event_id}/agenda")
async def update_event_agenda(
    event_id: str,
    agenda: List[AgendaItem],
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    try:
        obj_id = ObjectId(event_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid event id")

    # Verify event belongs to organizer
    event = await db.events.find_one({
        "_id": obj_id,
        "organizer_id": current_user["_id"]
    })
    if not event:
        raise HTTPException(status_code=404, detail="Event not found or not yours")

    # Save agenda as list of dicts
    agenda_dicts = [item.model_dump(by_alias=True) for item in agenda]
    
    await db.events.update_one(
        {"_id": obj_id},
        {"$set": {"agenda": agenda_dicts}}
    )

    return {"message": "Agenda updated successfully"}


# ================= ADDONS =================

@router.get("/{event_id}/addons", response_model=List[AddonOut])
async def list_event_addons(event_id: str):
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event id")

    cursor = db.addons.find({"event_id": str(obj_id)})
    addons = await cursor.to_list(length=100)
    for a in addons:
        a["id"] = str(a.pop("_id"))
    return addons


@router.post("/{event_id}/addons")
async def create_event_addon(
    event_id: str,
    payload: AddonCreate,
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event id")

    # Verify event belongs to organizer
    event = await db.events.find_one({
        "_id": obj_id,
        "organizer_id": current_user["_id"]
    })
    if not event:
        raise HTTPException(status_code=404, detail="Event not found or not yours")

    addon_data = payload.model_dump()
    addon_data["event_id"] = str(obj_id)
    addon_data["sold_quantity"] = 0
    addon_data["created_at"] = datetime.utcnow()

    result = await db.addons.insert_one(addon_data)
    return {"id": str(result.inserted_id), "message": "Addon created"}


@router.delete("/addons/{addon_id}")
async def delete_addon(
    addon_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER")),
):
    try:
        obj_id = ObjectId(addon_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid addon id")

    # Find addon to check ownership through event
    addon = await db.addons.find_one({"_id": obj_id})
    if not addon:
        raise HTTPException(status_code=404, detail="Addon not found")

    event = await db.events.find_one({
        "_id": ObjectId(addon["event_id"]),
        "organizer_id": current_user["_id"]
    })
    if not event:
        raise HTTPException(status_code=403, detail="Not authorized to delete this addon")

    await db.addons.delete_one({"_id": obj_id})
    return {"message": "Addon deleted"}

