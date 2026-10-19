import pytest
from app.services.pricing_engine import calculate_hours_cost, calculate_scope_totals, calculate_change_request_totals
from app.models.schemas import STANDARD_DISCLAIMER

def test_calculate_hours_cost_basic():
    # 10.5 hours at $120/hr should be exactly 1260.00
    assert calculate_hours_cost(10.5, 120.0) == 1260.0
    # Floating point precision check: 3.33 hours at $95.50
    assert calculate_hours_cost(3.33, 95.50) == 318.02
    assert calculate_hours_cost(0, 150) == 0.0

def test_calculate_hours_cost_negative_raises():
    with pytest.raises(ValueError):
        calculate_hours_cost(-5, 100)
    with pytest.raises(ValueError):
        calculate_hours_cost(5, -100)

def test_calculate_scope_totals_only_bills_requirements():
    items = [
        {"category": "requirement", "suggested_hours": 10.0, "estimated_hours_min": 8.0, "estimated_hours_max": 14.0},
        {"category": "requirement", "suggested_hours": 5.0, "estimated_hours_min": 4.0, "estimated_hours_max": 7.0},
        {"category": "assumption", "suggested_hours": 99.0}, # Should NOT be billed
        {"category": "exclusion", "suggested_hours": 99.0},  # Should NOT be billed
        {"category": "clarification", "suggested_hours": 99.0} # Should NOT be billed
    ]
    rate = 100.0
    totals = calculate_scope_totals(items, rate)

    assert totals["total_suggested_hours"] == 15.0
    assert totals["total_min_hours"] == 12.0
    assert totals["total_max_hours"] == 21.0
    assert totals["projected_price"] == 1500.0
    assert totals["min_price"] == 1200.0
    assert totals["max_price"] == 2100.0
    assert totals["disclaimer"] == STANDARD_DISCLAIMER

def test_calculate_change_request_totals():
    items = [
        {"title": "Export to PDF", "estimated_hours": 6.5},
        {"title": "Dark Mode Toggle", "estimated_hours": 3.0}
    ]
    rate = 150.0
    result = calculate_change_request_totals(items, rate)

    assert result["total_hours"] == 9.5
    assert result["total_cost"] == 1425.0
    assert result["hourly_rate"] == 150.0
    assert "Not a legally binding contract" in result["disclaimer"]
