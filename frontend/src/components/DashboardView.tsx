import React, { useEffect, useState, useCallback } from 'react';
import {
  Layers, Clock, DollarSign, GitPullRequest,
  PlusCircle, RefreshCw, ChevronRight, X, ShieldAlert,
  HelpCircle, Loader2, Plus, Eye, Lock
} from 'lucide-react';
import { getProjects, getProject, createProject } from '../api/client';
import { formatCurrency, formatRate, formatHours } from '../utils/currency';
import type { Project, ProjectDetail } from '../types';

interface DashboardViewProps {
  onSelectProject: (projectId: string) => void;
  onNewScopeClick: () => void;
  onAnalyzeCreep: (projectId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNewScopeClick,
  onAnalyzeCreep,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Project baseline detail modal state
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Quick create project modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newHourlyRate, setNewHourlyRate] = useState<number>(130);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      console.error('Failed to fetch projects', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Open Project Baseline Detail Modal
  const handleOpenDetail = async (projectId: string) => {
    setViewingProjectId(projectId);
    setDetailLoading(true);
    try {
      const data = await getProject(projectId);
      setProjectDetail(data);
    } catch (err) {
      console.error('Failed to load project details', err);
      setProjectDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setViewingProjectId(null);
    setProjectDetail(null);
  };

  // Quick create project
  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newClientName.trim()) {
      setCreateError('Project name and client name are required.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await createProject({
        name: newProjectName.trim(),
        client_name: newClientName.trim(),
        client_email: newClientEmail.trim() || undefined,
        hourly_rate: Number(newHourlyRate) || 120,
        currency: 'USD',
      });
      setIsCreateModalOpen(false);
      setNewProjectName('');
      setNewClientName('');
      setNewClientEmail('');
      await fetchProjects();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  // Compute portfolio metrics
  const totalHours = projects.reduce((acc, p) => acc + (p.total_baseline_hours || 0), 0);
  const totalValue = projects.reduce((acc, p) => acc + (p.total_baseline_price || 0), 0);
  const totalChangesValue = projects.reduce((acc, p) => acc + (p.approved_changes_cost || 0), 0);
  const totalChangeCount = projects.reduce((acc, p) => acc + (p.change_requests_count || 0), 0);

  // Group items by category for project detail modal
  const requirements = projectDetail?.items.filter(i => i.category === 'requirement') || [];
  const assumptions = projectDetail?.items.filter(i => i.category === 'assumption') || [];
  const exclusions = projectDetail?.items.filter(i => i.category === 'exclusion') || [];
  const clarifications = projectDetail?.items.filter(i => i.category === 'clarification') || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 w-full min-w-0">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono text-[#C4B5FD] uppercase tracking-wider block mb-1">
            Freelancer Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F7F8FA]">
            Scope Portfolio & Change Ledger
          </h1>
          <p className="text-xs sm:text-sm text-[#9BA3B5] mt-1">
            Local-first scope baselines, boundary enforcement, and deterministic change order pricing.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={fetchProjects}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-[#131620] hover:bg-[#1A1E2B] border border-[#232838] text-[#9BA3B5] hover:text-[#F7F8FA] transition-colors"
            title="Refresh database"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#8B5CF6]' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#131620] hover:bg-[#1A1E2B] border border-[#232838] text-[#F7F8FA] text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Quick Project</span>
          </button>

          <button
            onClick={onNewScopeClick}
            className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-white font-bold text-xs sm:text-sm hover:bg-[#9D72FF] transition-all flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Scope Intake</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid — Responsive 1/2/4 columns with min-w-0 to prevent blowout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full">
        <div className="bg-[#12151E] border border-[#232838] rounded-xl p-4 sm:p-5 space-y-1.5 shadow-sm min-w-0">
          <div className="flex items-center justify-between text-xs text-[#6E778B] gap-1">
            <span className="font-medium uppercase tracking-wider text-[10px] truncate">Active Scopes</span>
            <Layers className="w-4 h-4 text-[#A3ACBF] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#F7F8FA] font-mono truncate">{projects.length}</div>
          <span className="text-[11px] text-[#6E778B] block truncate">Persisted in local SQLite</span>
        </div>

        <div className="bg-[#12151E] border border-[#232838] rounded-xl p-4 sm:p-5 space-y-1.5 shadow-sm min-w-0">
          <div className="flex items-center justify-between text-xs text-[#6E778B] gap-1">
            <span className="font-medium uppercase tracking-wider text-[10px] truncate">Agreed Billable Hours</span>
            <Clock className="w-4 h-4 text-[#8B5CF6] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#F7F8FA] font-mono truncate">{formatHours(totalHours)}</div>
          <span className="text-[11px] text-[#6E778B] block truncate">Baseline contracted effort</span>
        </div>

        <div className="bg-[#12151E] border border-[#232838] rounded-xl p-4 sm:p-5 space-y-1.5 shadow-sm min-w-0">
          <div className="flex items-center justify-between text-xs text-[#6E778B] gap-1">
            <span className="font-medium uppercase tracking-wider text-[10px] truncate">Baseline Contract Value</span>
            <DollarSign className="w-4 h-4 text-[#8B5CF6] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#F7F8FA] font-mono truncate">{formatCurrency(totalValue)}</div>
          <span className="text-[11px] text-[#6E778B] block truncate">Agreed baseline total</span>
        </div>

        <div className="bg-[#12151E] border border-[#232838] rounded-xl p-4 sm:p-5 space-y-1.5 shadow-sm min-w-0">
          <div className="flex items-center justify-between text-xs text-[#6E778B] gap-1">
            <span className="font-medium uppercase tracking-wider text-[10px] truncate">Protected Scope Changes</span>
            <GitPullRequest className="w-4 h-4 text-[#8B5CF6] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#8B5CF6] font-mono truncate">
            +{formatCurrency(totalChangesValue)}
          </div>
          <span className="text-[11px] text-[#6E778B] block truncate">{totalChangeCount} change order(s) tracked</span>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-[#F7F8FA] flex items-center gap-2">
            <span>Active Engagements</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1A1E2B] text-[#A3ACBF] border border-[#232838] font-mono">
              {projects.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs sm:text-sm text-[#6E778B] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
            <span>Loading projects from local database...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-[#12151E] border border-dashed border-[#232838] rounded-2xl p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#1A1E2B] border border-[#232838] flex items-center justify-center mx-auto text-[#A3ACBF]">
              <Layers className="w-6 h-6 text-[#8B5CF6]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#F7F8FA]">No scope baselines created yet</h3>
              <p className="text-xs text-[#9BA3B5] max-w-md mx-auto">
                Paste an ambiguous brief or RFP notes into Kivo. Local AI extracts deliverables, highlights boundaries, and establishes defensible scopes.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-[#1A1E2B] border border-[#232838] text-[#F7F8FA] text-xs font-semibold hover:bg-[#242938] transition-all"
              >
                Create Empty Project
              </button>
              <button
                onClick={onNewScopeClick}
                className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-white font-bold text-xs hover:bg-[#9D72FF] transition-all inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Scope from Brief</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {projects.map((project) => {
              const baselineValue = project.total_baseline_price || 0;
              const changesValue = project.approved_changes_cost || 0;
              const totalLedger = baselineValue + changesValue;

              return (
                <div
                  key={project.id}
                  className="bg-[#12151E] border border-[#232838] hover:border-[#333A4E] transition-all rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 group shadow-sm min-w-0 w-full"
                >
                  <div
                    className="space-y-3 flex-1 cursor-pointer min-w-0 w-full"
                    onClick={() => handleOpenDetail(project.id)}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-[#F7F8FA] group-hover:text-[#8B5CF6] transition-colors break-words">
                        {project.name}
                      </h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#181C28] text-[#9BA3B5] border border-[#2B3144] shrink-0">
                        {project.status}
                      </span>
                      {Number(project.total_baseline_hours) > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 flex items-center gap-1 shrink-0">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Agreed Baseline Locked</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#9BA3B5]">
                      <span className="px-2.5 py-1 rounded-md bg-[#181C28] border border-[#232838] text-[11px] break-words">
                        Client: <strong className="text-[#F7F8FA] font-medium">{project.client_name}</strong>
                      </span>

                      <span className="px-2.5 py-1 rounded-md bg-[#181C28] border border-[#232838] text-[11px] font-mono whitespace-nowrap">
                        Rate: <strong className="text-[#F7F8FA]">{formatRate(project.hourly_rate)}</strong>
                      </span>

                      <span className="px-2.5 py-1 rounded-md bg-[#181C28] border border-[#232838] text-[11px] font-mono whitespace-nowrap">
                        Baseline: <strong className="text-[#F7F8FA]">{formatHours(project.total_baseline_hours)}</strong> ({formatCurrency(baselineValue)})
                      </span>

                      {changesValue > 0 && (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-500/50 text-[11px] font-mono text-emerald-300 whitespace-nowrap">
                          +{formatCurrency(changesValue)} approved changes
                        </span>
                      )}

                      <span className="px-2.5 py-1 rounded-md bg-[#181C28] border border-[#232838] text-[11px] font-mono text-[#8B5CF6] font-semibold whitespace-nowrap">
                        Total Ledger: {formatCurrency(totalLedger)}
                      </span>
                    </div>
                  </div>

                  {/* Actions — Wrap on smaller widths without expanding page */}
                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0 flex-wrap">
                    <button
                      onClick={() => onAnalyzeCreep(project.id)}
                      className="px-3 sm:px-3.5 py-2 rounded-lg bg-[#181C28] hover:bg-[#232838] border border-[#232838] text-xs font-semibold text-[#F7F8FA] transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <GitPullRequest className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      <span>Check Scope Creep</span>
                    </button>

                    <button
                      onClick={() => handleOpenDetail(project.id)}
                      className="px-3 py-2 rounded-lg bg-[#181C28] hover:bg-[#232838] border border-[#232838] text-xs font-medium text-[#9BA3B5] hover:text-[#F7F8FA] transition-colors flex items-center gap-1 shrink-0"
                      title="View Scope Baseline Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Details</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#6E778B]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Project Baseline Details Modal */}
      {viewingProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#12151E] border border-[#232838] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#232838] flex items-center justify-between bg-[#151824]">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#8B5CF6] tracking-wider block">
                    Agreed Baseline Scope Specification
                  </span>
                  <h3 className="text-xl font-bold text-[#F7F8FA]">
                    {projectDetail?.project.name || 'Loading Project...'}
                  </h3>
                </div>
              </div>
              <button
                onClick={handleCloseDetail}
                className="p-1.5 rounded-lg text-[#6E778B] hover:text-[#F7F8FA] hover:bg-[#1C202E] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-sm text-[#9BA3B5]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
                  <span>Loading scope baseline details from SQLite...</span>
                </div>
              ) : !projectDetail ? (
                <div className="py-12 text-center text-sm text-rose-400">
                  Failed to load project details.
                </div>
              ) : (
                <>
                  {/* Meta Details Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#181C28] border border-[#232838]">
                      <span className="text-[10px] font-mono text-[#6E778B] uppercase block">Client Entity</span>
                      <span className="text-xs font-semibold text-[#F7F8FA] truncate block">{projectDetail.project.client_name}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#181C28] border border-[#232838]">
                      <span className="text-[10px] font-mono text-[#6E778B] uppercase block">Billable Rate</span>
                      <span className="text-xs font-semibold text-[#F7F8FA] font-mono">{formatRate(projectDetail.project.hourly_rate)}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#181C28] border border-[#232838]">
                      <span className="text-[10px] font-mono text-[#6E778B] uppercase block">Baseline Effort</span>
                      <span className="text-xs font-semibold text-[#8B5CF6] font-mono">
                        {formatHours(projectDetail.baseline?.total_estimated_hours || 0)}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#181C28] border border-[#232838]">
                      <span className="text-[10px] font-mono text-[#6E778B] uppercase block">Baseline Value</span>
                      <span className="text-xs font-semibold text-[#8B5CF6] font-mono">
                        {formatCurrency(projectDetail.baseline?.total_baseline_price || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  {projectDetail.baseline?.summary && (
                    <div className="p-4 rounded-xl bg-[#181C28] border border-[#232838] space-y-1">
                      <span className="text-[10px] font-mono uppercase text-[#A3ACBF] tracking-wider block">
                        Executive Scope Summary
                      </span>
                      <p className="text-xs sm:text-sm text-[#F7F8FA] leading-relaxed">
                        {projectDetail.baseline.summary}
                      </p>
                    </div>
                  )}

                  {/* Discrete Deliverables */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs sm:text-sm font-semibold text-[#F7F8FA] flex items-center gap-2">
                        <span>1. Discrete Deliverables</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#181C28] text-[#8B5CF6] border border-[#232838]">
                          {requirements.length}
                        </span>
                      </h4>
                    </div>

                    {requirements.length === 0 ? (
                      <p className="text-xs text-[#6E778B] italic">No deliverables recorded for this project baseline.</p>
                    ) : (
                      <div className="space-y-2">
                        {requirements.map((req, idx) => (
                          <div
                            key={req.id || idx}
                            className="p-3.5 rounded-xl bg-[#181C28] border border-[#232838] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-[#F7F8FA]">{req.title}</span>
                                <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                                  (req.provenance || 'explicit') === 'suggested'
                                    ? 'bg-purple-950/60 text-purple-300 border-purple-500/50'
                                    : 'bg-blue-950/60 text-blue-300 border-blue-500/50'
                                }`}>
                                  {(req.provenance || 'explicit') === 'suggested' ? 'AI Suggested' : 'Client Explicit'}
                                </span>
                                <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                                  req.complexity === 'high'
                                    ? 'text-rose-300 border-rose-800/50'
                                    : req.complexity === 'medium'
                                    ? 'text-amber-300 border-amber-800/50'
                                    : 'text-emerald-300 border-emerald-800/50'
                                }`}>
                                  {req.complexity}
                                </span>
                              </div>
                              <p className="text-[#9BA3B5] leading-relaxed text-[11px] sm:text-xs">{req.description}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] self-end sm:self-center">
                              <span className="text-[#6E778B]">
                                [{req.estimated_hours_min}-{req.estimated_hours_max}h]
                              </span>
                              <span className="text-[#8B5CF6] font-semibold">
                                {req.suggested_hours}h
                              </span>
                              <span className="text-[#9BA3B5]">
                                ({formatCurrency(Math.round(req.suggested_hours * projectDetail.project.hourly_rate))})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assumptions & Exclusions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Assumptions */}
                    <div className="p-4 rounded-xl bg-[#181C28] border border-[#232838] space-y-2">
                      <h4 className="text-xs font-semibold text-[#F7F8FA] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        <span>Operational Assumptions ({assumptions.length})</span>
                      </h4>
                      {assumptions.length === 0 ? (
                        <p className="text-xs text-[#6E778B] italic">No assumptions recorded.</p>
                      ) : (
                        <div className="space-y-2 pt-1">
                          {assumptions.map((a, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-[#12151E] border border-[#232838] text-xs space-y-0.5">
                              <span className="font-medium text-[#F7F8FA] block">{a.title}</span>
                              <span className="text-[#9BA3B5] block text-[11px]">{a.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Exclusions */}
                    <div className="p-4 rounded-xl bg-[#181C28] border border-[#232838] space-y-2">
                      <h4 className="text-xs font-semibold text-[#F7F8FA] flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        <span>Out-of-Scope Exclusions ({exclusions.length})</span>
                      </h4>
                      {exclusions.length === 0 ? (
                        <p className="text-xs text-[#6E778B] italic">No exclusions recorded.</p>
                      ) : (
                        <div className="space-y-2 pt-1">
                          {exclusions.map((e, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-[#12151E] border border-amber-900/30 text-xs space-y-0.5">
                              <span className="font-medium text-amber-200 block">{e.title}</span>
                              <span className="text-[#9BA3B5] block text-[11px]">{e.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clarifications */}
                  {clarifications.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#181C28] border border-[#232838] space-y-2">
                      <h4 className="text-xs font-semibold text-[#F7F8FA] flex items-center gap-2">
                        <HelpCircle className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <span>Clarification Questions ({clarifications.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {clarifications.map((c, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-[#12151E] border border-[#232838] text-xs space-y-0.5">
                            <span className="font-medium text-[#F7F8FA] block">Q: {c.title}</span>
                            <span className="text-[#6E778B] block text-[11px]">Why: {c.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legal Disclaimer */}
                  <div className="text-[11px] text-[#6E778B] border-t border-[#232838] pt-3">
                    <strong className="text-[#9BA3B5]">Legal Notice:</strong> Non-binding estimate only. Not a legally binding contract or guaranteed delivery timeline.
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#232838] bg-[#151824] flex items-center justify-between">
              <button
                onClick={handleCloseDetail}
                className="px-4 py-2 rounded-lg bg-[#181C28] hover:bg-[#232838] border border-[#232838] text-xs font-medium text-[#9BA3B5] transition-colors"
              >
                Close
              </button>

              <button
                onClick={() => {
                  if (projectDetail) {
                    onAnalyzeCreep(projectDetail.project.id);
                    handleCloseDetail();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#9D72FF] text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                <span>Check Scope Creep for this Project</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#12151E] border border-[#232838] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#232838] flex items-center justify-between bg-[#151824]">
              <h3 className="text-base font-bold text-[#F7F8FA]">Create New Project</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded text-[#6E778B] hover:text-[#F7F8FA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreate} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#9BA3B5] mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
                  placeholder="e.g. NextGen Web App"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9BA3B5] mb-1">Client Entity / Contact *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
                  placeholder="e.g. Acme Corporation"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9BA3B5] mb-1">Client Contact Email</label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="w-full bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
                  placeholder="contact@acme.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9BA3B5] mb-1">Hourly Billable Rate ($ / hr)</label>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={newHourlyRate}
                  onChange={(e) => setNewHourlyRate(Number(e.target.value))}
                  className="w-full bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-sm text-[#F7F8FA] font-mono focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#181C28] hover:bg-[#232838] border border-[#232838] text-xs font-medium text-[#9BA3B5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#9D72FF] text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Create Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
