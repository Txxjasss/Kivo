import pytest
import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app
from app.services.pricing_engine import calculate_hours_cost, calculate_scope_totals, calculate_change_request_totals
from app.services.ollama_client import _fallback_scope_extraction

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

# ==============================================================================
# 1. PRICING INTEGRITY TESTS
# ==============================================================================

def test_pricing_fractional_hours_and_rounding():
    """
    Test fractional hours (0.25, 0.75, 1.25, 2.5), hourly-rate multiplication,
    and exact Decimal ROUND_HALF_UP rounding.
    """
    # 1.25 hours @ $120.00/hr = $150.00 exactly
    assert calculate_hours_cost(1.25, 120.0) == 150.00

    # 0.25 hours @ $140.00/hr = $35.00 exactly
    assert calculate_hours_cost(0.25, 140.0) == 35.00

    # 0.75 hours @ $150.00/hr = $112.50 exactly
    assert calculate_hours_cost(0.75, 150.0) == 112.50

    # Odd rate with fractional hours: 1.75 hours @ $135.50/hr = 237.125 -> 237.13
    assert calculate_hours_cost(1.75, 135.50) == 237.13

    # Zero hours should be 0.00
    assert calculate_hours_cost(0.0, 150.0) == 0.00

    # Negative hours or rate should raise ValueError
    with pytest.raises(ValueError):
        calculate_hours_cost(-1.0, 100.0)
    with pytest.raises(ValueError):
        calculate_hours_cost(5.0, -50.0)

def test_line_item_and_ledger_reconciliation(client):
    """
    Verify that individual line items, change-order totals, and the project
    ledger always reconcile with zero discrepancy.
    """
    # 1. Create a project
    proj_resp = client.post("/api/projects", json={
        "name": "E-Commerce Microservices",
        "client_name": "Retail Corp",
        "client_email": "ops@retailcorp.com",
        "hourly_rate": 120.0,
        "currency": "USD"
    })
    assert proj_resp.status_code == 200
    project_id = proj_resp.json()["id"]

    # 2. Save baseline with fractional hours:
    # Item 1: 5.25h -> $630.00
    # Item 2: 8.50h -> $1020.00
    # Item 3: 2.75h -> $330.00
    # Total hours: 16.50h, Total cost: $1980.00
    baseline_payload = {
        "project_id": project_id,
        "raw_brief": "Build order management microservice with inventory sync and reporting.",
        "summary": "Order management microservice baseline",
        "items": [
            {
                "category": "requirement",
                "title": "Order Ingestion API",
                "description": "REST endpoints for incoming orders",
                "complexity": "medium",
                "estimated_hours_min": 4.0,
                "estimated_hours_max": 7.0,
                "suggested_hours": 5.25,
                "order_index": 0,
                "provenance": "explicit"
            },
            {
                "category": "requirement",
                "title": "Inventory Sync Worker",
                "description": "Background synchronization worker",
                "complexity": "high",
                "estimated_hours_min": 6.0,
                "estimated_hours_max": 11.0,
                "suggested_hours": 8.50,
                "order_index": 1,
                "provenance": "explicit"
            },
            {
                "category": "requirement",
                "title": "CSV Report Export",
                "description": "Export daily orders to CSV",
                "complexity": "low",
                "estimated_hours_min": 2.0,
                "estimated_hours_max": 4.0,
                "suggested_hours": 2.75,
                "order_index": 2,
                "provenance": "explicit"
            }
        ],
        "hourly_rate": 120.0
    }
    base_save_resp = client.post(f"/api/projects/{project_id}/baseline", json=baseline_payload)
    assert base_save_resp.status_code == 200
    totals = base_save_resp.json()["totals"]
    assert totals["total_suggested_hours"] == 16.50
    assert totals["projected_price"] == 1980.00

    # 3. Create change order with multiple fractional line items:
    # Delta 1: 1.25h -> $150.00
    # Delta 2: 2.75h -> $330.00
    # Expected total hours: 4.00h, Expected total cost: $480.00
    change_payload = {
        "title": "Webhook & PDF Additions",
        "client_message": "Also send instant webhook on order dispatched, and generate PDF invoices.",
        "ai_analysis": "Out-of-scope integrations identified.",
        "items": [
            {
                "title": "Order Dispatched Webhooks",
                "impact_type": "new_feature",
                "reasoning": "External webhook dispatcher required",
                "estimated_hours": 1.25
            },
            {
                "title": "PDF Invoice Generation",
                "impact_type": "new_feature",
                "reasoning": "PDF template layout and rendering engine",
                "estimated_hours": 2.75
            }
        ],
        "hourly_rate": 120.0
    }
    cr_resp = client.post(f"/api/projects/{project_id}/change-requests", json=change_payload)
    assert cr_resp.status_code == 200
    cr_data = cr_resp.json()
    assert cr_data["totals"]["total_hours"] == 4.00
    assert cr_data["totals"]["total_cost"] == 480.00
    token = cr_data["share_token"]

    # Verify line items sum exactly matches change request calculated totals
    item_hours_sum = sum(it["estimated_hours"] for it in change_payload["items"])
    assert item_hours_sum == 4.00
    assert calculate_hours_cost(item_hours_sum, 120.0) == 480.00

    # 4. Check project before approval: approved_changes_cost must be 0.00
    proj_check = client.get(f"/api/projects/{project_id}").json()
    assert proj_check["baseline"]["total_estimated_hours"] == 16.50
    assert proj_check["baseline"]["total_baseline_price"] == 1980.00
    # Project list view check
    proj_list = client.get("/api/projects").json()
    p_summary = next(p for p in proj_list if p["id"] == project_id)
    assert p_summary["total_baseline_price"] == 1980.00
    assert p_summary["approved_changes_cost"] == 0.00

    # 5. Client approves the change proposal
    act_resp = client.post(f"/api/proposals/{token}/action", json={
        "action": "approve",
        "client_feedback": "Approved. Please proceed with webhooks and PDF invoices."
    })
    assert act_resp.status_code == 200
    assert act_resp.json()["new_status"] == "approved"

    # 6. Reconcile project ledger after approval
    proj_list_after = client.get("/api/projects").json()
    p_after = next(p for p in proj_list_after if p["id"] == project_id)
    assert p_after["total_baseline_price"] == 1980.00
    assert p_after["approved_changes_cost"] == 480.00
    # Combined project value reconciles exactly
    total_ledger = p_after["total_baseline_price"] + p_after["approved_changes_cost"]
    assert total_ledger == 2460.00

