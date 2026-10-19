import React, { useState } from 'react';
import {
  Sparkles, CheckCircle2, Clock, ShieldAlert,
  HelpCircle, Trash2, Plus, ArrowRight, Loader2, RefreshCw, Cpu, Lock
} from 'lucide-react';
import { SAMPLE_BRIEFS } from '../data/sampleBriefs';
import type { SampleBrief } from '../data/sampleBriefs';
import { extractScope, createProject, saveBaseline } from '../api/client';
import { formatCurrency, formatRate, formatHours } from '../utils/currency';
import type { ScopeExtractionItem, ScopeAssumption, ScopeExclusion, ScopeClarification, ScopeItem, Complexity } from '../types';

interface ScopeIntakeViewProps {
  onScopeSaved: (projectId: string) => void;
}

export const ScopeIntakeView: React.FC<ScopeIntakeViewProps> = ({ onScopeSaved }) => {
  const [selectedSampleTitle, setSelectedSampleTitle] = useState<string>(SAMPLE_BRIEFS[0].title);
  const [projectName, setProjectName] = useState('AeroPay Consumer App');
  const [clientName, setClientName] = useState('Aero Financial Inc.');
  const [clientEmail, setClientEmail] = useState('sarah@aeropay.io');
  const [hourlyRate, setHourlyRate] = useState<number>(140);
  const [briefText, setBriefText] = useState(SAMPLE_BRIEFS[0].brief);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractStep, setExtractStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extracted scope state
  const [summary, setSummary] = useState<string>('');
  const [requirements, setRequirements] = useState<ScopeExtractionItem[]>([]);
  const [assumptions, setAssumptions] = useState<ScopeAssumption[]>([]);
  const [exclusions, setExclusions] = useState<ScopeExclusion[]>([]);
  const [clarifications, setClarifications] = useState<ScopeClarification[]>([]);
  const [extractionSource, setExtractionSource] = useState<'ollama_qwen25_3b' | 'local_fallback' | null>(null);

  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleLoadSample = (sample: SampleBrief) => {
    setSelectedSampleTitle(sample.title);
    setProjectName(sample.projectName);
    setClientName(sample.clientName);
    setHourlyRate(sample.hourlyRate);
    setBriefText(sample.brief);
  };

  const handleExtract = async () => {
    if (!briefText.trim()) {
      setErrorMsg('Please paste a client brief or select a sample brief first.');
      return;
    }

    setErrorMsg(null);
    setIsExtracting(true);
    setExtractStep('Connecting to local Ollama (Qwen2.5 3B)...');

    const stepTimer1 = setTimeout(() => setExtractStep('Parsing functional deliverables & estimating effort hours...'), 1200);
    const stepTimer2 = setTimeout(() => setExtractStep('Extracting operational assumptions, exclusions & clarifications...'), 2600);
    const stepTimer3 = setTimeout(() => setExtractStep('Computing deterministic pricing bands...'), 4200);

    try {
      const result = await extractScope(briefText, hourlyRate);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      setSummary(result.summary);
      setRequirements(result.requirements);
      setAssumptions(result.assumptions);
      setExclusions(result.exclusions);
      setClarifications(result.clarifications);
      setExtractionSource(result.extraction_source || 'ollama_qwen25_3b');
      setIsExtracting(false);
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setIsExtracting(false);
      setErrorMsg(err.message || 'Failed to extract scope. Ensure local Ollama is running.');
    }
  };

  // Live deterministic pricing calculation based on user edits
  const totalSuggestedHours = requirements.reduce((acc, curr) => acc + (Number(curr.suggested_hours) || 0), 0);
  const totalMinHours = requirements.reduce((acc, curr) => acc + (Number(curr.estimated_hours_min) || 0), 0);
  const totalMaxHours = requirements.reduce((acc, curr) => acc + (Number(curr.estimated_hours_max) || 0), 0);

  const projectedPrice = Math.round(totalSuggestedHours * hourlyRate * 100) / 100;
  const minPrice = Math.round(totalMinHours * hourlyRate * 100) / 100;
  const maxPrice = Math.round(totalMaxHours * hourlyRate * 100) / 100;

  // Requirement handlers
  const handleUpdateRequirement = (
    index: number,
    field: keyof ScopeExtractionItem,
    val: any
  ) => {
    const updated = [...requirements];
    updated[index] = { ...updated[index], [field]: val };
    setRequirements(updated);
  };

  const handleDeleteRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const handleAddRequirement = () => {
    setRequirements([
      ...requirements,
      {
        title: 'New Scoped Deliverable',
        description: 'Provide detailed functional specs for this deliverable...',
        complexity: 'medium',
        estimated_hours_min: 4,
        estimated_hours_max: 8,
        suggested_hours: 6,
        provenance: 'explicit',
      },
    ]);
  };

  // Assumption handlers
  const handleUpdateAssumption = (index: number, field: keyof ScopeAssumption, val: string) => {
    const updated = [...assumptions];
    updated[index] = { ...updated[index], [field]: val };
    setAssumptions(updated);
  };

  const handleDeleteAssumption = (index: number) => {
    setAssumptions(assumptions.filter((_, i) => i !== index));
  };

  const handleAddAssumption = () => {
    setAssumptions([
      ...assumptions,
      {
        title: 'New Technical Assumption',
        description: 'e.g. Client provides API keys and sandbox environment prior to sprint kick-off.',
      },
    ]);
  };

  // Exclusion handlers
  const handleUpdateExclusion = (index: number, field: keyof ScopeExclusion, val: string) => {
    const updated = [...exclusions];
    updated[index] = { ...updated[index], [field]: val };
    setExclusions(updated);
  };

  const handleDeleteExclusion = (index: number) => {
    setExclusions(exclusions.filter((_, i) => i !== index));
  };

  const handleAddExclusion = () => {
    setExclusions([
      ...exclusions,
      {
        title: 'New Out-of-Scope Boundary',
        description: 'e.g. Ongoing 24/7 post-launch maintenance, copywriting, or translations.',
      },
    ]);
  };

  // Clarification handlers
  const handleUpdateClarification = (index: number, field: keyof ScopeClarification, val: string) => {
    const updated = [...clarifications];
    updated[index] = { ...updated[index], [field]: val };
    setClarifications(updated);
  };

  const handleDeleteClarification = (index: number) => {
    setClarifications(clarifications.filter((_, i) => i !== index));
  };

  const handleAddClarification = () => {
    setClarifications([
      ...clarifications,
      {
        question: 'Pending question for client?',
        reason: 'Impact on architectural decision, pricing band, or schedule.',
      },
    ]);
  };

  const handleSaveBaseline = async () => {
    if (!projectName.trim()) {
      setErrorMsg('Please specify a Project Name.');
      return;
    }
    if (!clientName.trim()) {
      setErrorMsg('Please specify a Client / Entity Name.');
      return;
    }
    if (requirements.length === 0) {
      setErrorMsg('Please include at least one deliverable before locking baseline scope.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      // 1. Create project in SQLite
      const proj = await createProject({
        name: projectName,
        client_name: clientName,
        client_email: clientEmail,
        hourly_rate: hourlyRate,
        currency: 'USD',
      });

      // 2. Format all items for baseline persistence
      const itemsToSave: ScopeItem[] = [
        ...requirements.map((r, i) => ({
          category: 'requirement' as const,
          title: r.title,
          description: r.description,
          complexity: r.complexity,
          estimated_hours_min: Number(r.estimated_hours_min) || 0,
          estimated_hours_max: Number(r.estimated_hours_max) || 0,
          suggested_hours: Number(r.suggested_hours) || 0,
          order_index: i,
          provenance: r.provenance || 'explicit',
        })),
        ...assumptions.map((a, i) => ({
          category: 'assumption' as const,
          title: a.title,
          description: a.description,
          complexity: 'low' as const,
          estimated_hours_min: 0,
          estimated_hours_max: 0,
          suggested_hours: 0,
          order_index: i + 100,
        })),
        ...exclusions.map((e, i) => ({
          category: 'exclusion' as const,
          title: e.title,
          description: e.description,
          complexity: 'low' as const,
          estimated_hours_min: 0,
          estimated_hours_max: 0,
          suggested_hours: 0,
          order_index: i + 200,
        })),
        ...clarifications.map((c, i) => ({
          category: 'clarification' as const,
          title: c.question,
          description: c.reason,
          complexity: 'medium' as const,
          estimated_hours_min: 0,
          estimated_hours_max: 0,
          suggested_hours: 0,
          order_index: i + 300,
        })),
      ];

      // 3. Save baseline to SQLite
      await saveBaseline(proj.id, {
        raw_brief: briefText,
        summary: summary || `Agreed baseline scope for ${projectName}`,
        items: itemsToSave,
        hourly_rate: hourlyRate,
      });

      setIsSaving(false);
      setIsSavedSuccess(true);
      setTimeout(() => {
        onScopeSaved(proj.id);
      }, 700);
    } catch (err: any) {
      setIsSaving(false);
      setErrorMsg(err.message || 'Failed to save baseline scope to local database.');
    }
  };

  const suggestedCount = requirements.filter(r => r.provenance === 'suggested').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* View Header */}
      <div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#C4B5FD] uppercase tracking-wider mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          Intelligent Scope Deconstruction
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F7F8FA]">
          Turn Client Briefs into Defensible Scopes
        </h1>
        <p className="text-[#9BA3B5] text-xs sm:text-sm mt-1 max-w-2xl">
          Paste ambiguous client notes, chat logs, or RFP requirements. Kivo uses local AI to extract discrete deliverables, highlight unstated assumptions, flag out-of-scope boundaries, and deterministically price the engagement.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs sm:text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metadata & Parameters */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-[#F7F8FA] uppercase tracking-wider text-[11px] text-[#A3ACBF]">
              Engagement Parameters
            </h2>

            <div>
              <label className="block text-xs font-medium text-[#9BA3B5] mb-1">Project Name *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
                placeholder="e.g. Acme Consumer MVP"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9BA3B5] mb-1">Client Entity / Contact *</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
                placeholder="e.g. Apex Financial Labs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9BA3B5] mb-1">Client Contact Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full bg-[#181C28] border border-[#232838] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6]"
                placeholder="sarah@apexfinance.io"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9BA3B5] mb-1">
                Billable Rate ($ / hr)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[#6E778B] text-xs sm:text-sm">$</span>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-full bg-[#181C28] border border-[#232838] rounded-lg pl-7 pr-3 py-2 text-xs sm:text-sm text-[#F7F8FA] font-mono focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              <p className="text-[11px] text-[#6E778B] mt-1">Deterministic calculations use this exact rate.</p>
            </div>
          </div>

          {/* Quick Preload Sample Briefs */}
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-3 shadow-sm">
            <span className="text-[11px] font-semibold text-[#A3ACBF] uppercase tracking-wider block">
              Load Sample Client Brief
            </span>
            <div className="space-y-2">
              {SAMPLE_BRIEFS.map((s, idx) => {
                const isSelected = selectedSampleTitle === s.title;
                return (
                  <button
                    key={idx}
                    onClick={() => handleLoadSample(s)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-[#1C202E] border-[#8B5CF6]/50 text-[#F7F8FA]'
                        : 'bg-[#181C28] hover:bg-[#202534] border-[#232838] text-[#9BA3B5]'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className={`font-semibold block ${isSelected ? 'text-[#8B5CF6]' : 'text-[#F7F8FA]'}`}>
                        {s.title}
                      </span>
                      <span className="text-[10px] text-[#6E778B] block truncate max-w-[170px]">{s.clientName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#A3ACBF] px-2 py-0.5 rounded bg-[#12151E] border border-[#232838]">
                      {formatRate(s.hourlyRate)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Brief Textarea & Deconstruct CTA */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-4 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-[#F7F8FA]">
                Raw Client Brief or Communication
              </label>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#6E778B]">
                <span>{briefText.trim().split(/\s+/).filter(Boolean).length} words</span>
                <span>•</span>
                <span>{briefText.length} chars</span>
              </div>
            </div>

            <textarea
              rows={12}
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              className="w-full flex-1 bg-[#0E1017] border border-[#232838] rounded-lg p-4 text-xs sm:text-sm text-[#F7F8FA] font-mono leading-relaxed focus:outline-none focus:border-[#8B5CF6] resize-y"
              placeholder="Paste email thread, RFP specifications, or raw meeting notes here..."
            />

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-[11px] text-[#6E778B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                Inference runs locally via Ollama (Qwen2.5 3B). Zero cloud egress.
              </span>

              <button
                disabled={isExtracting}
                onClick={handleExtract}
                className="px-5 py-2.5 rounded-lg bg-[#8B5CF6] text-white font-bold text-xs sm:text-sm hover:bg-[#9D72FF] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Brief...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Deconstruct Scope with Local AI</span>
                  </>
                )}
              </button>
            </div>

            {isExtracting && (
              <div className="p-3 bg-[#181C28] border border-[#232838] rounded-lg flex items-center gap-3 text-xs text-[#A3ACBF]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8B5CF6] shrink-0" />
                <span>{extractStep}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extracted Scope Review Board */}
      {(requirements.length > 0 || summary) && (
        <div className="space-y-6 pt-4 border-t border-[#232838]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#8B5CF6] uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Structured Scope Draft (Editable Prior to Baseline Lock)
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F7F8FA]">
                  Agreed Scope & Deliverables
                </h2>
                {extractionSource === 'ollama_qwen25_3b' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#171923] text-[#C4B5FD] border border-[#8B5CF6]/30 text-[11px] font-mono">
                    <Cpu className="w-3 h-3 text-[#8B5CF6]" />
                    Local Qwen2.5 3B Verified
                  </span>
                )}
                {extractionSource === 'local_fallback' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/40 text-amber-300 border border-amber-800/50 text-[11px] font-mono">
                    Heuristic Fallback
                  </span>
                )}
              </div>
            </div>

            <button
              disabled={isSaving || isSavedSuccess}
              onClick={handleSaveBaseline}
              className="px-6 py-2.5 rounded-lg bg-[#8B5CF6] text-white font-bold text-xs sm:text-sm hover:bg-[#9D72FF] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to SQLite...</span>
                </>
              ) : isSavedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Baseline Scope Locked!</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Lock & Save Agreed Baseline Scope</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Scope Overview Card */}
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-2">
            <span className="text-[10px] font-mono text-[#A3ACBF] uppercase tracking-wider block">
              Executive Summary (Editable)
            </span>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full bg-[#181C28] border border-[#232838] rounded-lg p-3 text-xs sm:text-sm text-[#F7F8FA] leading-relaxed focus:outline-none focus:border-[#8B5CF6]"
              placeholder="High-level summary of baseline engagement..."
            />
          </div>

          {/* Provenance Alert for AI Suggestions */}
          {suggestedCount > 0 && (
            <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/40 text-purple-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  <strong>Requirement Provenance Notice:</strong> {suggestedCount} deliverable(s) are AI-inferred suggestions rather than explicitly requested in the client brief. Review each item before locking baseline.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setRequirements(requirements.map(r => ({ ...r, provenance: 'explicit' })))}
                  className="px-2.5 py-1 rounded bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/50 text-[11px] font-medium text-purple-200 transition-colors"
                >
                  Accept All as Explicit
                </button>
                <button
                  type="button"
                  onClick={() => setRequirements(requirements.filter(r => r.provenance !== 'suggested'))}
                  className="px-2.5 py-1 rounded bg-[#181C28] hover:bg-rose-950/40 hover:text-rose-300 border border-[#232838] text-[11px] font-medium text-[#A3ACBF] transition-colors"
                >
                  Remove All Suggestions
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Discrete Requirements (Billable) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-[#F7F8FA]">
                  1. Discrete Deliverables & Effort Estimates
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#181C28] text-[#8B5CF6] border border-[#232838] font-mono">
                  {requirements.length} Items • {formatHours(totalSuggestedHours)}
                </span>
              </div>
              <button
                onClick={handleAddRequirement}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#181C28] hover:bg-[#232838] border border-[#232838] text-[#8B5CF6] transition-colors flex items-center gap-1.5 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Deliverable
              </button>
            </div>

            {requirements.length === 0 ? (
              <div className="bg-[#12151E] border border-dashed border-[#232838] rounded-xl p-8 text-center space-y-2">
                <Clock className="w-6 h-6 text-[#6E778B] mx-auto" />
                <p className="text-xs sm:text-sm text-[#9BA3B5]">No deliverables currently listed.</p>
                <button
                  onClick={handleAddRequirement}
                  className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Deliverable
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {requirements.map((req, idx) => (
                  <div
                    key={idx}
                    className="bg-[#12151E] border border-[#232838] hover:border-[#333A4E] transition-all rounded-xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-[#6E778B]">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          value={req.title}
                          onChange={(e) => handleUpdateRequirement(idx, 'title', e.target.value)}
                          className="bg-[#181C28] border border-[#232838] rounded px-2.5 py-1 font-medium text-xs sm:text-sm text-[#F7F8FA] focus:outline-none focus:border-[#8B5CF6] flex-1"
                          placeholder="Deliverable title..."
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateRequirement(
                            idx,
                            'provenance',
                            (req.provenance || 'explicit') === 'suggested' ? 'explicit' : 'suggested'
                          )}
                          className={`text-[10px] uppercase font-mono px-2 py-1 rounded border transition-colors flex items-center gap-1.5 shrink-0 ${
                            req.provenance === 'suggested'
                              ? 'bg-purple-950/60 text-purple-300 border-purple-500/50 hover:bg-purple-900/80'
                              : 'bg-blue-950/60 text-blue-300 border-blue-500/50 hover:bg-blue-900/80'
                          }`}
                          title="Click to toggle between Client Explicit and AI Suggested"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${req.provenance === 'suggested' ? 'bg-purple-400' : 'bg-blue-400'}`} />
                          <span>{req.provenance === 'suggested' ? 'AI Suggested' : 'Client Explicit'}</span>
                        </button>
                        <select
                          value={req.complexity}
                          onChange={(e) => handleUpdateRequirement(idx, 'complexity', e.target.value as Complexity)}
                          className={`text-xs font-mono px-2 py-1 rounded border bg-[#181C28] focus:outline-none focus:border-[#8B5CF6] ${
                            req.complexity === 'high'
                              ? 'text-rose-300 border-rose-800/50'
                              : req.complexity === 'medium'
                              ? 'text-amber-300 border-amber-800/50'
                              : 'text-emerald-300 border-emerald-800/50'
                          }`}
                        >
                          <option value="low">LOW</option>
                          <option value="medium">MEDIUM</option>
                          <option value="high">HIGH</option>
                        </select>
                      </div>
                      <textarea
                        rows={2}
                        value={req.description}
                        onChange={(e) => handleUpdateRequirement(idx, 'description', e.target.value)}
                        className="w-full bg-[#181C28] border border-[#232838] text-xs text-[#9BA3B5] leading-relaxed focus:outline-none focus:border-[#8B5CF6] p-2 rounded"
                        placeholder="Detailed deliverable specifications..."
                      />
                    </div>

                    {/* Hours inputs & actions */}
                    <div className="flex items-center gap-3 self-end md:self-center">
                      <div className="flex items-center gap-2 bg-[#181C28] border border-[#232838] px-3 py-1.5 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-[#6E778B]">Target:</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={req.suggested_hours}
                            onChange={(e) => handleUpdateRequirement(idx, 'suggested_hours', Number(e.target.value))}
                            className="w-14 bg-[#0E1017] border border-[#232838] rounded px-1.5 py-0.5 text-xs text-[#F7F8FA] font-mono text-center focus:outline-none focus:border-[#8B5CF6]"
                          />
                          <span className="text-[11px] text-[#A3ACBF]">hrs</span>
                        </div>
                        <div className="text-[11px] text-[#8B5CF6] font-mono whitespace-nowrap">
                          ({formatCurrency(Math.round(req.suggested_hours * hourlyRate))})
                        </div>
                      </div>

                      <div className="hidden lg:flex items-center gap-1 text-[11px] text-[#6E778B] font-mono">
                        <span>[</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={req.estimated_hours_min}
                          onChange={(e) => handleUpdateRequirement(idx, 'estimated_hours_min', Number(e.target.value))}
                          className="w-10 bg-[#0E1017] border border-[#232838] rounded px-1 py-0.5 text-xs text-center text-[#A3ACBF]"
                          title="Min hours"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={req.estimated_hours_max}
                          onChange={(e) => handleUpdateRequirement(idx, 'estimated_hours_max', Number(e.target.value))}
                          className="w-10 bg-[#0E1017] border border-[#232838] rounded px-1 py-0.5 text-xs text-center text-[#A3ACBF]"
                          title="Max hours"
                        />
                        <span>h]</span>
                      </div>

                      <button
                        onClick={() => handleDeleteRequirement(idx)}
                        className="p-1.5 rounded-md text-[#6E778B] hover:text-rose-400 hover:bg-[#181C28] transition-colors"
                        title="Remove deliverable"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Bands Summary */}
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono text-[#8B5CF6] uppercase tracking-wider block">
                  Projected Baseline Engagement Value
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-[#F7F8FA] font-mono mt-1">
                  {formatCurrency(projectedPrice)} USD
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-[#9BA3B5] font-mono space-y-0.5">
                <div>Suggested Effort: <strong className="text-[#F7F8FA]">{formatHours(totalSuggestedHours)}</strong></div>
                <div>Billing Range: <strong className="text-[#A3ACBF]">{formatHours(totalMinHours)} - {formatHours(totalMaxHours)}</strong> ({formatCurrency(minPrice)} - {formatCurrency(maxPrice)})</div>
                <div>Rate Applied: <strong className="text-[#8B5CF6]">{formatRate(hourlyRate)}</strong></div>
              </div>
            </div>
            <div className="pt-3 border-t border-[#232838] text-[11px] text-[#6E778B] leading-relaxed flex items-start gap-2">
              <span className="font-semibold text-[#A3ACBF] shrink-0">Legal Notice:</span>
              <span>Non-binding estimate only. Not a legally binding contract or guaranteed delivery timeline.</span>
            </div>
          </div>

          {/* Section 2: Technical Assumptions & Boundaries (Exclusions) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Operational Assumptions */}
            <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <h3 className="text-xs sm:text-sm font-semibold text-[#F7F8FA]">
                    Operational Assumptions ({assumptions.length})
                  </h3>
                </div>
                <button
                  onClick={handleAddAssumption}
                  className="text-xs text-[#A3ACBF] hover:text-[#F7F8FA] flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <div className="space-y-2">
                {assumptions.map((assump, idx) => (
                  <div key={idx} className="p-3 bg-[#181C28] border border-[#232838] rounded-lg space-y-1 group">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={assump.title}
                        onChange={(e) => handleUpdateAssumption(idx, 'title', e.target.value)}
                        className="bg-transparent font-medium text-xs text-[#F7F8FA] focus:outline-none focus:border-b border-[#8B5CF6] flex-1"
                      />
                      <button
                        onClick={() => handleDeleteAssumption(idx)}
                        className="text-[#6E778B] hover:text-rose-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={assump.description}
                      onChange={(e) => handleUpdateAssumption(idx, 'description', e.target.value)}
                      className="w-full bg-transparent text-[11px] text-[#9BA3B5] leading-relaxed focus:outline-none focus:border-b border-[#8B5CF6]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Out-of-Scope Boundaries */}
            <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs sm:text-sm font-semibold text-[#F7F8FA]">
                    Out-of-Scope Boundaries ({exclusions.length})
                  </h3>
                </div>
                <button
                  onClick={handleAddExclusion}
                  className="text-xs text-[#A3ACBF] hover:text-[#F7F8FA] flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <div className="space-y-2">
                {exclusions.map((excl, idx) => (
                  <div key={idx} className="p-3 bg-[#181C28] border border-amber-900/30 rounded-lg space-y-1 group">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={excl.title}
                        onChange={(e) => handleUpdateExclusion(idx, 'title', e.target.value)}
                        className="bg-transparent font-medium text-xs text-amber-200 focus:outline-none focus:border-b border-[#8B5CF6] flex-1"
                      />
                      <button
                        onClick={() => handleDeleteExclusion(idx)}
                        className="text-[#6E778B] hover:text-rose-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={excl.description}
                      onChange={(e) => handleUpdateExclusion(idx, 'description', e.target.value)}
                      className="w-full bg-transparent text-[11px] text-[#9BA3B5] leading-relaxed focus:outline-none focus:border-b border-[#8B5CF6]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Clarifications */}
          <div className="bg-[#12151E] border border-[#232838] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#8B5CF6]" />
                <h3 className="text-xs sm:text-sm font-semibold text-[#F7F8FA]">
                  Clarification Questions ({clarifications.length})
                </h3>
              </div>
              <button
                onClick={handleAddClarification}
                className="text-xs text-[#A3ACBF] hover:text-[#F7F8FA] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clarifications.map((clar, idx) => (
                <div key={idx} className="p-3 bg-[#181C28] border border-[#232838] rounded-lg space-y-1 group">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={clar.question}
                      onChange={(e) => handleUpdateClarification(idx, 'question', e.target.value)}
                      className="bg-transparent font-medium text-xs text-[#F7F8FA] focus:outline-none focus:border-b border-[#8B5CF6] flex-1"
                      placeholder="Pending question..."
                    />
                    <button
                      onClick={() => handleDeleteClarification(idx)}
                      className="text-[#6E778B] hover:text-rose-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={clar.reason}
                    onChange={(e) => handleUpdateClarification(idx, 'reason', e.target.value)}
                    className="w-full bg-transparent text-[11px] text-[#6E778B] focus:outline-none focus:border-b border-[#8B5CF6]"
                    placeholder="Impact on scope or pricing..."
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
