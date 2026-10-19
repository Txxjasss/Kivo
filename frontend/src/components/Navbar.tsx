import React from 'react';
import { Layers, PlusCircle, Sparkles, GitPullRequest, Eye } from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'intake' | 'creep' | 'review';
  onSelectTab: (tab: 'dashboard' | 'intake' | 'creep' | 'review') => void;
  ollamaStatus: { connected: boolean; model_available: boolean; target_model: string } | null;
  onNewProjectClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  ollamaStatus,
  onNewProjectClick,
}) => {
  return (
    <header className="border-b border-[#232838] bg-[#0E1017]/95 backdrop-blur-md sticky top-0 z-50 w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none shrink-0"
          onClick={() => onSelectTab('dashboard')}
        >
          <img
            src="/kivo-icon.svg"
            alt="Kivo Logo"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg shadow-sm group-hover:scale-105 transition-transform shrink-0"
          />
          <div className="flex flex-col justify-center">
            <span className="text-lg sm:text-xl font-bold tracking-tight text-[#F7F8FA] leading-tight">
              Kivo
            </span>
            <span className="hidden sm:block text-[11px] text-[#8E96A5] tracking-normal leading-tight mt-0.5 whitespace-nowrap">
              Deterministic Scope Management
            </span>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Visible on lg+ displays, fits 1024px+ seamlessly) */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#131620] p-1 rounded-lg border border-[#232838] shrink-0">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              currentTab === 'dashboard'
                ? 'bg-[#1C202E] text-[#F7F8FA] border border-[#2B3144] shadow-sm'
                : 'text-[#9BA3B5] hover:text-[#F7F8FA] hover:bg-[#1A1E2B]/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Projects</span>
          </button>

          <button
            onClick={() => onSelectTab('intake')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              currentTab === 'intake'
                ? 'bg-[#1C202E] text-[#F7F8FA] border border-[#2B3144] shadow-sm'
                : 'text-[#9BA3B5] hover:text-[#F7F8FA] hover:bg-[#1A1E2B]/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Scope Intake</span>
          </button>

          <button
            onClick={() => onSelectTab('creep')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              currentTab === 'creep'
                ? 'bg-[#1C202E] text-[#F7F8FA] border border-[#2B3144] shadow-sm'
                : 'text-[#9BA3B5] hover:text-[#F7F8FA] hover:bg-[#1A1E2B]/50'
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Creep Detector</span>
          </button>

          <button
            onClick={() => onSelectTab('review')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              currentTab === 'review'
                ? 'bg-[#1C202E] text-[#F7F8FA] border border-[#2B3144] shadow-sm'
                : 'text-[#9BA3B5] hover:text-[#F7F8FA] hover:bg-[#1A1E2B]/50'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-[#9BA3B5]" />
            <span>Client Review</span>
          </button>
        </nav>

        {/* Right Section: Health Pill & CTA */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Local Ollama Status */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full bg-[#131620] border border-[#232838] text-[11px] font-mono shrink-0">
            {ollamaStatus?.connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[#9BA3B5] hidden sm:inline">Qwen2.5 3B</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-rose-400">Offline</span>
              </>
            )}
          </div>

          {/* New Project CTA */}
          <button
            onClick={onNewProjectClick}
            className="px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#8B5CF6] text-white hover:bg-[#9D72FF] transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Scope</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Strip (Visible on screens < lg) */}
      <div className="lg:hidden border-t border-[#232838] bg-[#11141D] px-3 py-1.5 flex items-center justify-around gap-1 overflow-x-auto text-[11px]">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'dashboard'
              ? 'bg-[#1C202E] text-[#F7F8FA] border border-[#2B3144]'
              : 'text-[#9BA3B5]'
          }`}
        >
          <Layers className="w-3 h-3 text-[#8B5CF6]" />
          <span>Projects</span>
        </button>

        <button
          onClick={() => onSelectTab('intake')}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'intake'
              ? 'bg-[#1C202E] text-[#F7F8FA] border border-[#2B3144]'
              : 'text-[#9BA3B5]'
          }`}
        >
          <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
          <span>Intake</span>
        </button>

        <button
          onClick={() => onSelectTab('creep')}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'creep'
              ? 'bg-[#1C202E] text-[#F7F8FA] border border-[#2B3144]'
              : 'text-[#9BA3B5]'
          }`}
        >
          <GitPullRequest className="w-3 h-3 text-[#8B5CF6]" />
          <span>Creep</span>
        </button>

        <button
          onClick={() => onSelectTab('review')}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'review'
              ? 'bg-[#1C202E] text-[#F7F8FA] border border-[#2B3144]'
              : 'text-[#9BA3B5]'
          }`}
        >
          <Eye className="w-3 h-3 text-[#9BA3B5]" />
          <span>Review</span>
        </button>
      </div>
    </header>
  );
};