# ==============================================================================
# 2. REQUIREMENT PROVENANCE & INVENTED REQUIREMENTS
# ==============================================================================

def test_requirement_provenance_and_invented_details(client):
    """
    Test requirement provenance:
    - Explicit deliverables requested in brief are tagged 'explicit'
    - Invented details (e.g. lightbox, filterable gallery, package accordion, client-logo section)
      are tagged 'suggested' and not silently made agreed deliverables.
    - Verified in SQLite persistence.
    """
    portfolio_brief = (
        "Build a five-page responsive portfolio website with a homepage, about page, "
        "projects gallery, services page, and contact form. Include mobile responsiveness "
        "and basic SEO. Exclude payment integration, a CMS, and ongoing maintenance."
    )

    # Simulate extraction containing both explicit requirements and invented AI suggestions
    mock_extracted = {
        "summary": "Five-page responsive portfolio website for creative professional.",
        "requirements": [
            {
                "title": "Homepage & Hero Section",
                "description": "Landing page with intro and bio",
                "complexity": "low",
                "suggested_hours": 6.0,
                "provenance": "explicit"
            },
            {
                "title": "Projects Gallery",
                "description": "Grid display of past projects",
                "complexity": "medium",
                "suggested_hours": 8.0,
                "provenance": "explicit"
            },
            {
                "title": "Filterable Gallery Category Selector",
                "description": "Interactive category filtering tags for gallery items",
                "complexity": "medium",
                "suggested_hours": 5.0,
                "provenance": "explicit" # Mistagged by LLM as explicit, should be corrected to suggested
            },
            {
                "title": "Lightbox Modal Viewer",
                "description": "Full-screen lightbox overlay modal for project screenshots",
                "complexity": "low",
                "suggested_hours": 4.0,
                "provenance": "explicit" # Mistagged by LLM as explicit, should be corrected to suggested
            },
            {
                "title": "Package Accordion Pricing Component",
                "description": "Collapsible accordion component detailing service tier packages",
                "complexity": "low",
                "suggested_hours": 3.0,
                "provenance": "explicit" # Mistagged by LLM as explicit, should be corrected to suggested
            },
            {
                "title": "Client-Logo Showcase Bar",
                "description": "Infinite horizontal carousel showing past client brand logos",
                "complexity": "low",
                "suggested_hours": 3.5,
                "provenance": "suggested"
            },
            {
                "title": "Contact Form",
                "description": "Form with validation for client inquiries",
                "complexity": "low",
                "suggested_hours": 4.0,
                "provenance": "explicit"
            }
        ],
        "assumptions": [
            {"title": "Content Delivery", "description": "Client provides text and images for all five pages."}
        ],
        "exclusions": [
            {"title": "CMS Integration", "description": "CMS excluded per brief."},
            {"title": "Payment Integration", "description": "No online payments included."}
        ],
        "clarifications": [
            {"question": "Do you have existing brand guidelines?", "reason": "Affects styling."}
        ],
        "extraction_source": "ollama_qwen25_3b"
    }

    with patch("app.routes.scope.extract_scope_from_brief", return_value=mock_extracted):
        resp = client.post("/api/scope/extract", json={
            "brief_text": portfolio_brief,
            "hourly_rate": 120.0
        })
        assert resp.status_code == 200
        data = resp.json()
        reqs = {r["title"]: r["provenance"] for r in data["requirements"]}

        # Explicit deliverables stated in brief must remain explicit
        assert reqs["Homepage & Hero Section"] == "explicit"
        assert reqs["Projects Gallery"] == "explicit"
        assert reqs["Contact Form"] == "explicit"

        # Invented features not in the brief MUST be classified as suggested
        assert reqs["Filterable Gallery Category Selector"] == "suggested"
        assert reqs["Lightbox Modal Viewer"] == "suggested"
        assert reqs["Package Accordion Pricing Component"] == "suggested"
        assert reqs["Client-Logo Showcase Bar"] == "suggested"

    # Now verify SQLite persistence of provenance
    proj = client.post("/api/projects", json={
        "name": "Creative Portfolio",
        "client_name": "Studio Noir",
        "hourly_rate": 120.0
    }).json()

    save_resp = client.post(f"/api/projects/{proj['id']}/baseline", json={
        "project_id": proj["id"],
        "raw_brief": portfolio_brief,
        "summary": "Creative portfolio baseline",
        "items": [
            {
                "category": "requirement",
                "title": "Homepage & Hero Section",
                "description": "Landing page with intro",
                "suggested_hours": 6.0,
                "provenance": "explicit"
            },
            {
                "category": "requirement",
                "title": "Lightbox Modal Viewer",
                "description": "Inferred enhancement",
                "suggested_hours": 4.0,
                "provenance": "suggested"
            }
        ],
        "hourly_rate": 120.0
    })
    assert save_resp.status_code == 200

    # Retrieve from DB and verify exact provenance column values
    detail = client.get(f"/api/projects/{proj['id']}").json()
    db_items = {it["title"]: it["provenance"] for it in detail["items"]}
    assert db_items["Homepage & Hero Section"] == "explicit"
    assert db_items["Lightbox Modal Viewer"] == "suggested"

