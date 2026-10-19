import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite
from app.database import get_db
from app.models.schemas import ProjectCreate, ProjectResponse, BaselineSaveRequest, STANDARD_DISCLAIMER
from app.services.pricing_engine import calculate_scope_totals

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("""
        SELECT 
            p.id, p.name, p.client_name, p.client_email, p.hourly_rate, p.currency, p.status, p.created_at, p.updated_at,
            COALESCE(sb.total_estimated_hours, 0.0) as total_baseline_hours,
            COALESCE(sb.total_baseline_price, 0.0) as total_baseline_price,
            (SELECT COUNT(*) FROM change_requests cr WHERE cr.project_id = p.id) as change_requests_count,
            (SELECT COALESCE(SUM(cr.calculated_cost), 0.0) FROM change_requests cr WHERE cr.project_id = p.id AND cr.status = 'approved') as approved_changes_cost
        FROM projects p
        LEFT JOIN scope_baselines sb ON sb.project_id = p.id
        ORDER BY p.updated_at DESC
    """)
    rows = await cursor.fetchall()
    return [ProjectResponse(**dict(row)) for row in rows]

@router.post("", response_model=ProjectResponse)
async def create_project(payload: ProjectCreate, db: aiosqlite.Connection = Depends(get_db)):
    now = datetime.utcnow().isoformat()
    project_id = str(uuid.uuid4())
    
    await db.execute("""
        INSERT INTO projects (id, name, client_name, client_email, hourly_rate, currency, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    """, (project_id, payload.name, payload.client_name, payload.client_email or "", payload.hourly_rate, payload.currency, now, now))
    await db.commit()

    return ProjectResponse(
        id=project_id,
        name=payload.name,
        client_name=payload.client_name,
        client_email=payload.client_email or "",
        hourly_rate=payload.hourly_rate,
        currency=payload.currency,
        status="active",
        created_at=now,
        updated_at=now,
        total_baseline_hours=0.0,
        total_baseline_price=0.0,
        change_requests_count=0,
        approved_changes_cost=0.0
    )

@router.get("/{project_id}")
async def get_project(project_id: str, db: aiosqlite.Connection = Depends(get_db)):
    # Project info
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    project_row = await cursor.fetchone()
    if not project_row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = dict(project_row)

    # Baseline info
    cursor = await db.execute("SELECT * FROM scope_baselines WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,))
    baseline_row = await cursor.fetchone()
    baseline = dict(baseline_row) if baseline_row else None

    # Scope items
    items = []
    if baseline:
        cursor = await db.execute("SELECT * FROM scope_items WHERE scope_baseline_id = ? ORDER BY order_index ASC", (baseline["id"],))
        item_rows = await cursor.fetchall()
        items = [dict(r) for r in item_rows]

    # Change requests
    cursor = await db.execute("SELECT * FROM change_requests WHERE project_id = ? ORDER BY created_at DESC", (project_id,))
    cr_rows = await cursor.fetchall()
    change_requests = [dict(r) for r in cr_rows]

    return {
        "project": project,
        "baseline": baseline,
        "items": items,
        "change_requests": change_requests
    }

@router.post("/{project_id}/baseline")
async def save_project_baseline(project_id: str, payload: BaselineSaveRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT hourly_rate FROM projects WHERE id = ?", (project_id,))
    p_row = await cursor.fetchone()
    if not p_row:
        raise HTTPException(status_code=404, detail="Project not found")

    hourly_rate = payload.hourly_rate or p_row["hourly_rate"]
    
    # Calculate deterministic totals
    dict_items = [it.model_dump() for it in payload.items]
    totals = calculate_scope_totals(dict_items, hourly_rate)

    baseline_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Clear previous baselines if any
    await db.execute("DELETE FROM scope_baselines WHERE project_id = ?", (project_id,))

    await db.execute("""
        INSERT INTO scope_baselines (id, project_id, raw_brief, summary, total_estimated_hours, total_baseline_price, disclaimer, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        baseline_id,
        project_id,
        payload.raw_brief,
        payload.summary,
        totals["total_suggested_hours"],
        totals["projected_price"],
        STANDARD_DISCLAIMER,
        now
    ))

    # Insert items
    for idx, it in enumerate(payload.items):
        item_id = str(uuid.uuid4())
        prov = getattr(it, "provenance", "explicit") or "explicit"
        await db.execute("""
            INSERT INTO scope_items (id, scope_baseline_id, category, title, description, complexity, estimated_hours_min, estimated_hours_max, suggested_hours, order_index, provenance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item_id,
            baseline_id,
            it.category,
            it.title,
            it.description,
            it.complexity,
            it.estimated_hours_min,
            it.estimated_hours_max,
            it.suggested_hours,
            idx,
            prov
        ))

    # Update project timestamp
    await db.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
    await db.commit()

    return {
        "status": "success",
        "baseline_id": baseline_id,
        "totals": totals
    }
