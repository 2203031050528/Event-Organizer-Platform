from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field
import io
import csv

from app.core.database import db
from app.common.utils.dependencies import get_current_user

router = APIRouter(prefix="/financials", tags=["financials"])


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    category: str  # VENUE | CATERING | MARKETING | VENDOR | AV | OTHER
    description: str
    amount: float = Field(gt=0)
    date: datetime
    receipt_url: Optional[str] = None


class ExpenseOut(BaseModel):
    id: str
    event_id: str
    organizer_id: str
    category: str
    description: str
    amount: float
    date: str
    receipt_url: Optional[str]
    created_at: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _serialize_expense(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc["event_id"] = str(doc["event_id"]) if isinstance(doc.get("event_id"), ObjectId) else doc.get("event_id", "")
    doc["organizer_id"] = str(doc["organizer_id"]) if isinstance(doc.get("organizer_id"), ObjectId) else str(doc.get("organizer_id", ""))
    for key in ["date", "created_at"]:
        if key in doc and doc[key]:
            doc[key] = doc[key].isoformat() if isinstance(doc[key], datetime) else doc[key]
    return doc


async def _get_organizer_event(event_id: str, organizer_user_id: ObjectId):
    """Ensure the event belongs to this organizer."""
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Find organizer record
    organizer = await db.organizers.find_one({"user_id": organizer_user_id})
    if not organizer or str(event.get("organizer_id")) != str(organizer["_id"]):
        raise HTTPException(status_code=403, detail="Not your event")

    return event, organizer


async def _compute_income(event_id: str) -> dict:
    """Aggregate confirmed ticket + addon income and vendor booking income."""
    # Ticket + addon income
    booking_pipeline = [
        {"$match": {"event_id": event_id, "status": "CONFIRMED"}},
        {"$group": {
            "_id": None,
            "ticket_income": {"$sum": "$total_amount"},
            "booking_count": {"$sum": 1}
        }}
    ]
    booking_result = await db.bookings.aggregate(booking_pipeline).to_list(None)
    ticket_income = booking_result[0]["ticket_income"] if booking_result else 0
    booking_count = booking_result[0]["booking_count"] if booking_result else 0

    # Vendor booking income (CONFIRMED or COMPLETED vendor bookings for this event)
    vendor_pipeline = [
        {"$match": {"event_id": event_id, "status": {"$in": ["CONFIRMED", "COMPLETED"]}}},
        {"$group": {"_id": None, "vendor_income": {"$sum": "$total_amount"}}}
    ]
    vendor_result = await db.vendor_bookings.aggregate(vendor_pipeline).to_list(None)
    vendor_income = vendor_result[0]["vendor_income"] if vendor_result else 0

    return {
        "ticket_income": round(ticket_income, 2),
        "vendor_income": round(vendor_income, 2),
        "total_income": round(ticket_income + vendor_income, 2),
        "confirmed_bookings": booking_count,
    }


async def _sum_expenses(event_id: str) -> dict:
    """Sum expenses grouped by category."""
    pipeline = [
        {"$match": {"event_id": event_id}},
        {"$group": {
            "_id": "$category",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}}
    ]
    rows = await db.event_expenses.aggregate(pipeline).to_list(None)
    total = sum(r["total"] for r in rows)
    by_category = [{"category": r["_id"], "amount": round(r["total"], 2), "count": r["count"]} for r in rows]
    return {"total_expenses": round(total, 2), "by_category": by_category}


# ─── Balance Sheet ────────────────────────────────────────────────────────────

@router.get("/{event_id}/balance-sheet")
async def get_balance_sheet(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Full income-vs-expense summary for an event."""
    await _get_organizer_event(event_id, current_user["_id"])

    income = await _compute_income(event_id)
    expenses = await _sum_expenses(event_id)

    net = income["total_income"] - expenses["total_expenses"]

    return {
        "event_id": event_id,
        "income": income,
        "expenses": expenses,
        "net_profit": round(net, 2),
        "is_profitable": net >= 0,
    }


# ─── Expenses CRUD ───────────────────────────────────────────────────────────

@router.post("/{event_id}/expenses", status_code=201)
async def add_expense(
    event_id: str,
    data: ExpenseCreate,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Add a new expense entry for an event."""
    event, organizer = await _get_organizer_event(event_id, current_user["_id"])

    doc = {
        "event_id": event_id,
        "organizer_id": organizer["_id"],
        "category": data.category.upper(),
        "description": data.description,
        "amount": data.amount,
        "date": data.date,
        "receipt_url": data.receipt_url,
        "created_at": datetime.utcnow(),
    }
    res = await db.event_expenses.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize_expense(doc)


@router.get("/{event_id}/expenses")
async def list_expenses(
    event_id: str,
    category: Optional[str] = None,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """List all expenses for an event, optionally filtered by category."""
    await _get_organizer_event(event_id, current_user["_id"])

    query: dict = {"event_id": event_id}
    if category:
        query["category"] = category.upper()

    cursor = db.event_expenses.find(query, sort=[("date", -1)])
    docs = [_serialize_expense(doc) async for doc in cursor]
    return docs


@router.delete("/{event_id}/expenses/{expense_id}", status_code=204)
async def delete_expense(
    event_id: str,
    expense_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Delete a specific expense entry."""
    await _get_organizer_event(event_id, current_user["_id"])

    res = await db.event_expenses.delete_one({
        "_id": ObjectId(expense_id),
        "event_id": event_id
    })
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return None


# ─── Export ──────────────────────────────────────────────────────────────────

@router.get("/{event_id}/export")
async def export_balance_sheet(
    event_id: str,
    format: str = Query("csv", enum=["csv"]),
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Export the full balance sheet as a CSV file."""
    event, _ = await _get_organizer_event(event_id, current_user["_id"])
    event_title = event.get("title", event_id)

    income = await _compute_income(event_id)
    expenses_data = await _sum_expenses(event_id)

    # All individual expense rows
    cursor = db.event_expenses.find({"event_id": event_id}, sort=[("date", 1)])
    expense_rows = [_serialize_expense(doc) async for doc in cursor]

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header section
    writer.writerow(["Event Financial Report"])
    writer.writerow(["Event", event_title])
    writer.writerow(["Generated", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")])
    writer.writerow([])

    # Income Summary
    writer.writerow(["=== INCOME SUMMARY ==="])
    writer.writerow(["Source", "Amount (INR)"])
    writer.writerow(["Ticket & Addon Sales", income["ticket_income"]])
    writer.writerow(["Vendor Bookings", income["vendor_income"]])
    writer.writerow(["TOTAL INCOME", income["total_income"]])
    writer.writerow([])

    # Expense Summary
    writer.writerow(["=== EXPENSE SUMMARY ==="])
    writer.writerow(["Category", "Amount (INR)", "Entries"])
    for cat in expenses_data["by_category"]:
        writer.writerow([cat["category"], cat["amount"], cat["count"]])
    writer.writerow(["TOTAL EXPENSES", expenses_data["total_expenses"], ""])
    writer.writerow([])

    # Net
    net = income["total_income"] - expenses_data["total_expenses"]
    writer.writerow(["NET PROFIT / LOSS", round(net, 2), ""])
    writer.writerow([])

    # Individual Expenses
    writer.writerow(["=== INDIVIDUAL EXPENSES ==="])
    writer.writerow(["Date", "Category", "Description", "Amount (INR)", "Receipt"])
    for row in expense_rows:
        writer.writerow([
            row.get("date", "")[:10],
            row.get("category", ""),
            row.get("description", ""),
            row.get("amount", ""),
            row.get("receipt_url") or "",
        ])

    output.seek(0)
    filename = f"financials_{event_id[:8]}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
