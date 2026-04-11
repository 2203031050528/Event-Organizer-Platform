from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field

from app.core.database import db
from app.common.utils.dependencies import get_current_user

router = APIRouter(prefix="/budget", tags=["budget"])


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class BudgetCategory(BaseModel):
    name: str          # "Venue", "Catering", "Marketing", "AV", "Other"
    planned: float = Field(ge=0)


class BudgetCreate(BaseModel):
    total_budget: float = Field(gt=0)
    categories: List[BudgetCategory]
    alert_threshold: float = Field(default=0.9, ge=0.1, le=1.0)


class BudgetUpdate(BaseModel):
    total_budget: Optional[float] = Field(default=None, gt=0)
    categories: Optional[List[BudgetCategory]] = None
    alert_threshold: Optional[float] = Field(default=None, ge=0.1, le=1.0)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    if "organizer_id" in doc:
        doc["organizer_id"] = str(doc["organizer_id"])
    for key in ["created_at", "updated_at"]:
        if key in doc and doc[key]:
            doc[key] = doc[key].isoformat() if isinstance(doc[key], datetime) else doc[key]
    return doc


async def _get_organizer_for_event(event_id: str, user_id: ObjectId):
    """Validate event ownership and return the organizer record."""
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    organizer = await db.organizers.find_one({"user_id": user_id})
    if not organizer or str(event.get("organizer_id")) != str(organizer["_id"]):
        raise HTTPException(status_code=403, detail="Not your event")
    return organizer


async def _get_actual_expenses(event_id: str) -> dict:
    """Pull actuals from event_expenses, grouped by category name."""
    pipeline = [
        {"$match": {"event_id": event_id}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}}
    ]
    rows = await db.event_expenses.aggregate(pipeline).to_list(None)
    # Map UPPER_CASE category → actual amount
    return {r["_id"].upper(): round(r["total"], 2) for r in rows}


# ─── Create / Get Budget ─────────────────────────────────────────────────────

@router.post("/{event_id}", status_code=201)
async def create_budget(
    event_id: str,
    data: BudgetCreate,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Create a budget plan for an event. Only one budget per event."""
    organizer = await _get_organizer_for_event(event_id, current_user["_id"])

    if await db.event_budgets.find_one({"event_id": event_id}):
        raise HTTPException(status_code=409, detail="Budget already exists. Use PUT to update.")

    doc = {
        "event_id": event_id,
        "organizer_id": organizer["_id"],
        "total_budget": data.total_budget,
        "categories": [cat.dict() for cat in data.categories],
        "alert_threshold": data.alert_threshold,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    res = await db.event_budgets.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize(doc)


@router.get("/{event_id}")
async def get_budget(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Get or return 404 if no budget plan exists."""
    await _get_organizer_for_event(event_id, current_user["_id"])

    budget = await db.event_budgets.find_one({"event_id": event_id})
    if not budget:
        raise HTTPException(status_code=404, detail="No budget plan found for this event")
    return _serialize(budget)


@router.put("/{event_id}")
async def update_budget(
    event_id: str,
    data: BudgetUpdate,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """Update total budget, category allocations, or alert threshold."""
    await _get_organizer_for_event(event_id, current_user["_id"])

    updates: dict = {"updated_at": datetime.utcnow()}
    if data.total_budget is not None:
        updates["total_budget"] = data.total_budget
    if data.categories is not None:
        updates["categories"] = [cat.dict() for cat in data.categories]
    if data.alert_threshold is not None:
        updates["alert_threshold"] = data.alert_threshold

    res = await db.event_budgets.update_one({"event_id": event_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")

    updated = await db.event_budgets.find_one({"event_id": event_id})
    return _serialize(updated)


# ─── Budget Status (planned vs actual) ───────────────────────────────────────

@router.get("/{event_id}/status")
async def get_budget_status(
    event_id: str,
    current_user=Depends(get_current_user(required_role="ORGANIZER"))
):
    """
    Real-time budget utilization:
    - Total planned vs total spent
    - Per-category breakdown with variance
    - Alert flag when spend >= threshold
    """
    await _get_organizer_for_event(event_id, current_user["_id"])

    budget = await db.event_budgets.find_one({"event_id": event_id})
    if not budget:
        raise HTTPException(status_code=404, detail="No budget plan found")

    actuals = await _get_actual_expenses(event_id)
    total_spent = sum(actuals.values())
    total_planned = budget["total_budget"]

    pct_used = (total_spent / total_planned * 100) if total_planned > 0 else 0
    over_budget_alert = (total_spent / total_planned) >= budget["alert_threshold"] if total_planned > 0 else False

    categories_breakdown = []
    for cat in budget.get("categories", []):
        cat_key = cat["name"].upper()
        actual = actuals.get(cat_key, 0.0)
        planned = cat["planned"]
        categories_breakdown.append({
            "name": cat["name"],
            "planned": planned,
            "actual": actual,
            "variance": round(planned - actual, 2),          # positive = under budget
            "pct_used": round((actual / planned * 100) if planned > 0 else 0, 1),
            "is_over": actual > planned,
        })

    # Untracked categories (expenses with no corresponding budget line)
    tracked_keys = {cat["name"].upper() for cat in budget.get("categories", [])}
    untracked = [
        {"name": key, "actual": val, "planned": 0, "variance": -val, "pct_used": 0, "is_over": True}
        for key, val in actuals.items() if key not in tracked_keys
    ]

    return {
        "event_id": event_id,
        "total_budget": total_planned,
        "total_spent": round(total_spent, 2),
        "remaining": round(total_planned - total_spent, 2),
        "percent_used": round(pct_used, 1),
        "alert_threshold_pct": round(budget["alert_threshold"] * 100, 0),
        "over_budget_alert": over_budget_alert,
        "categories": categories_breakdown + untracked,
    }
