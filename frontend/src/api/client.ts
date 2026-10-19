import type { Project, ProjectDetail, ScopeExtractionResponse, ChangeAnalysisResponse, ChangeItem, ScopeItem } from '../types';

const API_BASE = '/api';

export async function getHealth(): Promise<{ status: string; ollama: { connected: boolean; model_available: boolean; target_model: string } }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error('Failed to fetch project details');
  return res.json();
}

export async function createProject(data: {
  name: string;
  client_name: string;
  client_email?: string;
  hourly_rate: number;
  currency?: string;
}): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function extractScope(briefText: string, hourlyRate: number): Promise<ScopeExtractionResponse> {
  const res = await fetch(`${API_BASE}/scope/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief_text: briefText, hourly_rate: hourlyRate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to extract scope' }));
    throw new Error(err.detail || 'Failed to extract scope');
  }
  return res.json();
}

export async function saveBaseline(projectId: string, payload: {
  raw_brief: string;
  summary: string;
  items: ScopeItem[];
  hourly_rate: number;
}): Promise<{ status: string; baseline_id: string; totals: any }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/baseline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      raw_brief: payload.raw_brief,
      summary: payload.summary,
      items: payload.items,
      hourly_rate: payload.hourly_rate,
    }),
  });
  if (!res.ok) throw new Error('Failed to save baseline scope');
  return res.json();
}

export async function analyzeChange(projectId: string, clientMessage: string): Promise<ChangeAnalysisResponse> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/analyze-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_message: clientMessage }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to analyze change request' }));
    throw new Error(err.detail || 'Failed to analyze change');
  }
  return res.json();
}

export async function createChangeRequest(projectId: string, payload: {
  title: string;
  client_message: string;
  ai_analysis: string;
  items: ChangeItem[];
  hourly_rate: number;
}): Promise<{ status: string; share_token: string; share_url: string; totals: any; message?: string }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/change-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create change request' }));
    const errorMsg = typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Failed to create change request';
    const error: any = new Error(errorMsg);
    error.status = res.status;
    error.detail = err.detail;
    throw error;
  }
  return res.json();
}

export async function getProposal(token: string): Promise<any> {
  const res = await fetch(`${API_BASE}/proposals/${token}`);
  if (!res.ok) throw new Error('Proposal not found');
  return res.json();
}

export async function actOnProposal(token: string, action: 'approve' | 'reject' | 'feedback', feedback?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/proposals/${token}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, client_feedback: feedback }),
  });
  if (!res.ok) throw new Error('Failed to update proposal status');
  return res.json();
}
