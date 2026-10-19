from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any
from app.models.schemas import STANDARD_DISCLAIMER

def to_decimal(val: Any) -> Decimal:
    return Decimal(str(val))

def calculate_hours_cost(hours: float, hourly_rate: float) -> float:
    """
    Deterministic calculation for billable amounts using Decimal ROUND_HALF_UP.
    Always returns float rounded to 2 decimal places.
    """
    d_hours = to_decimal(hours)
    d_rate = to_decimal(hourly_rate)
    
    if d_hours < 0 or d_rate < 0:
        raise ValueError("Hours and hourly rate must be non-negative numbers.")
        
    product = d_hours * d_rate
    rounded = product.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(rounded)

def calculate_scope_totals(items: List[Dict[str, Any]], hourly_rate: float) -> Dict[str, Any]:
    """
    Calculates total hours (min, max, suggested) and total projected cost.
    Only items with category in ('requirement', 'new_feature', 'scope_expansion') contribute to billable work.
    """
    d_suggested = Decimal("0.0")
    d_min = Decimal("0.0")
    d_max = Decimal("0.0")

    for item in items:
        cat = item.get("category", "")
        if cat in ("requirement", "new_feature", "scope_expansion"):
            s_hours = max(Decimal("0.0"), to_decimal(item.get("suggested_hours", 0.0)))
            min_h = max(Decimal("0.0"), to_decimal(item.get("estimated_hours_min", float(s_hours) * 0.8)))
            max_h = max(Decimal("0.0"), to_decimal(item.get("estimated_hours_max", float(s_hours) * 1.3)))
            
            d_suggested += s_hours
            d_min += min_h
            d_max += max_h

    total_suggested = float(d_suggested.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    total_min = float(d_min.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    total_max = float(d_max.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    projected_price = calculate_hours_cost(total_suggested, hourly_rate)
    min_price = calculate_hours_cost(total_min, hourly_rate)
    max_price = calculate_hours_cost(total_max, hourly_rate)

    return {
        "total_suggested_hours": total_suggested,
        "total_min_hours": total_min,
        "total_max_hours": total_max,
        "projected_price": projected_price,
        "min_price": min_price,
        "max_price": max_price,
        "hourly_rate": hourly_rate,
        "disclaimer": STANDARD_DISCLAIMER
    }

def calculate_change_request_totals(change_items: List[Dict[str, Any]], hourly_rate: float) -> Dict[str, Any]:
    """
    Deterministic cost calculator for scope-creep delta items using Decimal.
    """
    d_hours = Decimal("0.0")
    for item in change_items:
        h = max(Decimal("0.0"), to_decimal(item.get("estimated_hours", 0.0)))
        d_hours += h

    total_hours = float(d_hours.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    total_cost = calculate_hours_cost(total_hours, hourly_rate)

    return {
        "total_hours": total_hours,
        "total_cost": total_cost,
        "hourly_rate": hourly_rate,
        "disclaimer": STANDARD_DISCLAIMER
    }
