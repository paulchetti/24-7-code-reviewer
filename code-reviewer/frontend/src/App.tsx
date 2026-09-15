import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CodeEditor } from './components/CodeEditor';
import { ScoreCard } from './components/ScoreCard';
import { IssuesList } from './components/IssuesList';
import { RulesUploader } from './components/RulesUploader';
import { GrowthChart } from './components/GrowthChart';
import { ReviewHistory } from './components/ReviewHistory';
import { DEMO_USER, AuthUserState } from './lib/firebase';
import { submitCodeReview, checkBackendHealth, ReviewResult } from './lib/api';
import { Sparkles, AlertCircle, ShieldCheck, Bug, Zap, PenTool, Database } from 'lucide-react';
import hljs from 'highlight.js';

const INITIAL_PYTHON_CODE = `import sqlite3

def find_user_by_credentials(username, password):
    # Security Rule 4: Never commit hardcoded secrets
    API_KEY = "gcp-prod-super-secret-9948293482"
    
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    
    # Security Rule 3: Never interpolate raw user input directly into SQL queries
    query = f"SELECT id, username, email FROM accounts WHERE user = '{username}' AND pass = '{password}'"
    cursor.execute(query)
    
    user = cursor.fetchone()
    return user
`;

export function App() {
  const [activeTab, setActiveTab] = useState<'reviewer' | 'rules' | 'growth' | 'history'>('reviewer');
  const [user, setUser] = useState<AuthUserState>(DEMO_USER);
  const [backendHealthy, setBackendHealthy] = useState<boolean>(false);

  // Editor and Review state
  const [code, setCode] = useState<string>(INITIAL_PYTHON_CODE);
  const [language, setLanguage] = useState<string>('auto');
  const [contextDesc, setContextDesc] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentReview, setCurrentReview] = useState<ReviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Health check on mount
  useEffect(() => {
    const ping = async () => {
      try {
        const h = await checkBackendHealth();
        if (h.status === 'healthy') {
          setBackendHealthy(true);
        }
      } catch (e) {
        setBackendHealthy(false);
      }
    };
    ping();
    const interval = setInterval(ping, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleReview = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    let actualLang = language;
    if (language === 'auto') {
      const res = hljs.highlightAuto(code, ['python', 'javascript', 'typescript', 'go', 'java', 'cpp', 'rust']);
      actualLang = res.language || 'python';
    }

    try {
      const result = await submitCodeReview(
        {
          code,
          language: actualLang,
          context_description: contextDesc,
          top_k_rules: 5,
        },
        user.token
      );
      setCurrentReview(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Review request failed. Verify backend service is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistoryReview = (review: ReviewResult) => {
    setCurrentReview(review);
    setCode(review.code_snippet);
    setLanguage(review.language);
    setActiveTab('reviewer');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        setUser={setUser}
        backendHealthy={backendHealthy}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Error Toast */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-slate-200 text-sm font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Tab 1: Code Reviewer */}
        {activeTab === 'reviewer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Code Editor Panel */}
            <div className="lg:col-span-7">
              <CodeEditor
                code={code}
                setCode={setCode}
                language={language}
                setLanguage={setLanguage}
                contextDesc={contextDesc}
                setContextDesc={setContextDesc}
                onReview={handleReview}
                isLoading={isLoading}
              />
            </div>

            {/* Right: Results or Standby Rubric Guide */}
            <div className="lg:col-span-5 space-y-5">
              {currentReview ? (
                <>
                  <ScoreCard
                    scores={currentReview.quality_scores}
                    summary={currentReview.summary}
                  />
                  <IssuesList review={currentReview} />
                </>
              ) : (
                <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-5 shadow-xl">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Review Engine Standby</h3>
                      <p className="text-[11px] text-slate-400">
                        Powered by Vertex AI Gemini & grounded vector embeddings
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Weighted 1–10 Quality Rubric
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                          <Bug className="w-3.5 h-3.5 text-rose-400" />
                          <span>Correctness</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">30% Weight</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Security</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">30% Weight</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Performance</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">20% Weight</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                          <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Maintainability</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">20% Weight</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-300">
                      <Database className="w-3.5 h-3.5" />
                      <span>Historical Rules Grounding</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Prior to review, the code is matched against organizational rules via Vertex AI <code className="text-emerald-400 font-mono">text-embedding-004</code>. Violated rules are cited directly in the results.
                    </p>
                  </div>

                  <div className="text-center pt-1">
                    <button
                      onClick={handleReview}
                      disabled={isLoading || !code.trim()}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      <span>Analyze Code Snippet</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Historical Rules */}
        {activeTab === 'rules' && <RulesUploader token={user.token} />}

        {/* Tab 3: Developer Growth */}
        {activeTab === 'growth' && <GrowthChart token={user.token} />}

        {/* Tab 4: Review History */}
        {activeTab === 'history' && (
          <ReviewHistory token={user.token} onSelectReview={handleSelectHistoryReview} />
        )}
      </main>

      {/* Footer */}
      <footer className="glass-panel border-t border-slate-800/80 py-3 text-center text-[11px] text-slate-500 font-mono">
        The 24/7 Intelligent Code Reviewer • Code Kitchen Track 01 • Powered by Google Cloud Platform
      </footer>
    </div>
  );
}
export default App;
