from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from app.core.database import db
from app.modules.bookings.models import Booking
from app.common.utils.dependencies import get_current_user
from app.modules.discount_engine.engine import DiscountContext, total_discount

router = APIRouter(prefix="/bookings", tags=["bookings"])


# ---------------------------------------------------
# CREATE BOOKING
# ---------------------------------------------------
@router.post("/")
async def create_booking(
    data: Booking,
    current_user=Depends(get_current_user())
):

    ticket = await db.tickets.find_one({"_id": ObjectId(data.ticket_id)})
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    event = await db.events.find_one({"_id": ObjectId(ticket["event_id"])})
    if not event:
        raise HTTPException(404, "Event not found")

    # Prevent booking past events
    now = datetime.utcnow()
    # Handle both naive and timezone-aware datetime objects
    start_date = event.get("start_date")
    if start_date:
        if start_date.tzinfo is not None:
            import pytz
            now = now.replace(tzinfo=pytz.UTC)
        if start_date < now:
            raise HTTPException(400, "Cannot book tickets for past events")

    total = ticket["price"] * data.quantity
    
    # ------------------------------------------
    # ADDONS / MERCH
    # ------------------------------------------
    addons_info = []
    if data.addons:
        for item in data.addons:
            addon_id = item.get("addon_id")
            qty = item.get("quantity", 0)
            if not addon_id or qty <= 0:
                continue
                
            addon = await db.addons.find_one({"_id": ObjectId(addon_id)})
            if not addon:
                raise HTTPException(404, f"Addon {addon_id} not found")
            
            # Verify event match
            if str(addon["event_id"]) != str(event["_id"]):
                raise HTTPException(400, f"Addon {addon_id} does not belong to this event")

            item_price = addon["price"]
            total += item_price * qty
            addons_info.append({
                "addon_id": addon_id,
                "name": addon["name"],
                "quantity": qty,
                "price": item_price
            })

    # ------------------------------------------
    # DISCOUNT ENGINE (combinable)
    # ------------------------------------------
    ctx = DiscountContext(
        event_id=str(event["_id"]),
        ticket_id=data.ticket_id,
        user_id=str(current_user["_id"]),
        quantity=data.quantity,
        subtotal=total,   # total at this point = tickets + addons
        promo_code=data.discount_code,
        user=current_user,
        event=event,
        ticket=ticket,
    )
    discount_applied, applied_discounts = await total_discount(ctx, db)

    total = max(0, total - discount_applied)

    # Increment used_count for promo codes that were applied
    for d in applied_discounts:
        if d.code:
            await db.discount_codes.update_one(
                {"code": d.code.upper()},
                {"$inc": {"used_count": 1}}
            )

    discount_info = [
        {"type": d.discount_type, "label": d.label, "amount": d.value, "code": d.code}
        for d in applied_discounts
    ] if applied_discounts else []

    # ------------------------------------------
    # ATOMIC TICKET RESERVATION
    # ------------------------------------------
    ticket_update = await db.tickets.find_one_and_update(
        {
            "_id": ObjectId(data.ticket_id),
            "sold": {"$lte": ticket["quantity"] - data.quantity}
        },
        {"$inc": {"sold": data.quantity}},
        return_document=True
    )

    if not ticket_update:
        raise HTTPException(400, "Tickets sold out")

    # ------------------------------------------
    # CREATE BOOKING
    # ------------------------------------------
    booking_doc = {
        "ticket_id": data.ticket_id,
        "event_id": str(event["_id"]),
        "user_id": current_user["_id"],
        "quantity": data.quantity,
        "addons": addons_info,
        "discount_code": data.discount_code,
        "discount_applied": discount_applied,
        "total_amount": total,
        "status": "PENDING",
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=15)
    }

    result = await db.bookings.insert_one(booking_doc)

    return {
        "booking_id": str(result.inserted_id),
        "amount": total,
        "discount": discount_info
    }


# ---------------------------------------------------
# CANCEL BOOKING
# ---------------------------------------------------
@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    current_user=Depends(get_current_user())
):

    booking = await db.bookings.find_one({
        "_id": ObjectId(booking_id),
        "user_id": current_user["_id"]
    })

    if not booking:
        raise HTTPException(404, "Booking not found")

    if booking["status"] != "CONFIRMED":
        raise HTTPException(400, "Only confirmed bookings can be cancelled")

    # restore tickets
    await db.tickets.update_one(
        {"_id": ObjectId(booking["ticket_id"])},
        {"$inc": {"sold": -booking["quantity"]}}
    )

    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"status": "CANCELLED"}}
    )

    await db.payments.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "REFUNDED"}}
    )

    return {"message": "Booking cancelled & refund initiated"}


# ---------------------------------------------------
# SCAN QR CHECKIN
# ---------------------------------------------------
@router.post("/scan")
async def scan_ticket(
    payload: dict,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):

    booking_id = payload.get("booking_id")
    event_id = payload.get("event_id")

    if not booking_id or not event_id:
        raise HTTPException(400, "Invalid QR data")

    booking = await db.bookings.find_one({
        "_id": ObjectId(booking_id),
        "event_id": event_id,
        "status": "CONFIRMED"
    })

    if not booking:
        raise HTTPException(404, "Invalid or unpaid ticket")

    if booking.get("checked_in"):
        raise HTTPException(400, "Already checked in")

    await db.bookings.update_one(
        {"_id": booking["_id"]},
        {
            "$set": {
                "checked_in": True,
                "checked_in_at": datetime.utcnow()
            }
        }
    )

    return {
        "message": "Check-in successful",
        "booking_id": booking_id
    }