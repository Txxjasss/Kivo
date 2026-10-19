from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

STANDARD_DISCLAIMER = (
    "Non-binding estimate only. Not a legally binding contract or guaranteed delivery timeline. "
    "Actual effort and pricing depend upon final signed statements of work and validated client deliverables."
)

class ScopeItemBase(BaseModel):
    category: Literal["requirement", "assumption", "exclusion", "clarification"]
    title: str
    description: str
    complexity: Literal["low", "medium", "high"] = "medium"
    estimated_hours_min: float = 0.0
    estimated_hours_max: float = 0.0
    suggested_hours: float = 0.0
    order_index: int = 0
    provenance: Literal["explicit", "suggested"] = "explicit" 

class ScopeItemCreate(ScopeItemBase):
    pass

class ScopeItemResponse(ScopeItemBase):
    id: str
    scope_baseline_id: str

class ScopeExtractionItem(BaseModel):
    title: str
    description: str
    complexity: Literal["low", "medium", "high"] = "medium"
    estimated_hours_min: float = 0.0
    estimated_hours_max: float = 0.0
    suggested_hours: float = 0.0
    provenance: Literal["explicit", "suggested"] = "explicit" 

class ScopeExtractionAssumption(BaseModel):
    title: str
    description: str

class ScopeExtractionExclusion(BaseModel):
    title: str
    description: str

class ScopeExtractionClarification(BaseModel):
    question: str
    reason: str

class ScopeExtractionResponse(BaseModel):
    summary: str
    requirements: List[ScopeExtractionItem] = Field(default_factory=list)
    assumptions: List[ScopeExtractionAssumption] = Field(default_factory=list)
    exclusions: List[ScopeExtractionExclusion] = Field(default_factory=list)
    clarifications: List[ScopeExtractionClarification] = Field(default_factory=list)
    total_suggested_hours: float = 0.0
    suggested_price: float = 0.0
    disclaimer: str = STANDARD_DISCLAIMER
    extraction_source: str = "ollama_qwen25_3b"

class ExtractScopeRequest(BaseModel):
    brief_text: str
    hourly_rate: float = 120.0
    project_name: Optional[str] = None
    client_name: Optional[str] = None

class BaselineSaveRequest(BaseModel):
    project_id: str
    raw_brief: str
    summary: str
    items: List[ScopeItemCreate]
    hourly_rate: float = 120.0

class ProjectCreate(BaseModel):
    name: str
    client_name: str
    client_email: Optional[str] = ""
    hourly_rate: float = 120.0
    currency: str = "USD"

class ProjectResponse(BaseModel):
    id: str
    name: str
    client_name: str
    client_email: str
    hourly_rate: float
    currency: str
    status: str
    created_at: str
    updated_at: str
    total_baseline_hours: Optional[float] = 0.0
    total_baseline_price: Optional[float] = 0.0
    change_requests_count: Optional[int] = 0
    approved_changes_cost: Optional[float] = 0.0

class ChangeItemModel(BaseModel):
    title: str
    impact_type: Literal["new_feature", "scope_expansion", "out_of_scope", "clarification"]
    reasoning: str
    estimated_hours: float

class ChangeAnalysisRequest(BaseModel):
    client_message: str

class ChangeAnalysisResponse(BaseModel):
    summary: str
    changes: List[ChangeItemModel]
    total_additional_hours: float
    estimated_additional_cost: float
    hourly_rate_applied: float
    disclaimer: str = STANDARD_DISCLAIMER

class ChangeRequestCreate(BaseModel):
    title: str
    client_message: str
    ai_analysis: str
    items: List[ChangeItemModel]
    hourly_rate: float

class ProposalActionRequest(BaseModel):
    action: Literal["approve", "reject", "feedback"]
    client_feedback: Optional[str] = ""
