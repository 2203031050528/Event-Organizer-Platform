from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.core.database import db
from app.common.utils.security import hash_password
from app.common.utils.jwt import create_access_token
from app.common.utils.dependencies import get_current_user
from app.modules.vendors.models import (
    VendorRegister, VendorProfileOut, VendorServiceCreate, 
    VendorServiceOut, VendorBookingCreate, VendorReviewCreate
)

router = APIRouter(prefix="/vendors", tags=["vendors"])


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    if "user_id" in doc: doc["user_id"] = str(doc["user_id"])
    if "vendor_id" in doc: doc["vendor_id"] = str(doc["vendor_id"])
    if "service_id" in doc: doc["service_id"] = str(doc["service_id"])
    if "event_id" in doc: doc["event_id"] = str(doc["event_id"])
    if "organizer_id" in doc: doc["organizer_id"] = str(doc["organizer_id"])
    
    for key in ["created_at", "updated_at", "date"]:
        if key in doc and doc[key]:
            doc[key] = doc[key].isoformat()
    return doc


# ─── Auth / Registration ──────────────────────────────────────────────────────

@router.post("/register")
async def register_vendor(data: VendorRegister):
    """Register a new user with the VENDOR role and create a pending vendor profile."""
    # Check email exists
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    # 1. Create Base User
    user_doc = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": "VENDOR",
        "created_at": datetime.utcnow()
    }
    user_res = await db.users.insert_one(user_doc)
    user_id = user_res.inserted_id

    # 2. Create Vendor Profile
    vendor_doc = {
        "user_id": user_id,
        "business_name": data.business_name,
        "category": data.category.upper(),
        "description": data.description,
        "contact_phone": data.contact_phone,
        "contact_email": data.contact_email,
        "address": data.address,
        "city": data.city,
        "kyc_status": "PENDING",
        "avg_rating": 0.0,
        "total_reviews": 0,
        "is_available": True,
        "created_at": datetime.utcnow()
    }
    await db.vendors.insert_one(vendor_doc)
    
    # 3. Return auth token so they can log in immediately
    access_token = create_access_token(data={"sub": data.email})
    return {"access_token": access_token, "token_type": "bearer"}


# ─── Vendor Self-Management (Role: VENDOR) ───────────────────────────────────