# ==============================================================================
# 3. APPROVAL INTEGRITY & PERSISTENCE (SURVIVES REFRESH)
# ==============================================================================

def test_approval_integrity_and_persistence(client):
    """
    Verify proposal is only APPROVED upon actual client action,
    and decision and feedback are persisted and survive a refresh.
    """
    # Create project and change request
    proj = client.post("/api/projects", json={
        "name": "B2B SaaS Dashboard",
        "client_name": "Initech",
        "hourly_rate": 140.0
    }).json()

    cr = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "Export Audit Logs",
        "client_message": "Can we also have audit logs exported to S3?",
        "ai_analysis": "S3 bucket integration and IAM role configuration.",
        "items": [
            {
                "title": "S3 Audit Export Service",
                "impact_type": "new_feature",
                "reasoning": "AWS S3 upload worker",
                "estimated_hours": 4.5
            }
        ],
        "hourly_rate": 140.0
    }).json()

    token = cr["share_token"]

    # 1. Fetch proposal before any action: status must be 'sent'
    initial_prop = client.get(f"/api/proposals/{token}").json()
    assert initial_prop["proposal"]["status"] == "sent"
    assert initial_prop["proposal"]["client_feedback"] == ""
    assert initial_prop["proposal"]["client_action_at"] is None

    # 2. Client performs approval action with custom feedback
    client_notes = "Approved by CTO. Please deploy to staging by next Tuesday."
    action_resp = client.post(f"/api/proposals/{token}/action", json={
        "action": "approve",
        "client_feedback": client_notes
    })
    assert action_resp.status_code == 200
    assert action_resp.json()["new_status"] == "approved"
    action_time = action_resp.json()["updated_at"]
    assert action_time is not None

    # 3. Simulate page refresh: fetch proposal again from database
    refreshed_prop = client.get(f"/api/proposals/{token}").json()
    assert refreshed_prop["proposal"]["status"] == "approved"
    assert refreshed_prop["proposal"]["client_feedback"] == client_notes
    assert refreshed_prop["proposal"]["client_action_at"] == action_time

    # 4. Confirm project ledger now includes the approved cost ($630.00)
    # 4.5h * $140/hr = $630.00
    p_summary = next(p for p in client.get("/api/projects").json() if p["id"] == proj["id"])
    assert p_summary["approved_changes_cost"] == 630.00

