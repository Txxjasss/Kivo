import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, ShieldAlert,
  ArrowLeft, AlertCircle, Loader2,
  XCircle, Calendar, MessageSquare
} from 'lucide-react';
import { getProposal, actOnProposal, getProjects } from '../api/client';
import { formatCurrency, formatRate, formatHours } from '../utils/currency';
import { Lock, ChevronDown, ChevronUp } from 'lucide-react';

interface ProposalReviewViewProps {
  token?: string;
  onBackToDashboard: () => void;
}

export const ProposalReviewView: React.FC<ProposalReviewViewProps> = ({
  token,
  onBackToDashboard,
}) => {
  const [activeToken, setActiveToken] = useState<string>(token || '');
  const [proposalData, setProposalData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [feedbackText, setFeedbackText] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showBaselineScope, setShowBaselineScope] = useState<boolean>(true);

  const loadProposal = React.useCallback(async (tok: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getProposal(tok);
      setProposalData(data);
      if (data?.proposal?.client_feedback) {
        setFeedbackText(data.proposal.client_feedback);
      }
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Proposal not found.');
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadProposal(token);
    } else {
      // Find a project with change requests to demo
      getProjects().then(async (projects) => {
        for (const p of projects) {
          const detailRes = await fetch(`/api/projects/${p.id}`);
          if (detailRes.ok) {
            const data = await detailRes.json();
            if (data.change_requests && data.change_requests.length > 0) {
              const tok = data.change_requests[0].share_token;
              setActiveToken(tok);
              loadProposal(tok);
              return;
            }
          }
        }
      });
    }
  }, [token, loadProposal]);

  const handleAction = async (action: 'approve' | 'reject' | 'feedback') => {
    if (!activeToken) return;
    setSubmittingAction(true);
    setErrorMsg(null);
    setActionSuccess(null);
    try {
      const res = await actOnProposal(activeToken, action, feedbackText);
      setProposalData({
        ...proposalData,
        proposal: {
          ...proposalData.proposal,
          status: res.new_status,
          client_feedback: feedbackText,
          client_action_at: res.updated_at,
        },
      });
      setActionSuccess(
        action === 'approve'
          ? 'Change proposal approved successfully! Added to project ledger.'
          : action === 'reject'
          ? 'Change proposal declined. Original project baseline remains unchanged.'
          : 'Feedback transmitted to freelancer.'
      );
      setSubmittingAction(false);
    } catch (err: any) {
      setSubmittingAction(false);
      setErrorMsg(err.message || 'Failed to update proposal action.');
    }
  };

  const isFinalized = proposalData?.proposal?.status === 'approved' || proposalData?.proposal?.status === 'rejected' || proposalData?.proposal?.status === 'superseded';

  const baselinePrice = Number(proposalData?.project?.total_baseline_price) || 0;
  const baselineHours = Number(proposalData?.project?.total_baseline_hours) || 0;
  const additionalCost = Number(proposalData?.proposal?.calculated_cost) || 0;
  const additionalHours = Number(proposalData?.proposal?.calculated_hours) || 0;
  const revisedTotal = baselinePrice + additionalCost;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Return to Dashboard */}
      <button
        onClick={onBackToDashboard}
        className="text-xs text-[#9BA3B5] hover:text-[#F7F8FA] flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Freelancer Dashboard</span>
      </button>

      {/* Customer Header */}
      <div className="border-b border-[#232838] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#171923] text-[#C4B5FD] border border-[#8B5CF6]/30">
            Customer Review Portal • Addendum
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F7F8FA] mt-2">
            {proposalData?.proposal?.title || 'Scope Adjustment Proposal'}
          </h1>
          <p className="text-xs sm:text-sm text-[#9BA3B5] mt-1">
            Project: <strong className="text-[#F7F8FA]">{proposalData?.project?.name || 'Client Project'}</strong> · Client Entity: <strong className="text-[#F7F8FA]">{proposalData?.project?.client_name || 'Client'}</strong>
          </p>
        </div>

        {proposalData?.proposal && (
          <div className="self-start sm:self-center">
            <span
              className={`text-xs font-mono uppercase px-3 py-1 rounded-full border ${
                proposalData.proposal.status === 'approved'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                  : proposalData.proposal.status === 'rejected'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-500/50'
                  : proposalData.proposal.status === 'superseded'
                  ? 'bg-zinc-800 text-zinc-300 border-zinc-600/50'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/50'
              }`}
            >
              Status: {proposalData.proposal.status}
            </span>
          </div>
        )}
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs sm:text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs sm:text-sm text-[#6E778B] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
          <span>Loading proposal details...</span>
        </div>
      ) : !proposalData ? (
        <div className="bg-[#12151E] border border-[#232838] rounded-xl p-8 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#6E778B] mx-auto" />
          <h3 className="text-base font-semibold text-[#F7F8FA]">No active proposal found</h3>
          <p className="text-xs text-[#9BA3B5] max-w-sm mx-auto">
            Use the Scope Creep Detector tab to generate a change proposal link first.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Persisted Decision Summary (Survives Refresh) */}
          {isFinalized && (
            <div
              className={`p-5 rounded-xl border space-y-3 ${
                proposalData.proposal.status === 'approved'
                  ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                  : proposalData.proposal.status === 'rejected'
                  ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                  : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {proposalData.proposal.status === 'approved' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : proposalData.proposal.status === 'rejected' ? (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-zinc-400 shrink-0" />
                  )}
                  <span className="font-bold text-xs sm:text-sm uppercase tracking-wide">
                    {proposalData.proposal.status === 'approved'
                      ? 'Proposal Formally Approved by Client'
                      : proposalData.proposal.status === 'rejected'
                      ? 'Proposal Declined by Client'
                      : 'Proposal Superseded (Audit Record)'}
                  </span>
                </div>
                {proposalData.proposal.client_action_at && (
                  <span className="text-[11px] font-mono text-[#A3ACBF] flex items-center gap-1.5 self-start sm:self-auto">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(proposalData.proposal.client_action_at).toLocaleString()}</span>
                  </span>
                )}
              </div>

              {proposalData.proposal.client_feedback ? (
                <div className="bg-[#0E1017]/80 border border-[#232838] rounded-lg p-3 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-[#6E778B] flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {proposalData.proposal.status === 'superseded' ? 'Audit Notes:' : 'Persisted Client Notes:'}
                  </span>
                  <p className="text-xs text-[#F7F8FA] font-mono leading-relaxed whitespace-pre-wrap">
                    "{proposalData.proposal.client_feedback}"
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#A3ACBF]">
                  No optional client notes recorded for this decision.
                </p>
              )}

              <p className="text-[11px] text-[#A3ACBF]">
                {proposalData.proposal.status === 'approved'
                  ? 'This change order is locked and added to the project ledger. Original baseline remains preserved.'
                  : proposalData.proposal.status === 'rejected'
                  ? 'This proposal was rejected. Original baseline scope and project ledger totals remain completely unchanged.'
                  : 'This proposal was superseded by a prior approved change order for the same client request. It does not affect the project ledger.'}
              </p>
            </div>
          )}

          {/* Incoming Request Reference */}
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-2">
            <span className="text-[11px] font-mono text-[#A3ACBF] uppercase tracking-wider block">
              Reference: Client Communication
            </span>
            <blockquote className="text-xs text-[#F7F8FA] bg-[#181C28] border-l-2 border-[#8B5CF6] p-3 rounded-r-lg font-mono leading-relaxed">
              "{proposalData.proposal.client_message}"
            </blockquote>
            <p className="text-xs text-[#6E778B] pt-1">
              <strong>Technical Assessment: </strong>
              {proposalData.proposal.ai_analysis}
            </p>
          </div>

          {/* 1. Original Agreed Scope Baseline (Immutable Reference) */}
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#8B5CF6]" />
                <h3 className="text-xs sm:text-sm font-semibold text-[#F7F8FA]">
                  1. Original Agreed Scope Baseline (Immutable Contract)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#181C28] text-[#C4B5FD] border border-[#232838]">
                  {formatHours(baselineHours)} • {formatCurrency(baselinePrice)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowBaselineScope(!showBaselineScope)}
                className="text-xs text-[#A3ACBF] hover:text-[#F7F8FA] flex items-center gap-1 font-medium transition-colors"
              >
                <span>{showBaselineScope ? 'Collapse' : 'View Baseline'}</span>
                {showBaselineScope ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showBaselineScope && (
              <div className="pt-2 border-t border-[#232838] space-y-2">
                {(!proposalData.baseline_items || proposalData.baseline_items.length === 0) ? (
                  <p className="text-xs text-[#6E778B] italic">
                    Agreed baseline total: {formatHours(baselineHours)} ({formatCurrency(baselinePrice)}) at {formatRate(proposalData.proposal.hourly_rate_applied)}.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {proposalData.baseline_items.map((bItem: any, bIdx: number) => (
                      <div
                        key={bIdx}
                        className="p-3 rounded-lg bg-[#181C28] border border-[#232838] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[#F7F8FA]">• {bItem.title}</span>
                            <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                              (bItem.provenance || 'explicit') === 'suggested'
                                ? 'bg-purple-950/60 text-purple-300 border-purple-500/50'
                                : 'bg-blue-950/60 text-blue-300 border-blue-500/50'
                            }`}>
                              {(bItem.provenance || 'explicit') === 'suggested' ? 'AI Suggested' : 'Client Explicit'}
                            </span>
                            <span className="text-[9px] uppercase font-mono text-[#6E778B]">
                              [{bItem.category}]
                            </span>
                          </div>
                          {bItem.description && (
                            <p className="text-[11px] text-[#9BA3B5] line-clamp-1">{bItem.description}</p>
                          )}
                        </div>
                        {bItem.suggested_hours > 0 && (
                          <span className="font-mono text-[11px] text-[#A3ACBF] shrink-0">
                            {formatHours(bItem.suggested_hours)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Newly Requested Deliverables (Change Order Scope Adjustment) */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-[#F7F8FA] flex items-center gap-2">
              <span>2. Newly Requested Deliverables (Change Order Addition)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#181C28] text-[#8B5CF6] border border-[#232838]">
                +{formatHours(additionalHours)} • +{formatCurrency(additionalCost)}
              </span>
            </h3>
            <div className="bg-[#12151E] border border-[#232838] rounded-xl overflow-hidden divide-y divide-[#232838]">
              {proposalData.items.map((it: any, idx: number) => {
                const itemCost = Math.round(Number(it.estimated_hours) * Number(proposalData.proposal.hourly_rate_applied) * 100) / 100;
                return (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-[#F7F8FA]">{it.title}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#181C28] text-[#8B5CF6] border border-[#232838] shrink-0">
                          {it.impact_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-[#9BA3B5] leading-relaxed">{it.reasoning}</p>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center font-mono text-xs pt-2 sm:pt-0 border-t sm:border-t-0 border-[#232838] shrink-0">
                      <div className="text-[#8B5CF6] font-semibold text-sm sm:text-xs font-mono">
                        +{formatCurrency(itemCost)}
                      </div>
                      <div className="text-[11px] text-[#6E778B]">
                        {formatHours(it.estimated_hours)} @ {formatRate(proposalData.proposal.hourly_rate_applied)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transparent Financial Ledger Breakdown */}
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-6 space-y-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A3ACBF] font-mono">
              Project Ledger & Agreement Reconciliation
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#181C28] border border-[#232838]">
                <span className="text-[10px] uppercase font-mono text-[#6E778B] block">1. Baseline Contract</span>
                <div className="text-lg font-bold text-[#F7F8FA] font-mono mt-0.5">
                  {formatCurrency(baselinePrice)}
                </div>
                <span className="text-[11px] text-[#9BA3B5] block font-mono">{formatHours(baselineHours)} agreed effort</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#181C28] border border-[#8B5CF6]/40">
                <span className="text-[10px] uppercase font-mono text-[#8B5CF6] block">2. Proposed Addition</span>
                <div className="text-lg font-bold text-[#8B5CF6] font-mono mt-0.5">
                  +{formatCurrency(additionalCost)}
                </div>
                <span className="text-[11px] text-[#9BA3B5] block font-mono">+{formatHours(additionalHours)} @ {formatRate(proposalData.proposal.hourly_rate_applied)}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#181C28] border border-[#232838]">
                <span className="text-[10px] uppercase font-mono text-[#A3ACBF] block">3. Revised Total</span>
                <div className="text-lg font-bold text-[#F7F8FA] font-mono mt-0.5">
                  {formatCurrency(revisedTotal)} {proposalData.project?.currency || 'USD'}
                </div>
                <span className="text-[11px] text-[#9BA3B5] block font-mono">{formatHours(baselineHours + additionalHours)} total effort</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#232838] text-[11px] text-[#6E778B] leading-relaxed flex items-start gap-2">
              <span className="font-semibold text-[#A3ACBF] shrink-0">Legal Notice:</span>
              <span>{proposalData.disclaimer || "Non-binding estimate only. Not a legally binding contract or guaranteed delivery timeline."}</span>
            </div>
          </div>

          {/* Client Action Area (Only if pending) */}
          {!isFinalized && (
            <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-4">
              <h4 className="text-xs sm:text-sm font-semibold text-[#F7F8FA]">Client Action & Feedback</h4>
              <textarea
                rows={2}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Optional notes or adjustment requests for the freelancer..."
                className="w-full bg-[#181C28] border border-[#232838] rounded-lg p-3 text-xs text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
              />
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end">
                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={() => handleAction('reject')}
                  className="px-4 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-xs font-semibold text-rose-300 transition-colors flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Decline Scope Addition</span>
                </button>
                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={() => handleAction('feedback')}
                  className="px-4 py-2 rounded-lg bg-[#181C28] hover:bg-[#232838] border border-[#232838] text-xs font-semibold text-[#F7F8FA] transition-colors flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send Clarification Request</span>
                </button>
                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={() => handleAction('approve')}
                  className="px-5 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#9D72FF] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Scope Addition</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
