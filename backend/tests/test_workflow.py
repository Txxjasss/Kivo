import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_full_scope_intake_workflow(client):
    """
    Test the complete end-to-end scope intake workflow:
    1. Submit client brief
    2. Extract structured deliverables, assumptions, exclusions, and clarifications
    3. Validate extracted response structure & deterministic pricing
    4. Edit/augment deliverables, assumptions, exclusions, and clarifications
    5. Save project and locked baseline to SQLite
    6. Retrieve project and verify full persistence of all 4 categories
    """
    # Step 1: Submit client brief for scope extraction
    brief = (
        "We need a customer portal where clients can book 1-on-1 consultations and pay via Stripe. "
        "Must support Google calendar sync and send automated SMS reminders 24h before. "
        "Designs will be supplied in Figma. We do not need admin analytics in V1."
    )
    extract_resp = client.post("/api/scope/extract", json={
        "brief_text": brief,
        "hourly_rate": 150.0
    })
    assert extract_resp.status_code == 200
    extracted = extract_resp.json()

    # Step 2 & 3: Validate extracted response structure
    assert "summary" in extracted and len(extracted["summary"]) > 0
    assert "requirements" in extracted
    assert "assumptions" in extracted
    assert "exclusions" in extracted
    assert "clarifications" in extracted
    assert "extraction_source" in extracted
    assert extracted["extraction_source"] in ("ollama_qwen25_3b", "local_fallback")
    assert extracted["total_suggested_hours"] > 0
    assert extracted["suggested_price"] == extracted["total_suggested_hours"] * 150.0
    assert "disclaimer" in extracted
    assert "Non-binding estimate" in extracted["disclaimer"]

    # Verify each requirement has required schema fields
    for req in extracted["requirements"]:
        assert "title" in req and len(req["title"]) > 0
        assert "description" in req
        assert req["complexity"] in ("low", "medium", "high")
        assert req["suggested_hours"] >= 0

    # Step 4: Create a project in SQLite
    project_payload = {
        "name": "Consultation Booking Portal",
        "client_name": "Elevate Coaching Ltd",
        "client_email": "founder@elevatecoaching.com",
        "hourly_rate": 150.0,
        "currency": "USD"
    }
    proj_resp = client.post("/api/projects", json=project_payload)
    assert proj_resp.status_code == 200
    project_data = proj_resp.json()
    project_id = project_data["id"]
    assert project_data["name"] == "Consultation Booking Portal"

    # Step 5: Simulate user editing deliverables, adding an assumption, adding an exclusion, and adding a clarification
    edited_items = []
    
    # Add edited requirements
    edited_items.append({
        "category": "requirement",
        "title": "Stripe Checkout & Billing",
        "description": "Integration with Stripe Checkout and webhook handling for successful bookings",
        "complexity": "medium",
        "estimated_hours_min": 10.0,
        "estimated_hours_max": 18.0,
        "suggested_hours": 14.0,
        "order_index": 0
    })
    edited_items.append({
        "category": "requirement",
        "title": "Google Calendar Sync & SMS Reminders",
        "description": "Two-way Google Calendar event sync and Twilio SMS notification trigger 24h prior",
        "complexity": "high",
        "estimated_hours_min": 12.0,
        "estimated_hours_max": 24.0,
        "suggested_hours": 18.0,
        "order_index": 1
    })

    # Add edited assumptions
    edited_items.append({
        "category": "assumption",
        "title": "Figma Design Assets Provided",
        "description": "Client delivers finalized Figma components and style guide before development starts",
        "complexity": "low",
        "estimated_hours_min": 0,
        "estimated_hours_max": 0,
        "suggested_hours": 0,
        "order_index": 100
    })

    # Add edited exclusions
    edited_items.append({
        "category": "exclusion",
        "title": "Admin Analytics & Reporting",
        "description": "Advanced metrics and analytics dashboards are deferred to V2",
        "complexity": "low",
        "estimated_hours_min": 0,
        "estimated_hours_max": 0,
        "suggested_hours": 0,
        "order_index": 200
    })

    # Add edited clarification
    edited_items.append({
        "category": "clarification",
        "title": "Will Twilio account credentials be provided by client?",
        "description": "SMS gateway setup requires active Twilio account and phone number",
        "complexity": "medium",
        "estimated_hours_min": 0,
        "estimated_hours_max": 0,
        "suggested_hours": 0,
        "order_index": 300
    })

    baseline_payload = {
        "project_id": project_id,
        "raw_brief": brief,
        "summary": "Agreed scope baseline for Consultation Booking Portal",
        "hourly_rate": 150.0,
        "items": edited_items
    }

    save_resp = client.post(f"/api/projects/{project_id}/baseline", json=baseline_payload)
    assert save_resp.status_code == 200
    save_data = save_resp.json()
    assert save_data["status"] == "success"
    # Deterministic price: (14 + 18) * 150 = 32 * 150 = 4800
    assert save_data["totals"]["total_suggested_hours"] == 32.0
    assert save_data["totals"]["projected_price"] == 4800.0

    # Step 6: Fetch project from SQLite and verify all 4 categories are persisted and retrieved
    detail_resp = client.get(f"/api/projects/{project_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["project"]["id"] == project_id
    assert detail["baseline"]["total_estimated_hours"] == 32.0
    assert detail["baseline"]["total_baseline_price"] == 4800.0
    
    saved_items = detail["items"]
    assert len(saved_items) == 5
    
    categories = [it["category"] for it in saved_items]
    assert categories.count("requirement") == 2
    assert categories.count("assumption") == 1
    assert categories.count("exclusion") == 1
    assert categories.count("clarification") == 1

def test_scope_validation_error_states(client):
    """Test validation errors for empty brief and non-existent project baseline."""
    # 1. Empty brief error
    res1 = client.post("/api/scope/extract", json={"brief_text": "   ", "hourly_rate": 120.0})
    assert res1.status_code == 400
    assert "empty" in res1.json()["detail"].lower()

    # 2. Non-existent project detail
    res2 = client.get("/api/projects/non-existent-uuid-12345")
    assert res2.status_code == 404

    # 3. Non-existent project baseline save
    res3 = client.post("/api/projects/non-existent-uuid-12345/baseline", json={
        "project_id": "non-existent-uuid-12345",
        "raw_brief": "Some brief",
        "summary": "Summary",
        "hourly_rate": 100.0,
        "items": []
    })
    assert res3.status_code == 404
