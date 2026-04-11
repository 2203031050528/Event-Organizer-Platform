from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId

from app.core.database import db
from app.common.utils.dependencies import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _verify_event_owner(event_id: str, user_id: ObjectId):
    """Ensure organizer owns this event."""
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.get("organizer_id")) != str(user_id):
        raise HTTPException(status_code=403, detail="Not your event")
    return event


# ─── Attendance Report ────────────────────────────────────────────────────────

@router.get("/{event_id}/attendance")
async def attendance_report(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """
    Attendance breakdown:
    - Total tickets sold
    - Confirmed bookings
    - Checked-in count
    - Check-in rate
    - Per-ticket-type breakdown
    """
    await _verify_event_owner(event_id, current_user["_id"])

    # Overall bookings
    bookings_pipeline = [
        {"$match": {"event_id": event_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "tickets": {"$sum": "$quantity"}
        }}
    ]
    status_rows = await db.bookings.aggregate(bookings_pipeline).to_list(None)
    status_map = {r["_id"]: r for r in status_rows}

    confirmed = status_map.get("CONFIRMED", {})
    total_confirmed = confirmed.get("count", 0)
    total_tickets_sold = confirmed.get("tickets", 0)

    # Check-in count
    checkin_pipeline = [
        {"$match": {"event_id": event_id, "status": "CONFIRMED", "checked_in": True}},
        {"$count": "checked_in"}
    ]
    checkin_rows = await db.bookings.aggregate(checkin_pipeline).to_list(None)
    checked_in = checkin_rows[0]["checked_in"] if checkin_rows else 0

    # Per-ticket-type breakdown
    ticket_pipeline = [
        {"$match": {"event_id": event_id, "status": "CONFIRMED"}},
        {"$group": {
            "_id": "$ticket_id",
            "bookings": {"$sum": 1},
            "tickets_sold": {"$sum": "$quantity"},
            "revenue": {"$sum": "$total_amount"},
        }},
        {"$sort": {"tickets_sold": -1}}
    ]
    ticket_rows = await db.bookings.aggregate(ticket_pipeline).to_list(None)

    # Enrich with ticket names
    ticket_breakdown = []
    for row in ticket_rows:
        ticket_doc = await db.tickets.find_one({"_id": ObjectId(row["_id"])}) if row["_id"] else None
        ticket_breakdown.append({
            "ticket_id": str(row["_id"]) if row["_id"] else "unknown",
            "ticket_name": ticket_doc.get("title", "Unknown") if ticket_doc else "Unknown",
            "bookings": row["bookings"],
            "tickets_sold": row["tickets_sold"],
            "revenue": round(row["revenue"], 2),
        })

    # Daily registration trend
    daily_pipeline = [
        {"$match": {"event_id": event_id, "status": "CONFIRMED"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
            "tickets": {"$sum": "$quantity"}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_trend = await db.bookings.aggregate(daily_pipeline).to_list(None)

    return {
        "total_bookings": total_confirmed,
        "total_tickets_sold": total_tickets_sold,
        "checked_in": checked_in,
        "not_checked_in": total_confirmed - checked_in,
        "checkin_rate": round((checked_in / total_confirmed * 100) if total_confirmed > 0 else 0, 1),
        "by_status": {r["_id"]: {"count": r["count"], "tickets": r["tickets"]} for r in status_rows},
        "by_ticket": ticket_breakdown,
        "daily_trend": [{"date": r["_id"], "bookings": r["count"], "tickets": r["tickets"]} for r in daily_trend],
    }


# ─── Revenue Report ─────────────────────────────────────────────────────────

@router.get("/{event_id}/revenue")
async def revenue_report(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """
    Revenue breakdown:
    - Total ticket revenue
    - Revenue by ticket type
    - Revenue by day
    - Average order value
    - Refund amount
    """
    await _verify_event_owner(event_id, current_user["_id"])

    # Total confirmed revenue
    revenue_pipeline = [
        {"$match": {"event_id": event_id, "status": "CONFIRMED"}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$total_amount"},
            "total_bookings": {"$sum": 1},
            "total_discount": {"$sum": {"$ifNull": ["$discount_applied", 0]}}
        }}
    ]
    rev_rows = await db.bookings.aggregate(revenue_pipeline).to_list(None)
    rev = rev_rows[0] if rev_rows else {"total_revenue": 0, "total_bookings": 0, "total_discount": 0}

    avg_order = rev["total_revenue"] / rev["total_bookings"] if rev["total_bookings"] > 0 else 0

    # Revenue by day
    daily_pipeline = [
        {"$match": {"event_id": event_id, "status": "CONFIRMED"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "revenue": {"$sum": "$total_amount"},
            "bookings": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_revenue = await db.bookings.aggregate(daily_pipeline).to_list(None)

    # Refund total
    refund_pipeline = [
        {"$match": {"event_id": event_id, "status": "CANCELLED"}},
        {"$group": {"_id": None, "refunded": {"$sum": "$total_amount"}, "count": {"$sum": 1}}}
    ]
    refund_rows = await db.bookings.aggregate(refund_pipeline).to_list(None)
    refund = refund_rows[0] if refund_rows else {"refunded": 0, "count": 0}

    # Expense total (from financials module)
    expense_pipeline = [
        {"$match": {"event_id": event_id}},
        {"$group": {"_id": None, "total_expenses": {"$sum": "$amount"}}}
    ]
    expense_rows = await db.event_expenses.aggregate(expense_pipeline).to_list(None)
    total_expenses = expense_rows[0]["total_expenses"] if expense_rows else 0

    return {
        "gross_revenue": round(rev["total_revenue"], 2),
        "total_discount_given": round(rev["total_discount"], 2),
        "net_revenue": round(rev["total_revenue"] - rev["total_discount"], 2),
        "total_bookings": rev["total_bookings"],
        "avg_order_value": round(avg_order, 2),
        "refunded_amount": round(refund["refunded"], 2),
        "refund_count": refund["count"],
        "total_expenses": round(total_expenses, 2),
        "profit": round(rev["total_revenue"] - total_expenses, 2),
        "daily_revenue": [{"date": r["_id"], "revenue": round(r["revenue"], 2), "bookings": r["bookings"]} for r in daily_revenue],
    }


# ─── Vendor Performance ─────────────────────────────────────────────────────

@router.get("/{event_id}/vendors")
async def vendor_report(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Vendor bookings and spend breakdown for the event."""
    await _verify_event_owner(event_id, current_user["_id"])

    pipeline = [
        {"$match": {"event_id": event_id}},
        {"$group": {
            "_id": "$vendor_id",
            "total_amount": {"$sum": "$total_amount"},
            "booking_count": {"$sum": 1},
            "statuses": {"$push": "$status"}
        }},
        {"$sort": {"total_amount": -1}}
    ]
    rows = await db.vendor_bookings.aggregate(pipeline).to_list(None)

    vendors = []
    for row in rows:
        vendor_doc = await db.vendors.find_one({"_id": row["_id"]})
        vendors.append({
            "vendor_id": str(row["_id"]),
            "business_name": vendor_doc.get("business_name", "Unknown") if vendor_doc else "Unknown",
            "category": vendor_doc.get("category", "") if vendor_doc else "",
            "total_amount": round(row["total_amount"], 2),
            "booking_count": row["booking_count"],
            "confirmed": row["statuses"].count("CONFIRMED") + row["statuses"].count("COMPLETED"),
            "pending": row["statuses"].count("PENDING"),
            "rejected": row["statuses"].count("REJECTED"),
            "avg_rating": vendor_doc.get("avg_rating", 0) if vendor_doc else 0,
        })

    total_vendor_spend = sum(v["total_amount"] for v in vendors)

    return {
        "total_vendor_spend": round(total_vendor_spend, 2),
        "vendor_count": len(vendors),
        "vendors": vendors,
    }


# ─── Engagement Report ───────────────────────────────────────────────────────

@router.get("/{event_id}/engagement")
async def engagement_report(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Survey responses, email blast engagement, and transport bookings."""
    await _verify_event_owner(event_id, current_user["_id"])

    # Survey responses
    survey = await db.surveys.find_one({"event_id": event_id})
    survey_response_count = 0
    if survey:
        survey_response_count = await db.survey_responses.count_documents({"event_id": event_id})

    # Email blasts
    blast_cursor = db.email_blasts.find({"event_id": event_id}, sort=[("sent_at", -1)])
    blasts = []
    async for blast in blast_cursor:
        blasts.append({
            "subject": blast.get("subject", ""),
            "target": blast.get("target", ""),
            "recipients": blast.get("recipients", 0),
            "failed": blast.get("failed", 0),
            "sent_at": blast["sent_at"].isoformat() if blast.get("sent_at") else "",
        })

    # Transport bookings
    transport_pipeline = [
        {"$match": {"event_id": event_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_fare": {"$sum": "$fare"}
        }}
    ]
    transport_rows = await db.transport_bookings.aggregate(transport_pipeline).to_list(None)

    return {
        "survey_responses": survey_response_count,
        "has_survey": survey is not None,
        "email_blasts": blasts,
        "email_blast_count": len(blasts),
        "transport": {
            "total": sum(r["count"] for r in transport_rows),
            "total_fare": round(sum(r["total_fare"] for r in transport_rows), 2),
            "by_status": {r["_id"]: {"count": r["count"], "fare": round(r["total_fare"], 2)} for r in transport_rows},
        },
    }


# ─── Full Report (Combined) ─────────────────────────────────────────────────

@router.get("/{event_id}/full")
async def full_report(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Aggregates all report sections into one response."""
    event = await _verify_event_owner(event_id, current_user["_id"])

    # Reuse individual endpoints
    attendance = await attendance_report(event_id, current_user)
    revenue = await revenue_report(event_id, current_user)
    vendors = await vendor_report(event_id, current_user)
    engagement = await engagement_report(event_id, current_user)

    return {
        "event_id": event_id,
        "event_title": event.get("title", ""),
        "generated_at": datetime.utcnow().isoformat(),
        "attendance": attendance,
        "revenue": revenue,
        "vendors": vendors,
        "engagement": engagement,
    }
