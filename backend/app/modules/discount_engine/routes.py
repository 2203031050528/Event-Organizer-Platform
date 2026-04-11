from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.database import db
from app.common.utils.dependencies import get_current_user
from app.modules.discount_engine.engine import DiscountContext, evaluate_discounts, total_discount
from bson import ObjectId

router = APIRouter(prefix="/discounts/engine", tags=["discount-engine"])


class EvaluateRequest(BaseModel):
    event_id: str
    ticket_id: str
    quantity: int
    promo_code: Optional[str] = None


@router.post("/evaluate")
async def evaluate_booking_discounts(
    body: EvaluateRequest,
    current_user=Depends(get_current_user()),
):
    """
    Preview all combinable discounts applicable to a booking before confirming.
    Call this whenever quantity or promo code changes in the UI.
    """
    ticket = await db.tickets.find_one({"_id": ObjectId(body.ticket_id)})
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    event = await db.events.find_one({"_id": ObjectId(body.event_id)})
    if not event:
        raise HTTPException(404, "Event not found")

    subtotal = ticket["price"] * body.quantity

    ctx = DiscountContext(
        event_id=body.event_id,
        ticket_id=body.ticket_id,
        user_id=str(current_user["_id"]),
        quantity=body.quantity,
        subtotal=subtotal,
        promo_code=body.promo_code,
        user=current_user,
        event=event,
        ticket=ticket,
    )

    amount, discounts = await total_discount(ctx, db)

    return {
        "subtotal": subtotal,
        "total_discount": amount,
        "final_price": max(0.0, subtotal - amount),
        "discounts": [
            {
                "type": d.discount_type,
                "label": d.label,
                "amount": d.value,
                "code": d.code,
            }
            for d in discounts
        ],
    }
