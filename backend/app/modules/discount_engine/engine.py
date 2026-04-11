"""
Discount Engine — evaluates ALL eligible discount types for a booking context
and returns a list of applicable discounts (combinable / stacked).

Discount types:
  PRE_LAUNCH      — event has pre_launch_discount_pct and cut-off hasn't passed
  EARLY_BIRD      — discount_codes with type=EARLY_BIRD and valid window
  GROUP           — quantity >= min_quantity
  SEASONAL        — current month in allowed months list
  PROMO_CODE      — explicit user-entered code (type=PROMO_CODE)
  STUDENT         — user has verified student org domain
  FIRST_TIME      — user has 0 confirmed bookings ever
  LOYALTY         — user has >= min_past_bookings confirmed bookings
  ORGANIZATION    — user has verified org domain matching allowed domains
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class DiscountContext:
    event_id: str
    ticket_id: str
    user_id: str
    quantity: int
    subtotal: float            # ticket price * quantity (before addons)
    promo_code: Optional[str]  # user-entered code (may be None)
    user: dict                 # raw user document from DB
    event: dict                # raw event document from DB
    ticket: dict               # raw ticket document from DB


@dataclass
class AppliedDiscount:
    discount_type: str         # e.g. "EARLY_BIRD"
    label: str                 # human-readable  e.g. "Early Bird 20% off"
    value: float               # absolute INR amount deducted
    code: Optional[str] = None # promo code if applicable


# ─── Individual checkers ─────────────────────────────────────────────────────

async def _check_pre_launch(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """Event has a pre-launch discount and the cut-off window is active."""
    pct = ctx.event.get("pre_launch_discount_pct")
    ends_at = ctx.event.get("pre_launch_ends_at")
    if not pct or not ends_at:
        return []
    now = datetime.utcnow()
    # Make ends_at timezone-naive for comparison
    if hasattr(ends_at, 'tzinfo') and ends_at.tzinfo is not None:
        ends_at = ends_at.replace(tzinfo=None)
    if now > ends_at:
        return []
    amount = round(ctx.subtotal * pct / 100, 2)
    return [AppliedDiscount(
        discount_type="PRE_LAUNCH",
        label=f"Pre-Launch {pct:.0f}% off",
        value=amount,
    )]


async def _check_early_bird(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """Any active EARLY_BIRD discount code for this event (auto-apply)."""
    now = datetime.utcnow()
    cursor = db.discount_codes.find({
        "discount_type": "EARLY_BIRD",
        "is_auto_apply": True,
        "$or": [
            {"event_id": ctx.event_id},
            {"event_id": None},
            {"event_id": {"$exists": False}},
        ],
        "$or": [
            {"valid_until": {"$gt": now}},
            {"valid_until": None},
            {"valid_until": {"$exists": False}},
        ]
    })
    results = []
    async for doc in cursor:
        if doc.get("expires_at") and doc["expires_at"] < now:
            continue
        if doc.get("usage_limit") and doc.get("used_count", 0) >= doc["usage_limit"]:
            continue
        amount = _calc_amount(ctx.subtotal, doc)
        results.append(AppliedDiscount(
            discount_type="EARLY_BIRD",
            label=f"Early Bird {doc['value']}{'%' if doc['type'] == 'PERCENTAGE' else '₹'} off",
            value=amount,
            code=doc.get("code"),
        ))
    return results


async def _check_group(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """Quantity meets min_quantity threshold."""
    cursor = db.discount_codes.find({
        "discount_type": "GROUP",
        "is_auto_apply": True,
        "$or": [
            {"event_id": ctx.event_id},
            {"event_id": None},
            {"event_id": {"$exists": False}},
        ],
    })
    results = []
    async for doc in cursor:
        min_qty = doc.get("min_quantity", 2)
        if ctx.quantity < min_qty:
            continue
        if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
            continue
        if doc.get("usage_limit") and doc.get("used_count", 0) >= doc["usage_limit"]:
            continue
        amount = _calc_amount(ctx.subtotal, doc)
        results.append(AppliedDiscount(
            discount_type="GROUP",
            label=f"Group Discount ({min_qty}+ tickets)",
            value=amount,
            code=doc.get("code"),
        ))
    return results


async def _check_seasonal(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """Current month is in the allowed months list."""
    current_month = datetime.utcnow().month
    cursor = db.discount_codes.find({
        "discount_type": "SEASONAL",
        "is_auto_apply": True,
        "months": current_month,
    })
    results = []
    async for doc in cursor:
        if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
            continue
        amount = _calc_amount(ctx.subtotal, doc)
        results.append(AppliedDiscount(
            discount_type="SEASONAL",
            label=f"Seasonal Offer {doc['value']}{'%' if doc['type'] == 'PERCENTAGE' else '₹'} off",
            value=amount,
            code=doc.get("code"),
        ))
    return results


async def _check_promo_code(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """User-entered promo code."""
    if not ctx.promo_code:
        return []
    code = ctx.promo_code.strip().upper()
    doc = await db.discount_codes.find_one({"code": code})
    if not doc:
        return []
    now = datetime.utcnow()
    if doc.get("expires_at") and doc["expires_at"] < now:
        return []
    if doc.get("usage_limit") and doc.get("used_count", 0) >= doc["usage_limit"]:
        return []
    if doc.get("event_id") and str(doc["event_id"]) != ctx.event_id:
        return []
    amount = _calc_amount(ctx.subtotal, doc)
    return [AppliedDiscount(
        discount_type="PROMO_CODE",
        label=f"Promo: {code}",
        value=amount,
        code=code,
    )]


async def _check_student(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """User has a verified student org domain."""
    if not ctx.user.get("org_verified") or not ctx.user.get("org_domain"):
        return []
    cursor = db.discount_codes.find({
        "discount_type": "STUDENT",
        "is_auto_apply": True,
    })
    results = []
    async for doc in cursor:
        domains = doc.get("org_domains", [])
        if domains and ctx.user["org_domain"] not in domains:
            continue
        if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
            continue
        amount = _calc_amount(ctx.subtotal, doc)
        results.append(AppliedDiscount(
            discount_type="STUDENT",
            label=f"Student Discount {doc['value']}{'%' if doc['type'] == 'PERCENTAGE' else '₹'} off",
            value=amount,
        ))
    return results


async def _check_first_time(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """User has no prior confirmed bookings."""
    if ctx.user.get("total_confirmed_bookings", 0) > 0:
        return []
    cursor = db.discount_codes.find({
        "discount_type": "FIRST_TIME",
        "is_auto_apply": True,
    })
    results = []
    async for doc in cursor:
        if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
            continue
        amount = _calc_amount(ctx.subtotal, doc)
        results.append(AppliedDiscount(
            discount_type="FIRST_TIME",
            label=f"First-Time User Bonus {doc['value']}{'%' if doc['type'] == 'PERCENTAGE' else '₹'} off",
            value=amount,
        ))
    return results


async def _check_loyalty(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """User has >= N confirmed bookings (loyalty reward)."""
    past_bookings = ctx.user.get("total_confirmed_bookings", 0)
    cursor = db.discount_codes.find({
        "discount_type": "LOYALTY",
        "is_auto_apply": True,
    })
    results = []
    async for doc in cursor:
        if past_bookings < doc.get("min_past_bookings", 1):
            continue
        if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
            continue
        amount = _calc_amount(ctx.subtotal, doc)
        results.append(AppliedDiscount(
            discount_type="LOYALTY",
            label=f"Loyalty Reward {doc['value']}{'%' if doc['type'] == 'PERCENTAGE' else '₹'} off",
            value=amount,
        ))
    return results


async def _check_organization(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """User has a verified org domain matching a discount's org_domains list."""
    if not ctx.user.get("org_verified") or not ctx.user.get("org_domain"):
        return []
    cursor = db.discount_codes.find({
        "discount_type": "ORGANIZATION",
        "is_auto_apply": True,
    })
    results = []
    async for doc in cursor:
        domains = doc.get("org_domains", [])
        if ctx.user["org_domain"] not in domains:
            continue
        if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
            continue
        amount = _calc_amount(ctx.subtotal, doc)
        results.append(AppliedDiscount(
            discount_type="ORGANIZATION",
            label=f"Organization Discount {doc['value']}{'%' if doc['type'] == 'PERCENTAGE' else '₹'} off",
            value=amount,
        ))
    return results