# ==============================================================================
# 4. REJECTED PROPOSALS & BASELINE IMMUTABILITY
# ==============================================================================

def test_rejected_proposal_preserves_baseline_and_ledger(client):
    """
    Confirm that rejecting a proposal persists the decision,
    does NOT alter project ledger totals, and leaves baseline scope unchanged.
    """
    proj = client.post("/api/projects", json={
        "name": "Mobile Health App",
        "client_name": "HealthCorp",
        "hourly_rate": 130.0
    }).json()

    # Save initial baseline
    client.post(f"/api/projects/{proj['id']}/baseline", json={
        "project_id": proj["id"],
        "raw_brief": "Core patient onboarding and vitals logging.",
        "summary": "Health App Baseline",
        "items": [
            {
                "category": "requirement",
                "title": "Vitals Tracker",
                "description": "Daily logging",
                "suggested_hours": 10.0,
                "provenance": "explicit"
            }
        ],
        "hourly_rate": 130.0
    })

    # Create change request for Bluetooth sync
    cr = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "Bluetooth Hardware Sync",
        "client_message": "Can we sync with custom BLE blood pressure monitors?",
        "ai_analysis": "BLE protocol handling and firmware pairing required.",
        "items": [
            {
                "title": "BLE Protocol Driver",
                "impact_type": "new_feature",
                "reasoning": "Native BLE hardware integration",
                "estimated_hours": 12.0
            }
        ],
        "hourly_rate": 130.0
    }).json()

    token = cr["share_token"]

    # Client rejects proposal
    rejection_notes = "Too expensive for Phase 1. We will evaluate in Q4."
    action_resp = client.post(f"/api/proposals/{token}/action", json={
        "action": "reject",
        "client_feedback": rejection_notes
    })
    assert action_resp.status_code == 200
    assert action_resp.json()["new_status"] == "rejected"

    # Verify refresh persists rejection and feedback
    refreshed = client.get(f"/api/proposals/{token}").json()
    assert refreshed["proposal"]["status"] == "rejected"
    assert refreshed["proposal"]["client_feedback"] == rejection_notes

    # Verify baseline and project ledger remain completely unchanged
    p_summary = next(p for p in client.get("/api/projects").json() if p["id"] == proj["id"])
    assert p_summary["total_baseline_price"] == 1300.00
    assert p_summary["approved_changes_cost"] == 0.00 # Rejected cost ($1560.00) is NOT added

    # Verify baseline scope items remain intact
    detail = client.get(f"/api/projects/{proj['id']}").json()
    assert len(detail["items"]) == 1
    assert detail["items"][0]["title"] == "Vitals Tracker"

# ==============================================================================
# 5. REPEATED APPROVAL REQUESTS & IDEMPOTENCY / TAMPERING PROTECTION
# ==============================================================================

