export type ScopeCategory = 'requirement' | 'assumption' | 'exclusion' | 'clarification';
export type Complexity = 'low' | 'medium' | 'high';
export type ImpactType = 'new_feature' | 'scope_expansion' | 'out_of_scope' | 'clarification';

export interface ScopeItem {
  id?: string;
  category: ScopeCategory;
  title: string;
  description: string;
  complexity: Complexity;
  estimated_hours_min: number;
  estimated_hours_max: number;
  suggested_hours: number;
  order_index?: number;
  provenance?: 'explicit' | 'suggested';
}

export interface ScopeExtractionItem {
  title: string;
  description: string;
  complexity: Complexity;
  estimated_hours_min: number;
  estimated_hours_max: number;
  suggested_hours: number;
  provenance?: 'explicit' | 'suggested';
}

export interface ScopeAssumption {
  title: string;
  description: string;
}

export interface ScopeExclusion {
  title: string;
  description: string;
}

export interface ScopeClarification {
  question: string;
  reason: string;
}

export interface ScopeExtractionResponse {
  summary: string;
  requirements: ScopeExtractionItem[];
  assumptions: ScopeAssumption[];
  exclusions: ScopeExclusion[];
  clarifications: ScopeClarification[];
  total_suggested_hours: number;
  suggested_price: number;
  disclaimer: string;
  extraction_source?: "ollama_qwen25_3b" | "local_fallback";
}

export interface Project {
  id: string;
  name: string;
  client_name: string;
  client_email: string;
  hourly_rate: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
  total_baseline_hours?: number;
  total_baseline_price?: number;
  change_requests_count?: number;
  approved_changes_cost?: number;
}

export interface ProjectDetail {
  project: Project;
  baseline: {
    id: string;
    project_id: string;
    raw_brief: string;
    summary: string;
    total_estimated_hours: number;
    total_baseline_price: number;
    disclaimer: string;
    created_at: string;
  } | null;
  items: ScopeItem[];
  change_requests: ChangeRequest[];
}

export interface ChangeItem {
  id?: string;
  title: string;
  impact_type: ImpactType;
  reasoning: string;
  estimated_hours: number;
}

export interface ChangeAnalysisResponse {
  summary: string;
  changes: ChangeItem[];
  total_additional_hours: number;
  estimated_additional_cost: number;
  hourly_rate_applied: number;
  disclaimer: string;
}

export interface ChangeRequest {
  id: string;
  project_id: string;
  title: string;
  client_message: string;
  ai_analysis: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'superseded';
  calculated_hours: number;
  calculated_cost: number;
  hourly_rate_applied: number;
  share_token: string;
  client_feedback?: string;
  client_action_at?: string;
  disclaimer: string;
  created_at: string;
}