# ─── Helper ──────────────────────────────────────────────────────────────────

def _calc_amount(subtotal: float, doc: dict) -> float:
    """Convert a discount_codes doc to a concrete INR deduction."""
    if doc["type"] == "PERCENTAGE":
        return round(subtotal * doc["value"] / 100, 2)
    else:  # FIXED_AMOUNT
        return min(doc["value"], subtotal)


# ─── Public entry-point ───────────────────────────────────────────────────────

async def evaluate_discounts(ctx: DiscountContext, db) -> list[AppliedDiscount]:
    """
    Run all checkers, collect every eligible discount, and return the full
    combined list (caller decides how to apply them — sum, cap, etc.).
    """
    import asyncio
    checkers = [
        _check_pre_launch(ctx, db),
        _check_early_bird(ctx, db),
        _check_group(ctx, db),
        _check_seasonal(ctx, db),
        _check_promo_code(ctx, db),
        _check_student(ctx, db),
        _check_first_time(ctx, db),
        _check_loyalty(ctx, db),
        _check_organization(ctx, db),
    ]
    results_nested = await asyncio.gather(*checkers, return_exceptions=True)
    all_discounts: list[AppliedDiscount] = []
    for r in results_nested:
        if isinstance(r, Exception):
            logger.error(f"Discount checker error: {r}")
        else:
            all_discounts.extend(r)

    # De-duplicate by type (keep highest value per type)
    seen: dict[str, AppliedDiscount] = {}
    for d in all_discounts:
        if d.discount_type not in seen or d.value > seen[d.discount_type].value:
            seen[d.discount_type] = d

    return list(seen.values())


async def total_discount(ctx: DiscountContext, db) -> tuple[float, list[AppliedDiscount]]:
    """
    Returns the total combined discount amount and the list of applied discounts.
    Discount is capped at subtotal (can't go negative).
    """
    discounts = await evaluate_discounts(ctx, db)
    total = min(sum(d.value for d in discounts), ctx.subtotal)
    return round(total, 2), discounts