def test_repeated_approval_idempotency_and_tampering_prevention(client):
    """
    Verify repeated identical approval is idempotent,
    and attempting to flip/tamper with an already finalized proposal is rejected.
    """
    proj = client.post("/api/projects", json={
        "name": "CRM Extension",
        "client_name": "SalesPro",
        "hourly_rate": 120.0
    }).json()

    cr = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "Webhook Sync",
        "client_message": "Need webhooks",
        "ai_analysis": "Webhook service",
        "items": [{"title": "Webhooks", "impact_type": "new_feature", "reasoning": "Sync", "estimated_hours": 2.0}],
        "hourly_rate": 120.0
    }).json()

    token = cr["share_token"]

    # First approval
    resp1 = client.post(f"/api/proposals/{token}/action", json={"action": "approve"})
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "success"

    # Repeated identical approval: must be idempotent (already_finalized)
    resp2 = client.post(f"/api/proposals/{token}/action", json={"action": "approve"})
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "already_finalized"
    assert resp2.json()["new_status"] == "approved"

    # Attempt to flip an already approved proposal to 'reject': must return 400 Bad Request
    resp_tamper = client.post(f"/api/proposals/{token}/action", json={"action": "reject"})
    assert resp_tamper.status_code == 400
    assert "already been finalized" in resp_tamper.json()["detail"]

# ==============================================================================
# 6. AMBIGUOUS BRIEFS & FAILED LOCAL-MODEL INFERENCE
# ==============================================================================

def test_ambiguous_brief_handling(client):
    """
    Test that ambiguous client briefs generate structured requirements,
    unstated assumptions, exclusions, and clarification questions.
    """
    ambiguous_brief = "We need an app for our business, make it modern and fast with some login."
    resp = client.post("/api/scope/extract", json={
        "brief_text": ambiguous_brief,
        "hourly_rate": 120.0
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["requirements"]) > 0
    assert len(data["assumptions"]) > 0
    assert len(data["exclusions"]) > 0
    assert len(data["clarifications"]) > 0
    # Every clarification must have a valid question and reasoning
    for clar in data["clarifications"]:
        assert len(clar["question"]) > 0
        assert len(clar["reason"]) > 0

def test_failed_local_model_inference_fallback():
    """
    Test that if local Ollama inference fails or times out,
    fallback parser activates cleanly with valid schema and extraction_source='local_fallback'.
    """
    fallback_res = _fallback_scope_extraction("""1. Mobile UI
2. Database setup""", "Connection refused")
    assert fallback_res["extraction_source"] == "local_fallback"
    assert len(fallback_res["requirements"]) == 2
    assert fallback_res["requirements"][0]["provenance"] == "explicit"
    assert len(fallback_res["assumptions"]) > 0
    assert len(fallback_res["exclusions"]) > 0
    assert len(fallback_res["clarifications"]) > 0

    # Ensure fallback produces valid deterministic calculations
    totals = calculate_scope_totals(fallback_res["requirements"], 120.0)
    assert totals["total_suggested_hours"] == 12.0
    assert totals["projected_price"] == 1440.00


# ==============================================================================
# 7. CHANGE ORDER DEDUPLICATION & LEDGER CONSISTENCY REGRESSION TESTS
# ==============================================================================

def test_duplicate_proposal_prevention_and_pending_reuse(client):
    """
    Test that submitting an identical client message while a proposal is pending
    reuses the existing proposal token and URL instead of inserting a duplicate row.
    """
    # 1. Create project & baseline
    proj = client.post("/api/projects", json={
        "name": "Fintech Ledger Sync",
        "client_name": "LedgerCorp",
        "hourly_rate": 150.0
    }).json()

    client.post(f"/api/projects/{proj['id']}/baseline", json={
        "project_id": proj["id"],
        "raw_brief": "Core fintech ledger tracking.",
        "summary": "Fintech Baseline",
        "items": [
            {
                "category": "requirement",
                "title": "Ledger Core",
                "description": "Double entry bookkeeping",
                "suggested_hours": 10.0,
                "provenance": "explicit"
            }
        ],
        "hourly_rate": 150.0
    })

    client_msg = "Can we add an automated PDF Statement export for tax season?"

    # 2. First proposal generation
    resp1 = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "PDF Statement Export",
        "client_message": client_msg,
        "ai_analysis": "Automated PDF statement generation service.",
        "items": [
            {
                "title": "PDF Generator Engine",
                "impact_type": "new_feature",
                "reasoning": "New export capability",
                "estimated_hours": 4.0
            }
        ],
        "hourly_rate": 150.0
    })
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] == "success"
    token1 = data1["share_token"]
    cr_id_1 = data1["change_request_id"]

    # 3. Second submission with varied whitespace & casing for the same client request
    varied_client_msg = "   can we add an automated PDF   Statement export for TAX season?  "
    resp2 = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "PDF Statement Export Duplicate Attempt",
        "client_message": varied_client_msg,
        "ai_analysis": "Duplicate request",
        "items": [
            {
                "title": "PDF Generator Engine",
                "impact_type": "new_feature",
                "reasoning": "Duplicate item",
                "estimated_hours": 4.0
            }
        ],
        "hourly_rate": 150.0
    })
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "reused_pending"
    assert data2["share_token"] == token1
    assert data2["change_request_id"] == cr_id_1

    # 4. Verify only ONE change request exists in the project
    proj_detail = client.get(f"/api/projects/{proj['id']}").json()
    assert len(proj_detail["change_requests"]) == 1
    assert proj_detail["change_requests"][0]["share_token"] == token1


