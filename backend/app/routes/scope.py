from fastapi import APIRouter, HTTPException
from app.models.schemas import ExtractScopeRequest, ScopeExtractionResponse, ScopeExtractionItem, ScopeExtractionAssumption, ScopeExtractionExclusion, ScopeExtractionClarification
from app.services.ollama_client import extract_scope_from_brief
from app.services.pricing_engine import calculate_scope_totals

router = APIRouter(prefix="/api/scope", tags=["scope"])

@router.post("/extract", response_model=ScopeExtractionResponse)
async def extract_scope(payload: ExtractScopeRequest):
    if not payload.brief_text.strip():
        raise HTTPException(status_code=400, detail="Client brief text cannot be empty.")

    extracted = await extract_scope_from_brief(payload.brief_text)
    
    brief_lower = payload.brief_text.lower()
    inferred_keywords = [
        "filterable", "lightbox", "accordion", "client-logo", "logo section", "logo bar",
        "carousel", "package accordion", "filter gallery", "interactive filter", "modal popup"
    ]

    # Format and validate requirements
    raw_reqs = extracted.get("requirements", [])
    requirements = []
    for item in raw_reqs:
        s_hours = float(item.get("suggested_hours", 8.0))
        min_h = float(item.get("estimated_hours_min", s_hours * 0.8))
        max_h = float(item.get("estimated_hours_max", s_hours * 1.3))
        complexity = item.get("complexity", "medium").lower()
        if complexity not in ("low", "medium", "high"):
            complexity = "medium"
        prov = str(item.get("provenance", "explicit")).lower()
        if prov not in ("explicit", "suggested"):
            prov = "explicit"

        title_lower = item.get("title", "").lower()
        desc_lower = item.get("description", "").lower()
        for kw in inferred_keywords:
            if (kw in title_lower or kw in desc_lower) and (kw not in brief_lower):
                prov = "suggested"
                break

        requirements.append(ScopeExtractionItem(
            title=item.get("title", "Untitled Requirement"),
            description=item.get("description", ""),
            complexity=complexity,
            estimated_hours_min=round(min_h, 2),
            estimated_hours_max=round(max_h, 2),
            suggested_hours=round(s_hours, 2),
            provenance=prov
        ))

    # Format assumptions
    raw_assumptions = extracted.get("assumptions", [])
    assumptions = [
        ScopeExtractionAssumption(
            title=a.get("title", "Assumption"),
            description=a.get("description", "")
        )
        for a in raw_assumptions
    ]

    # Format exclusions
    raw_exclusions = extracted.get("exclusions", [])
    exclusions = [
        ScopeExtractionExclusion(
            title=e.get("title", "Exclusion"),
            description=e.get("description", "")
        )
        for e in raw_exclusions
    ]

    # Format clarifications
    raw_clarifications = extracted.get("clarifications", [])
    clarifications = [
        ScopeExtractionClarification(
            question=c.get("question", "Clarification needed"),
            reason=c.get("reason", "")
        )
        for c in raw_clarifications
    ]

    # Deterministic price calculation
    items_for_pricing = [
        {"category": "requirement", "suggested_hours": r.suggested_hours, "estimated_hours_min": r.estimated_hours_min, "estimated_hours_max": r.estimated_hours_max}
        for r in requirements
    ]
    pricing = calculate_scope_totals(items_for_pricing, payload.hourly_rate)

    return ScopeExtractionResponse(
        summary=extracted.get("summary", "Project scope extracted from client brief."),
        requirements=requirements,
        assumptions=assumptions,
        exclusions=exclusions,
        clarifications=clarifications,
        total_suggested_hours=pricing["total_suggested_hours"],
        suggested_price=pricing["projected_price"],
        disclaimer=pricing["disclaimer"],
        extraction_source=extracted.get("extraction_source", "ollama_qwen25_3b")
    )
