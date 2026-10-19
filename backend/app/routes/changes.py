import uuid
import secrets
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite
from app.database import get_db
from app.models.schemas import (
    ChangeAnalysisRequest, ChangeAnalysisResponse, ChangeItemModel,
    ChangeRequestCreate, ProposalActionRequest, STANDARD_DISCLAIMER
)
from app.services.ollama_client import analyze_scope_creep
from app.services.pricing_engine import calculate_change_request_totals

router = APIRouter(tags=["change_requests"])

# Concurrency lock per project to prevent race conditions during duplicate checks & creation
_project_cr_locks: dict[str, asyncio.Lock] = {}

def _get_project_cr_lock(project_id: str) -> asyncio.Lock:
    if project_id not in _project_cr_locks:
        _project_cr_locks[project_id] = asyncio.Lock()
    return _project_cr_locks[project_id]

def _normalize_request_text(text: str) -> str:
    """Normalize text by collapsing whitespace and lowercasing for deterministic deduplication."""
    return " ".join((text or "").strip().lower().split())

@router.post("/api/projects/{project_id}/analyze-change", response_model=ChangeAnalysisResponse)
async def analyze_change(project_id: str, payload: ChangeAnalysisRequest, db: aiosqlite.Connection = Depends(get_db)):
    if not payload.client_message.strip():
        raise HTTPException(status_code=400, detail="Client message cannot be empty.")

    # Fetch baseline scope
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cursor = await db.execute("SELECT * FROM scope_baselines WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,))
    baseline = await cursor.fetchone()
    if not baseline:
        raise HTTPException(status_code=400, detail="Project has no baseline scope set yet.")

    cursor = await db.execute("SELECT * FROM scope_items WHERE scope_baseline_id = ?", (baseline["id"],))
    items_rows = await cursor.fetchall()
    items = [dict(r) for r in items_rows]

    # AI analyzes difference
    diff_result = await analyze_scope_creep(baseline["summary"], items, payload.client_message)

    changes = []
    for c in diff_result.get("changes", []):
        impact = c.get("impact_type", "scope_expansion")
        if impact not in ("new_feature", "scope_expansion", "out_of_scope", "clarification"):
            impact = "scope_expansion"
        hours = max(0.5, float(c.get("estimated_hours", 3.0)))
        changes.append(ChangeItemModel(
            title=c.get("title", "Scope Adjustment"),
            impact_type=impact,
            reasoning=c.get("reasoning", "Additional effort required."),
            estimated_hours=round(hours, 1)
        ))

    # Deterministic price calculation
    totals = calculate_change_request_totals([c.model_dump() for c in changes], project["hourly_rate"])

    return ChangeAnalysisResponse(
        summary=diff_result.get("summary", "Analysis of scope delta based on client request."),
        changes=changes,
        total_additional_hours=totals["total_hours"],
        estimated_additional_cost=totals["total_cost"],
        hourly_rate_applied=project["hourly_rate"],
        disclaimer=totals["disclaimer"]
    )

@router.post("/api/projects/{project_id}/change-requests")
async def create_change_request(project_id: str, payload: ChangeRequestCreate, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    async with _get_project_cr_lock(project_id):
        norm_incoming = _normalize_request_text(payload.client_message)

        # Check existing change requests for this project against normalized client message
        cursor = await db.execute("""
            SELECT id, status, share_token, client_message, calculated_hours, calculated_cost
            FROM change_requests
            WHERE project_id = ?
            ORDER BY created_at ASC
        """, (project_id,))
        existing_rows = await cursor.fetchall()

        for row in existing_rows:
            if _normalize_request_text(row["client_message"]) == norm_incoming:
                # 1. If an equivalent proposal is already approved: return HTTP 409
                if row["status"] == "approved":
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"An approved change order already exists for this client request "
                            f"(Proposal token: {row['share_token']}, {row['calculated_hours']}h / ${row['calculated_cost']:.2f}). "
                            "Duplicate proposal generation is prohibited to protect the project ledger against double-counting."
                        )
                    )
                # 2. If an equivalent proposal is already pending (sent or draft): reuse existing token & URL
                elif row["status"] in ("sent", "draft"):
                    return {
                        "status": "reused_pending",
                        "change_request_id": row["id"],
                        "share_token": row["share_token"],
                        "share_url": f"/proposals/{row['share_token']}",
                        "totals": {
                            "total_hours": row["calculated_hours"],
                            "total_cost": row["calculated_cost"],
                            "hourly_rate": payload.hourly_rate,
                            "disclaimer": STANDARD_DISCLAIMER
                        },
                        "message": "Reusing existing pending proposal for this client request."
                    }

        now = datetime.utcnow().isoformat()
        cr_id = str(uuid.uuid4())
        share_token = secrets.token_urlsafe(16)

        totals = calculate_change_request_totals([c.model_dump() for c in payload.items], payload.hourly_rate)

        await db.execute("""
            INSERT INTO change_requests (
                id, project_id, title, client_message, ai_analysis, status,
                calculated_hours, calculated_cost, hourly_rate_applied, share_token, disclaimer, created_at
            ) VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?)
        """, (
            cr_id,
            project_id,
            payload.title,
            payload.client_message,
            payload.ai_analysis,
            totals["total_hours"],
            totals["total_cost"],
            payload.hourly_rate,
            share_token,
            STANDARD_DISCLAIMER,
            now
        ))

        for item in payload.items:
            it_id = str(uuid.uuid4())
            await db.execute("""
                INSERT INTO change_items (id, change_request_id, title, impact_type, reasoning, estimated_hours)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                it_id,
                cr_id,
                item.title,
                item.impact_type,
                item.reasoning,
                item.estimated_hours
            ))

        await db.commit()

        return {
            "status": "success",
            "change_request_id": cr_id,
            "share_token": share_token,
            "share_url": f"/proposals/{share_token}",
            "totals": totals
        }

@router.get("/api/proposals/{token}")
async def get_proposal_by_token(token: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM change_requests WHERE share_token = ?", (token,))
    cr = await cursor.fetchone()
    if not cr:
        raise HTTPException(status_code=404, detail="Proposal not found or link has expired.")

    cr_dict = dict(cr)

    # Get project info
    cursor = await db.execute("""
        SELECT p.name, p.client_name, p.currency, p.hourly_rate,
               COALESCE(sb.total_baseline_price, 0.0) as total_baseline_price,
               COALESCE(sb.total_estimated_hours, 0.0) as total_baseline_hours
        FROM projects p
        LEFT JOIN scope_baselines sb ON sb.project_id = p.id
        WHERE p.id = ?
        ORDER BY sb.created_at DESC LIMIT 1
    """, (cr_dict["project_id"],))
    proj = await cursor.fetchone()

    # Get items
    cursor = await db.execute("SELECT * FROM change_items WHERE change_request_id = ?", (cr_dict["id"],))
    items_rows = await cursor.fetchall()

    # Get baseline items
    cursor = await db.execute("""
        SELECT si.title, si.description, si.category, si.suggested_hours, si.complexity, si.provenance
        FROM scope_items si
        JOIN scope_baselines sb ON si.scope_baseline_id = sb.id
        WHERE sb.project_id = ?
        ORDER BY si.order_index ASC
    """, (cr_dict["project_id"],))
    baseline_rows = await cursor.fetchall()

    return {
        "proposal": cr_dict,
        "project": dict(proj) if proj else {},
        "items": [dict(r) for r in items_rows],
        "baseline_items": [dict(r) for r in baseline_rows],
        "disclaimer": STANDARD_DISCLAIMER
    }

@router.post("/api/proposals/{token}/action")
async def update_proposal_action(token: str, payload: ProposalActionRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id, status, client_action_at, client_feedback FROM change_requests WHERE share_token = ?", (token,))
    cr = await cursor.fetchone()
    if not cr:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    current_status = cr["status"]

    if current_status == "superseded":
        raise HTTPException(
            status_code=400,
            detail="Proposal has been superseded by a prior change order and cannot be altered."
        )

    target_status = "approved" if payload.action == "approve" else ("rejected" if payload.action == "reject" else "draft")

    if current_status in ("approved", "rejected"):
        # If client repeats the exact same decision, return idempotent success
        if target_status == current_status:
            return {
                "status": "already_finalized",
                "new_status": current_status,
                "message": f"Proposal was already {current_status}.",
                "updated_at": cr["client_action_at"]
            }
        # Reject flipping an already finalized decision
        raise HTTPException(
            status_code=400,
            detail=f"Proposal has already been finalized as '{current_status}' and cannot be altered."
        )

    now = datetime.utcnow().isoformat()
    await db.execute("""
        UPDATE change_requests 
        SET status = ?, client_feedback = ?, client_action_at = ?
        WHERE share_token = ?
    """, (target_status, payload.client_feedback or "", now, token))
    await db.commit()

    return {
        "status": "success",
        "new_status": target_status,
        "updated_at": now
    }