def test_approved_proposal_blocks_duplicate_generation_409(client):
    """
    Test that once a proposal has been approved, attempting to generate a duplicate
    proposal for the same normalized client request returns HTTP 409 Conflict.
    """
    proj = client.post("/api/projects", json={
        "name": "SaaS Billing Microservice",
        "client_name": "BillCorp",
        "hourly_rate": 140.0
    }).json()

    client_msg = "Please add Stripe webhook support for failed recurring subscriptions."

    # 1. Create proposal
    cr_resp = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "Stripe Webhook Handler",
        "client_message": client_msg,
        "ai_analysis": "Stripe webhook handling",
        "items": [
            {
                "title": "Stripe Webhook Endpoint",
                "impact_type": "new_feature",
                "reasoning": "Webhook integration",
                "estimated_hours": 5.0
            }
        ],
        "hourly_rate": 140.0
    }).json()

    token = cr_resp["share_token"]

    # 2. Approve proposal
    approve_resp = client.post(f"/api/proposals/{token}/action", json={"action": "approve"})
    assert approve_resp.status_code == 200
    assert approve_resp.json()["new_status"] == "approved"

    # 3. Attempt to generate proposal again for the same client request
    dup_resp = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "Stripe Webhook Handler Copy",
        "client_message": "  please add stripe webhook support for failed recurring subscriptions.  ",
        "ai_analysis": "Duplicate",
        "items": [
            {
                "title": "Stripe Webhook Endpoint",
                "impact_type": "new_feature",
                "reasoning": "Webhook integration",
                "estimated_hours": 5.0
            }
        ],
        "hourly_rate": 140.0
    })
    assert dup_resp.status_code == 409
    detail = dup_resp.json()["detail"]
    assert "approved change order already exists" in detail
    assert token in detail

    # 4. Confirm project ledger contains the approved cost ($700.00) exactly once
    p_summary = next(p for p in client.get("/api/projects").json() if p["id"] == proj["id"])
    assert p_summary["approved_changes_cost"] == 700.00


def test_superseded_proposal_cannot_be_altered_and_excluded_from_ledger(client):
    """
    Test that a proposal marked 'superseded' is excluded from the project ledger
    and cannot be approved, rejected, or modified.
    """
    proj = client.post("/api/projects", json={
        "name": "Audit Trail Demo",
        "client_name": "AuditCorp",
        "hourly_rate": 100.0
    }).json()

    # Create proposal
    cr_resp = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "Superseded Test Order",
        "client_message": "Test message to be superseded",
        "ai_analysis": "Testing",
        "items": [
            {
                "title": "Item A",
                "impact_type": "new_feature",
                "reasoning": "Test",
                "estimated_hours": 10.0
            }
        ],
        "hourly_rate": 100.0
    }).json()
    token = cr_resp["share_token"]

    # Mark as superseded directly in database to simulate audited duplicate
    import sqlite3
    con = sqlite3.connect("backend/kivo.db")
    cur = con.cursor()
    cur.execute("UPDATE change_requests SET status = 'superseded', client_feedback = 'Audit note: superseded' WHERE share_token = ?", (token,))
    con.commit()
    con.close()

    # 1. Confirm GET proposal returns superseded status
    prop_data = client.get(f"/api/proposals/{token}").json()
    assert prop_data["proposal"]["status"] == "superseded"

    # 2. Attempt to approve superseded proposal: must fail with HTTP 400
    act_resp = client.post(f"/api/proposals/{token}/action", json={"action": "approve"})
    assert act_resp.status_code == 400
    assert "superseded" in act_resp.json()["detail"]

    # 3. Attempt to reject superseded proposal: must fail with HTTP 400
    act_reject = client.post(f"/api/proposals/{token}/action", json={"action": "reject"})
    assert act_reject.status_code == 400
    assert "superseded" in act_reject.json()["detail"]

    # 4. Verify project ledger does NOT include the $1000.00 superseded proposal
    p_summary = next(p for p in client.get("/api/projects").json() if p["id"] == proj["id"])
    assert p_summary["approved_changes_cost"] == 0.00


