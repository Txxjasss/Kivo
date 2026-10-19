import React, { useState, useEffect } from 'react';
import {
  GitPullRequest, Sparkles, Clock, ShieldAlert,
  ArrowRight, CheckCircle2, Copy, ExternalLink, Loader2,
  Lock, ChevronDown, ChevronUp
} from 'lucide-react';
import { SAMPLE_CLIENT_MESSAGES } from '../data/sampleBriefs';
import { getProjects, getProject, analyzeChange, createChangeRequest } from '../api/client';
import { formatCurrency, formatRate, formatHours } from '../utils/currency';
import type { Project, ProjectDetail, ChangeItem, ChangeAnalysisResponse } from '../types';

interface ScopeCreepViewProps {
  initialProjectId?: string;
  onOpenProposalDemo: (token: string) => void;
}

export const ScopeCreepView: React.FC<ScopeCreepViewProps> = ({
  initialProjectId,
  onOpenProposalDemo,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [showBaselineItems, setShowBaselineItems] = useState(false);

  const [clientMessage, setClientMessage] = useState(SAMPLE_CLIENT_MESSAGES[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Analysis Result
  const [analysisResult, setAnalysisResult] = useState<ChangeAnalysisResponse | null>(null);
  const [editedChanges, setEditedChanges] = useState<ChangeItem[]>([]);
  const [proposalTitle, setProposalTitle] = useState('Scope Expansion Order #1');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState<{ share_token: string; share_url: string; totals: any; status?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [proposalConflict, setProposalConflict] = useState<{ message: string; token?: string } | null>(null);

  useEffect(() => {
    getProjects().then((data) => {
      setProjects(data);
      if (!selectedProjectId && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      getProject(selectedProjectId)
        .then(setProjectDetail)
        .catch(() => setProjectDetail(null));
      setAnalysisResult(null);
      setGeneratedProposal(null);
      setProposalConflict(null);
    }
  }, [selectedProjectId]);

  const handleAnalyze = async () => {
    if (!selectedProjectId) {
      setErrorMsg('Please select a project with an active baseline scope.');
      return;
    }
    if (!clientMessage.trim()) {
      setErrorMsg('Please enter or select a client message.');
      return;
    }

    setErrorMsg(null);
    setIsAnalyzing(true);
    setGeneratedProposal(null);
    setProposalConflict(null);

    try {
      const res = await analyzeChange(selectedProjectId, clientMessage);
      setAnalysisResult(res);
      setEditedChanges(res.changes);
      setIsAnalyzing(false);
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMsg(err.message || 'Failed to analyze scope creep with local AI.');
    }
  };

  const handleUpdateChangeHours = (idx: number, hours: number) => {
    const updated = [...editedChanges];
    updated[idx] = { ...updated[idx], estimated_hours: Math.max(0, hours) };
    setEditedChanges(updated);
  };

  const currentRate = projectDetail?.project.hourly_rate || 140;
  const baselineCost = projectDetail?.baseline?.total_baseline_price || 0;
  const baselineHours = projectDetail?.baseline?.total_estimated_hours || 0;

  const totalAdditionalHours = editedChanges.reduce((acc, c) => acc + (Number(c.estimated_hours) || 0), 0);
  const totalAdditionalCost = Math.round(totalAdditionalHours * currentRate * 100) / 100;
  const revisedTotalCost = Math.round((baselineCost + totalAdditionalCost) * 100) / 100;

  const handleCreateProposal = async () => {
    if (!selectedProjectId || editedChanges.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setProposalConflict(null);

    try {
      const res = await createChangeRequest(selectedProjectId, {
        title: proposalTitle,
        client_message: clientMessage,
        ai_analysis: analysisResult?.summary || 'Additional scope requested outside baseline contract.',
        items: editedChanges,
        hourly_rate: currentRate,
      });

      setGeneratedProposal(res);
      setIsGenerating(false);
    } catch (err: any) {
      setIsGenerating(false);
      if (err.status === 409 || (err.message && (err.message.includes('already exists') || err.message.includes('Duplicate proposal')))) {
        const tokenMatch = err.message.match(/token:\s*([A-Za-z0-9_-]+)/i);
        setProposalConflict({
          message: err.message,
          token: tokenMatch ? tokenMatch[1] : undefined,
        });
      } else {
        setErrorMsg(err.message || 'Failed to generate proposal.');
      }
    }
  };

  const copyToClipboard = () => {
    if (!generatedProposal) return;
    const fullUrl = `${window.location.origin}/proposals/${generatedProposal.share_token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const baselineRequirements = projectDetail?.items.filter(i => i.category === 'requirement') || [];
  const baselineExclusions = projectDetail?.items.filter(i => i.category === 'exclusion') || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* View Header */}
      <div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#C4B5FD] uppercase tracking-wider mb-1">
          <GitPullRequest className="w-3.5 h-3.5" />
          Boundary Defense Engine
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F7F8FA]">
          Scope Creep Detector & Change Order Generator
        </h1>
        <p className="text-[#9BA3B5] text-xs sm:text-sm mt-1 max-w-2xl">
          Compare new client messages, change requests, or feature additions against your agreed baseline. Kivo identifies out-of-scope tasks and calculates exact billable impact.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs sm:text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Select Project & Message Input */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Target Project Baseline & Comparison Context */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-[#F7F8FA] uppercase tracking-wider text-[11px] text-[#A3ACBF]">
              Target Scope Baseline
            </h2>

            <div>
              <label className="block text-xs font-medium text-[#9BA3B5] mb-1">Select Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.client_name})
                  </option>
                ))}
              </select>
            </div>

            {projectDetail && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[#181C28] border border-[#232838] space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[#9BA3B5]">
                    <span>Client Entity:</span>
                    <strong className="text-[#F7F8FA] truncate max-w-[150px]">{projectDetail.project.client_name}</strong>
                  </div>
                  <div className="flex justify-between items-center text-[#9BA3B5]">
                    <span>Billable Rate:</span>
                    <span className="font-mono text-[#F7F8FA]">{formatRate(projectDetail.project.hourly_rate)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#9BA3B5]">
                    <span>Agreed Baseline:</span>
                    <span className="font-mono text-[#8B5CF6]">
                      {formatHours(baselineHours)} ({formatCurrency(baselineCost)})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[#9BA3B5]">
                    <span>Deliverables:</span>
                    <span className="font-mono text-[#F7F8FA]">{baselineRequirements.length} agreed items</span>
                  </div>
                </div>

                {/* Collapsible Agreed Scope Deliverables for Quick Comparison */}
                <div className="p-3 rounded-lg bg-[#181C28] border border-[#232838] space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowBaselineItems(!showBaselineItems)}
                    className="w-full flex items-center justify-between text-[11px] font-semibold text-[#A3ACBF] hover:text-[#F7F8FA] transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#8B5CF6]" />
                      <span>Agreed Scope Checklist ({baselineRequirements.length})</span>
                    </span>
                    {showBaselineItems ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showBaselineItems && (
                    <div className="pt-2 border-t border-[#232838] space-y-2 text-[11px]">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono text-[#6E778B] block">Deliverables:</span>
                        {baselineRequirements.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[#F7F8FA]">
                            <span className="truncate max-w-[170px]">• {it.title}</span>
                            <span className="text-[#6E778B] font-mono">{it.suggested_hours}h</span>
                          </div>
                        ))}
                      </div>

                      {baselineExclusions.length > 0 && (
                        <div className="pt-1.5 border-t border-[#232838] space-y-1">
                          <span className="text-[10px] uppercase font-mono text-amber-400 block">Exclusions:</span>
                          {baselineExclusions.map((ex, idx) => (
                            <span key={idx} className="text-[#9BA3B5] block truncate">✕ {ex.title}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Preload Client Messages */}
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-3 shadow-sm">
            <span className="text-[11px] font-semibold text-[#A3ACBF] uppercase tracking-wider block">
              Load Sample Client Addition
            </span>
            <div className="space-y-2">
              {SAMPLE_CLIENT_MESSAGES.map((msg, idx) => (
                <button
                  key={idx}
                  onClick={() => setClientMessage(msg)}
                  className="w-full text-left p-2.5 rounded-lg bg-[#181C28] hover:bg-[#202534] border border-[#232838] text-xs text-[#9BA3B5] hover:text-[#F7F8FA] transition-colors leading-relaxed"
                >
                  "{msg.slice(0, 80)}..."
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: New Client Message */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-4 flex flex-col h-full shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-[#F7F8FA]">
                Incoming Client Request (Email, Slack, or Chat Message)
              </label>
              <span className="text-[11px] font-mono text-[#6E778B]">
                {clientMessage.length} characters
              </span>
            </div>

            <textarea
              rows={8}
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              className="w-full flex-1 bg-[#0E1017] border border-[#232838] rounded-lg p-4 text-xs sm:text-sm text-[#F7F8FA] font-mono leading-relaxed focus:outline-none focus:border-[#8B5CF6]"
              placeholder="Paste new client request or scope change message here..."
            />

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-[11px] text-[#6E778B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                Directly compared against agreed SQLite baseline scope.
              </span>

              <button
                disabled={isAnalyzing}
                onClick={handleAnalyze}
                className="px-5 py-2.5 rounded-lg bg-[#8B5CF6] text-white font-bold text-xs sm:text-sm hover:bg-[#9D72FF] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Comparing with Baseline...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Scope Delta with Local AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delta Results Board */}
      {editedChanges.length > 0 && (
        <div className="space-y-6 pt-4 border-t border-[#232838]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#8B5CF6] uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Scope Delta Identified
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F7F8FA] mt-1">
                Detected Out-of-Scope Additions
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {editedChanges.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#12151E] border border-[#232838] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-[#6E778B]">
                      Delta #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const updated = [...editedChanges];
                        updated[idx].title = e.target.value;
                        setEditedChanges(updated);
                      }}
                      className="bg-transparent font-medium text-xs sm:text-sm text-[#F7F8FA] focus:outline-none focus:border-b border-[#8B5CF6] flex-1"
                    />
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/50">
                      {item.impact_type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#9BA3B5] leading-relaxed">
                    <strong className="text-[#6E778B]">Why Out-of-Scope: </strong>
                    {item.reasoning}
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-[#181C28] border border-[#232838] px-3 py-1.5 rounded-lg self-end md:self-center">
                  <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-[#6E778B]">Effort:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={item.estimated_hours}
                      onChange={(e) => handleUpdateChangeHours(idx, Number(e.target.value))}
                      className="w-14 bg-[#0E1017] border border-[#232838] rounded px-1.5 py-0.5 text-xs text-[#F7F8FA] font-mono text-center focus:outline-none focus:border-[#8B5CF6]"
                    />
                    <span className="text-[11px] text-[#A3ACBF]">hrs</span>
                  </div>
                  <div className="text-[11px] text-[#8B5CF6] font-mono font-medium whitespace-nowrap">
                    (+{formatCurrency(Math.round(item.estimated_hours * currentRate))})
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Panel & Proposal Generator */}
          <div className="bg-[#12151E] border border-[#8B5CF6]/40 rounded-xl p-6 space-y-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <span className="text-[11px] font-mono text-[#8B5CF6] uppercase tracking-wider block">
                  Additional Billable Scope Impact
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-[#F7F8FA] mt-1 font-mono flex items-baseline gap-2">
                  <span>+{formatCurrency(totalAdditionalCost)} USD</span>
                  <span className="text-xs font-normal text-[#9BA3B5]">
                    ({formatHours(totalAdditionalHours)} additional effort @ {formatRate(currentRate)})
                  </span>
                </div>
                <div className="text-xs text-[#6E778B] font-mono mt-1">
                  Baseline: <strong>{formatCurrency(baselineCost)}</strong> → Revised Project Total: <strong className="text-[#F7F8FA]">{formatCurrency(revisedTotalCost)} USD</strong>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  className="bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
                  placeholder="Proposal Title"
                />

                <button
                  disabled={isGenerating}
                  onClick={handleCreateProposal}
                  className="px-5 py-2.5 rounded-lg bg-[#8B5CF6] text-white font-bold text-xs sm:text-sm hover:bg-[#9D72FF] transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-sm disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Link...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Change Proposal</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 409 Conflict Banner */}
            {proposalConflict && (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-amber-200">
                      Proposal Generation Blocked: Approved Order Already Exists
                    </h4>
                    <p className="text-xs text-amber-300/80 leading-relaxed">
                      {proposalConflict.message}
                    </p>
                  </div>
                </div>
                {proposalConflict.token && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onOpenProposalDemo(proposalConflict.token!)}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Approved Change Order</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Generated Proposal Share Drawer */}
            {generatedProposal && (
              <div className="p-4 rounded-xl bg-[#181C28] border border-[#8B5CF6]/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#8B5CF6] font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {generatedProposal.status === 'reused_pending'
                        ? 'Active Pending Proposal Reused (No Duplicate Created)'
                        : 'Customer Review Proposal Ready & Persisted'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#6E778B]">Token: {generatedProposal.share_token}</span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/proposals/${generatedProposal.share_token}`}
                    className="flex-1 bg-[#0E1017] border border-[#232838] rounded-lg px-3 py-2 text-xs font-mono text-[#F7F8FA] select-all"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-3.5 py-2 rounded-lg bg-[#232838] hover:bg-[#2F364B] text-xs font-medium text-[#F7F8FA] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <button
                    onClick={() => onOpenProposalDemo(generatedProposal.share_token)}
                    className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-white font-bold text-xs hover:bg-[#9D72FF] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Customer Page</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
