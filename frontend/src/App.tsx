import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ScopeIntakeView } from './components/ScopeIntakeView';
import { ScopeCreepView } from './components/ScopeCreepView';
import { ProposalReviewView } from './components/ProposalReviewView';
import { getHealth } from './api/client';

export function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'intake' | 'creep' | 'review'>('dashboard');
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; model_available: boolean; target_model: string } | null>(null);
  
  const [activeCreepProjectId, setActiveCreepProjectId] = useState<string>('');
  const [activeProposalToken, setActiveProposalToken] = useState<string>('');

  useEffect(() => {
    // Check local backend & Ollama health
    const checkStatus = async () => {
      try {
        const res = await getHealth();
        setOllamaStatus(res.ollama);
      } catch {
        setOllamaStatus({ connected: false, model_available: false, target_model: 'qwen2.5:3b' });
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleScopeSaved = (projectId: string) => {
    setActiveCreepProjectId(projectId);
    setCurrentTab('dashboard');
  };

  const handleAnalyzeCreep = (projectId: string) => {
    setActiveCreepProjectId(projectId);
    setCurrentTab('creep');
  };

  const handleOpenProposalDemo = (token: string) => {
    setActiveProposalToken(token);
    setCurrentTab('review');
  };

  return (
    <div className="min-h-screen bg-[#0E1017] text-[#F7F8FA] flex flex-col font-sans selection:bg-[#8B5CF6] selection:text-[#0F1115] overflow-x-hidden w-full max-w-full">
      {/* Navbar with Ollama Local Health Indicator */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        ollamaStatus={ollamaStatus}
        onNewProjectClick={() => setCurrentTab('intake')}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && (
          <DashboardView
            onSelectProject={(id) => handleAnalyzeCreep(id)}
            onNewScopeClick={() => setCurrentTab('intake')}
            onAnalyzeCreep={(id) => handleAnalyzeCreep(id)}
          />
        )}

        {currentTab === 'intake' && (
          <ScopeIntakeView onScopeSaved={handleScopeSaved} />
        )}

        {currentTab === 'creep' && (
          <ScopeCreepView
            initialProjectId={activeCreepProjectId}
            onOpenProposalDemo={handleOpenProposalDemo}
          />
        )}

        {currentTab === 'review' && (
          <ProposalReviewView
            token={activeProposalToken}
            onBackToDashboard={() => setCurrentTab('dashboard')}
          />
        )}
      </main>

      {/* Footer with Challenge & Local-First Disclaimers */}
      <footer className="border-t border-[#232838] bg-[#0E1017] py-6 text-xs text-[#6E778B]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#A8B0C0]">Kivo Scope Engine</span>
            <span>•</span>
            <span>DEV Side Hustle Hacktoberfest Challenge</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
              Local Inference (Qwen2.5 3B)
            </span>
            <span>•</span>
            <span>Deterministic Pricing Math</span>
            <span>•</span>
            <span>SQLite Persistence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