def test_repeated_clicks_and_approval_persistence_after_refresh(client):
    """
    Verify that rapid repeated clicks on approval do not corrupt data or double-count,
    and the approved status persists across page refresh.
    """
    proj = client.post("/api/projects", json={
        "name": "Rapid Click Guard",
        "client_name": "SpeedCorp",
        "hourly_rate": 120.0
    }).json()

    cr = client.post(f"/api/projects/{proj['id']}/change-requests", json={
        "title": "Rapid Click Order",
        "client_message": "Click test",
        "ai_analysis": "Click test analysis",
        "items": [{"title": "Item 1", "impact_type": "new_feature", "reasoning": "Test", "estimated_hours": 3.0}],
        "hourly_rate": 120.0
    }).json()
    token = cr["share_token"]

    # Click 1: First approval
    resp1 = client.post(f"/api/proposals/{token}/action", json={"action": "approve", "client_feedback": "Approved fast"})
    assert resp1.status_code == 200
    assert resp1.json()["new_status"] == "approved"

    # Click 2: Rapid second approval
    resp2 = client.post(f"/api/proposals/{token}/action", json={"action": "approve", "client_feedback": "Approved fast"})
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "already_finalized"
    assert resp2.json()["new_status"] == "approved"

    # Click 3: Third identical approval
    resp3 = client.post(f"/api/proposals/{token}/action", json={"action": "approve"})
    assert resp3.status_code == 200
    assert resp3.json()["status"] == "already_finalized"

    # Refresh page: fetch proposal from DB
    refreshed = client.get(f"/api/proposals/{token}").json()
    assert refreshed["proposal"]["status"] == "approved"
    assert refreshed["proposal"]["client_feedback"] == "Approved fast"

    # Verify ledger has $360.00 exactly once (3.0h * 120/h)
    p_summary = next(p for p in client.get("/api/projects").json() if p["id"] == proj["id"])
    assert p_summary["approved_changes_cost"] == 360.00


def test_acme_saas_portal_ledger_reconciliation_in_db(client):
    """
    Verify that Acme SaaS Portal demo project reflects exactly $1,040 baseline + $2,275 approved change = $3,315 total,
    with the duplicate proposal marked as superseded and excluded from the ledger.
    """
    acme_id = "0c45b2ff-e479-429d-b0d5-b7451bfa0b89"
    detail = client.get(f"/api/projects/{acme_id}").json()

    # 1. Baseline verification
    baseline = detail["baseline"]
    assert baseline is not None
    assert baseline["total_baseline_price"] == 1040.0
    assert baseline["total_estimated_hours"] == 8.0

    # 2. Change requests verification
    crs = detail["change_requests"]
    assert len(crs) == 2

    approved_crs = [c for c in crs if c["status"] == "approved"]
    superseded_crs = [c for c in crs if c["status"] == "superseded"]

    assert len(approved_crs) == 1
    assert approved_crs[0]["calculated_cost"] == 2275.0
    assert approved_crs[0]["calculated_hours"] == 17.5

    assert len(superseded_crs) == 1
    assert superseded_crs[0]["calculated_cost"] == 2470.0
    assert "Superseded" in superseded_crs[0]["client_feedback"]

    # 3. Project portfolio summary reconciliation
    projects = client.get("/api/projects").json()
    acme = next(p for p in projects if p["id"] == acme_id)

    assert acme["total_baseline_price"] == 1040.0
    assert acme["approved_changes_cost"] == 2275.0
    total_ledger = acme["total_baseline_price"] + acme["approved_changes_cost"]
    assert total_ledger == 3315.00