@router.get("/me")
async def get_my_vendor_profile(current_user=Depends(get_current_user(required_role="VENDOR"))):
    """Get the active vendor's profile."""
    vendor = await db.vendors.find_one({"user_id": current_user["_id"]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    return _serialize(vendor)


@router.get("/me/services")
async def get_my_services(current_user=Depends(get_current_user(required_role="VENDOR"))):
    """List all services offered by the active vendor."""
    vendor = await db.vendors.find_one({"user_id": current_user["_id"]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    
    cursor = db.vendor_services.find({"vendor_id": vendor["_id"]})
    return [_serialize(doc) async for doc in cursor]


@router.post("/me/services")
async def create_service(data: VendorServiceCreate, current_user=Depends(get_current_user(required_role="VENDOR"))):
    """Vendor adds a new service."""
    vendor = await db.vendors.find_one({"user_id": current_user["_id"]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    
    doc = data.dict()
    doc["vendor_id"] = vendor["_id"]
    doc["created_at"] = datetime.utcnow()
    
    res = await db.vendor_services.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize(doc)


@router.get("/me/bookings")
async def get_vendor_bookings(current_user=Depends(get_current_user(required_role="VENDOR"))):
    """Vendor views bookings made for their services."""
    vendor = await db.vendors.find_one({"user_id": current_user["_id"]})
    if not vendor:
         raise HTTPException(status_code=404, detail="Vendor profile not found")
    
    pipeline = [
        {"$match": {"vendor_id": vendor["_id"]}},
        {"$sort": {"date": 1}},
        {"$addFields": {"event_obj_id": {"$toObjectId": "$event_id"}}},
        {"$lookup": {
            "from": "events",
            "localField": "event_obj_id",
            "foreignField": "_id",
            "as": "eventData"
        }},
        {"$unwind": {"path": "$eventData", "preserveNullAndEmptyArrays": True}}
    ]

    cursor = db.vendor_bookings.aggregate(pipeline)
    bookings = []
    async for doc in cursor:
        doc["event_title"] = doc.get("eventData", {}).get("title", "Unknown Event")
        if "eventData" in doc:
            del doc["eventData"]
        if "event_obj_id" in doc:
            del doc["event_obj_id"]
        bookings.append(_serialize(doc))
        
    return bookings


@router.put("/me/bookings/{booking_id}/status")
async def update_vendor_booking_status(
    booking_id: str, 
    status: str, 
    current_user=Depends(get_current_user(required_role="VENDOR"))
):
    """Vendor accepts/rejects or completes a booking."""
    vendor = await db.vendors.find_one({"user_id": current_user["_id"]})
    
    valid_status = {"CONFIRMED", "REJECTED", "COMPLETED"}
    if status.upper() not in valid_status:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    res = await db.vendor_bookings.update_one(
        {"_id": ObjectId(booking_id), "vendor_id": vendor["_id"]},
        {"$set": {"status": status.upper()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": f"Booking marked as {status.upper()}"}


# ─── Public Browsing / Organizer Booking ─────────────────────────────────────

@router.get("/")
async def list_approved_vendors(category: Optional[str] = None, city: Optional[str] = None):
    """List vendors that have passed KYC. Optionally filter by category/city."""
    query = {"kyc_status": "APPROVED", "is_available": True}
    if category: query["category"] = category.upper()
    if city: query["city"] = {"$regex": city, "$options": "i"}

    cursor = db.vendors.find(query, sort=[("avg_rating", -1)])
    vendors = [_serialize(doc) async for doc in cursor]
    
    # Attach services to each vendor for easier frontend rendering
    for v in vendors:
        srv_cursor = db.vendor_services.find({"vendor_id": ObjectId(v["_id"]), "is_available": True})
        v["services"] = [_serialize(s) async for s in srv_cursor]
        
    return vendors


@router.get("/{vendor_id}")
async def get_vendor_details(vendor_id: str):
    """Get single vendor with their services and recent reviews."""
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id), "kyc_status": "APPROVED"})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found or not approved")
        
    v_dict = _serialize(vendor)
    
    srv_cursor = db.vendor_services.find({"vendor_id": ObjectId(vendor_id)})
    v_dict["services"] = [_serialize(s) async for s in srv_cursor]
    
    rev_cursor = db.vendor_reviews.find({"vendor_id": ObjectId(vendor_id)}, sort=[("created_at", -1)]).limit(10)
    v_dict["reviews"] = [_serialize(r) async for r in rev_cursor]
    
    return v_dict


@router.post("/{vendor_id}/book")
async def book_vendor_service(
    vendor_id: str, 
    data: VendorBookingCreate, 
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Organizer requests a service from a vendor."""
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id), "kyc_status": "APPROVED", "is_available": True})
    if not vendor:
        raise HTTPException(status_code=400, detail="Vendor not available")
        
    service = await db.vendor_services.find_one({"_id": ObjectId(data.service_id), "vendor_id": ObjectId(vendor_id)})
    if not service:
        raise HTTPException(status_code=400, detail="Service not found")
        
    # Check if event belongs to organizer
    event = await db.events.find_one({"_id": ObjectId(data.event_id), "organizer_id": current_user["_id"]})
    if not event:
        raise HTTPException(status_code=403, detail="Not your event")
        
    # Calculate initial quoted price
    base = service["base_price"]
    total = base
    if service["price_type"] == "PER_HOUR" and data.duration_hours:
        total = base * data.duration_hours
    elif service["price_type"] == "PER_UNIT" and data.quantity:
        total = base * data.quantity
        
    booking_doc = {
        "vendor_id": vendor["_id"],
        "service_id": service["_id"],
        "event_id": str(event["_id"]),
        "organizer_id": current_user["_id"],
        "date": data.date,
        "duration_hours": data.duration_hours,
        "quantity": data.quantity,
        "total_amount": total,
        "status": "PENDING",
        "notes": data.notes,
        "created_at": datetime.utcnow()
    }
    
    res = await db.vendor_bookings.insert_one(booking_doc)
    return {"message": "Booking requested successfully", "booking_id": str(res.inserted_id)}


@router.post("/{vendor_id}/review")
async def leave_vendor_review(
    vendor_id: str,
    data: VendorReviewCreate,
    current_user=Depends(get_current_user())
):
    """Leave a review for a vendor service. Must have a confirmed/completed booking."""
    # Check valid booking
    booking = await db.vendor_bookings.find_one({
        "vendor_id": ObjectId(vendor_id),
        "service_id": ObjectId(data.service_id),
        "organizer_id": current_user["_id"],
        "status": {"$in": ["CONFIRMED", "COMPLETED"]}
    })
    if not booking:
        raise HTTPException(status_code=400, detail="No valid past booking to review")
        
    # Insert Review
    doc = {
        "vendor_id": ObjectId(vendor_id),
        "service_id": ObjectId(data.service_id),
        "reviewer_id": current_user["_id"],
        "reviewer_name": current_user.get("name", "Organizer"),
        "rating": data.rating,
        "comment": data.comment,
        "created_at": datetime.utcnow()
    }
    await db.vendor_reviews.insert_one(doc)
    
    # Update Vendor Averages
    pipeline = [
        {"$match": {"vendor_id": ObjectId(vendor_id)}},
        {"$group": {"_id": "$vendor_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    stats = await db.vendor_reviews.aggregate(pipeline).to_list(None)
    if stats:
        await db.vendors.update_one(
            {"_id": ObjectId(vendor_id)},
            {"$set": {"avg_rating": round(stats[0]["avg"], 1), "total_reviews": stats[0]["count"]}}
        )
        
    return {"message": "Review submitted"}


# ─── Admin Vendor Management ─────────────────────────────────────────────────

@router.get("/admin/list", tags=["admin"])
async def admin_list_vendors(status: Optional[str] = None, current_user=Depends(get_current_user(required_role="ADMIN"))):
    """Admin views all vendors (pending KYC, approved, etc)."""
    query = {}
    if status:
        query["kyc_status"] = status.upper()
    cursor = db.vendors.find(query, sort=[("created_at", -1)])
    return [_serialize(doc) async for doc in cursor]


@router.put("/admin/{vendor_id}/kyc", tags=["admin"])
async def admin_update_vendor_kyc(
    vendor_id: str, 
    kyc_status: str, 
    current_user=Depends(get_current_user(required_role="ADMIN"))
):
    """Admin approves or rejects a vendor profile."""
    valid = {"PENDING", "APPROVED", "REJECTED"}
    if kyc_status.upper() not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    res = await db.vendors.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {"kyc_status": kyc_status.upper()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    return {"message": f"Vendor KYC updated to {kyc_status.upper()}"}
