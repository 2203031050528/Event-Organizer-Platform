from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from bson import ObjectId
from datetime import datetime

from app.core.database import db
from app.common.utils.dependencies import get_current_user
from app.modules.sponsors.schemas import (
    SponsorPackageCreate,
    SponsorPackageOut,
    SponsorCreate,
    SponsorOut,
    SponsorStatusUpdate
)

router = APIRouter(prefix="/sponsors", tags=["sponsors"])

def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc.pop("_id"))
    for key in ["event_id", "package_id", "user_id", "organizer_id"]:
        if key in doc and isinstance(doc[key], ObjectId):
            doc[key] = str(doc[key])
        elif key in doc:
            doc[key] = str(doc[key])
    return doc

async def _verify_event_owner(event_id: str, user_id: ObjectId):
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.get("organizer_id")) != str(user_id):
        raise HTTPException(status_code=403, detail="Not your event")
    return event


# ─── Packages ─────────────────────────────────────────────────────────────────

@router.post("/events/{event_id}/packages", response_model=SponsorPackageOut, status_code=201)
async def create_sponsor_package(
    event_id: str,
    payload: SponsorPackageCreate,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """(Organizer) Create a new sponsorship package."""
    event = await _verify_event_owner(event_id, current_user["_id"])
    
    doc = payload.model_dump()
    doc["event_id"] = str(event["_id"])
    doc["organizer_id"] = str(current_user["_id"])
    doc["sold_slots"] = 0
    doc["created_at"] = datetime.utcnow()
    
    result = await db.sponsor_packages.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.get("/events/{event_id}/packages", response_model=List[SponsorPackageOut])
async def list_sponsor_packages(event_id: str):
    """(Public) List available sponsor packages for an event."""
    try:
        ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event id")
    
    packages = await db.sponsor_packages.find({"event_id": event_id}).to_list(None)
    return [_serialize(p) for p in packages]


@router.delete("/packages/{package_id}", status_code=204)
async def delete_sponsor_package(
    package_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """(Organizer) Delete a sponsor package (if no sponsors booked it)."""
    package = await db.sponsor_packages.find_one({"_id": ObjectId(package_id)})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Must own the event
    await _verify_event_owner(package["event_id"], current_user["_id"])
    
    if package.get("sold_slots", 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a package that has active sponsors")
    
    await db.sponsor_packages.delete_one({"_id": ObjectId(package_id)})
    return None


# ─── Sponsor Registration ─────────────────────────────────────────────────────

@router.post("/register", response_model=SponsorOut, status_code=201)
async def register_sponsor(
    payload: SponsorCreate,
    current_user=Depends(get_current_user())  # Any logged in user can apply to sponsor
):
    """(Sponsor/User) Register as a sponsor by purchasing a package."""
    package = await db.sponsor_packages.find_one({"_id": ObjectId(payload.package_id)})
    if not package:
        raise HTTPException(status_code=404, detail="Sponsor package not found")
    
    if package["sold_slots"] >= package["available_slots"]:
        raise HTTPException(status_code=400, detail="Package sold out")
    
    event_id = package["event_id"]
    
    doc = payload.model_dump()
    doc["event_id"] = event_id
    doc["user_id"] = str(current_user["_id"])
    # Defaulting to pending. A real flow might go to payment first.
    doc["status"] = "PENDING"
    # Marking as completed for simplicity to assume it registers as invoice.
    doc["payment_status"] = "PENDING" 
    doc["amount_paid"] = package["price"]
    doc["created_at"] = datetime.utcnow()
    
    result = await db.sponsors.insert_one(doc)
    doc["_id"] = result.inserted_id
    
    # Increment sold slots
    await db.sponsor_packages.update_one(
        {"_id": package["_id"]},
        {"$inc": {"sold_slots": 1}}
    )
    
    doc["package_name"] = package["name"]
    return _serialize(doc)


from app.common.utils.dependencies import get_current_user, get_optional_user

# ...

@router.get("/events/{event_id}/sponsors", response_model=List[SponsorOut])
async def list_event_sponsors(
    event_id: str,
    status: str = Query(None, description="Filter by status (e.g. APPROVED)"),
    current_user=Depends(get_optional_user)
):
    """
    (Organizer or Public) Get sponsors for an event.
    Public only sees 'APPROVED' status implicitly. Organizers can see all.
    """
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    is_organizer = False
    if current_user:
         is_organizer = str(event.get("organizer_id")) == str(current_user["_id"])
         print(f"DEBUG Sponsor: event.organizer_id={str(event.get('organizer_id'))}, current_user._id={str(current_user['_id'])}, is_organizer={is_organizer}")
    else:
         print(f"DEBUG Sponsor: current_user is None!")
         
    query = {"event_id": event_id}
    
    if not is_organizer:
        query["status"] = "APPROVED"
        # If public, enforce approved only
    else:
        if status:
            query["status"] = status.upper()

    sponsors = await db.sponsors.find(query).sort("created_at", -1).to_list(None)
    
    # Map package names
    for s in sponsors:
        package = await db.sponsor_packages.find_one({"_id": ObjectId(s["package_id"])})
        if package:
            s["package_name"] = package.get("name", "Unknown")
            
    return [_serialize(s) for s in sponsors]


@router.put("/manage/{sponsor_id}/status")
async def update_sponsor_status(
    sponsor_id: str,
    payload: SponsorStatusUpdate,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """(Organizer) Approve or reject a sponsor."""
    sponsor = await db.sponsors.find_one({"_id": ObjectId(sponsor_id)})
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
        
    # Must own the event
    await _verify_event_owner(sponsor["event_id"], current_user["_id"])
    
    new_status = payload.status.upper()
    if new_status not in ["APPROVED", "REJECTED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    await db.sponsors.update_one(
        {"_id": ObjectId(sponsor_id)},
        {"$set": {"status": new_status}}
    )
    
    # If rejected, we might want to decrement the sold slots to free up package space
    if new_status == "REJECTED" and sponsor.get("status") != "REJECTED":
        await db.sponsor_packages.update_one(
            {"_id": ObjectId(sponsor["package_id"])},
            {"$inc": {"sold_slots": -1}}
        )
    elif new_status != "REJECTED" and sponsor.get("status") == "REJECTED":
        # Re-approving restores the slot count
         await db.sponsor_packages.update_one(
            {"_id": ObjectId(sponsor["package_id"])},
            {"$inc": {"sold_slots": 1}}
        )
        
    sponsor["status"] = new_status
    return {"message": f"Sponsor status updated to {new_status}"}
