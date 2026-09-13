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
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [language, setLanguage] = useState<string>('python');
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
    try {
      const result = await submitCodeReview(
        {
          code,
          language,
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error Toast */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-slate-200 text-sm font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Tab 1: Code Reviewer */}
        {activeTab === 'reviewer' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Code Editor Panel */}
              <div className={currentReview ? 'lg:col-span-6' : 'lg:col-span-12'}>
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

              {/* Review Results Panel */}
              {currentReview && (
                <div className="lg:col-span-6 space-y-6">
                  <ScoreCard
                    scores={currentReview.quality_scores}
                    summary={currentReview.summary}
                  />
                  <IssuesList review={currentReview} />
                </div>
              )}
            </div>

            {/* Prompt to run review if no review result yet */}
            {!currentReview && (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Ready for Multi-Language Analysis</h3>
                <p className="text-xs text-slate-400 max-w-xl mx-auto">
                  Select a language (Python, JavaScript, TypeScript, Go, Java, C++, or Rust), paste your code or choose a test snippet above, and click <strong>Run Intelligent Review</strong> to trigger Vertex AI Gemini analysis with grounded historical rule retrieval.
                </p>
              </div>
            )}
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
      <footer className="glass-panel border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 font-mono">
        The 24/7 Intelligent Code Reviewer • Code Kitchen Track 01 • Powered by Google Cloud Platform
      </footer>
    </div>
  );
}
export default App;
