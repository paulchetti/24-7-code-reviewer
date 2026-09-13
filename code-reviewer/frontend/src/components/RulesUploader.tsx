import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Plus, Search, Sparkles, Database } from 'lucide-react';
import { uploadRulesCsv, fetchActiveRules, queryRulesSemantic, RuleEntry, RuleMatch } from '../lib/api';

interface RulesUploaderProps {
  token?: string;
}

export const RulesUploader: React.FC<RulesUploaderProps> = ({ token }) => {
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [csvInput, setCsvInput] = useState<string>(
`id,type,description
1,formatting,Avoid single-character variable names outside of trivial loop counters
2,performance,Cache repeated database lookups and expensive calculations
3,security,Never interpolate raw user input directly into SQL queries; always use parameterized queries
4,security,Never commit hardcoded secrets API tokens or credentials into source code
5,security,Sanitize and escape all user-controlled data before rendering into HTML to prevent Cross-Site Scripting (XSS)`
  );
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Semantic query test states
  const [testCodeSnippet, setTestCodeSnippet] = useState<string>("db.query(f'SELECT * FROM users WHERE email = {email}')");
  const [semanticMatches, setSemanticMatches] = useState<RuleMatch[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const loadRules = async () => {
    try {
      const activeRules = await fetchActiveRules(token);
      setRules(activeRules);
    } catch (e) {
      console.warn("Could not fetch active rules:", e);
    }
  };

  useEffect(() => {
    loadRules();
  }, [token]);

  const handleUpload = async () => {
    if (!csvInput.trim()) return;
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const resp = await uploadRulesCsv(csvInput, token);
      setUploadStatus({
        type: 'success',
        message: `Successfully ingested ${resp.total_ingested} rules. Vector embeddings generated via Vertex AI text-embedding-004.`,
      });
      loadRules();
    } catch (err: any) {
      setUploadStatus({
        type: 'error',
        message: err.message || 'Failed to ingest CSV rules.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setCsvInput(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSemanticSearch = async () => {
    if (!testCodeSnippet.trim()) return;
    setIsSearching(true);
    try {
      const matches = await queryRulesSemantic(testCodeSnippet, 3, token);
      setSemanticMatches(matches);
    } catch (e) {
      console.warn("Semantic query error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>Historical Review Grounding & CSV Ingestion</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Rule Management & Embeddings</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Upload organizational engineering rules using schema: <code className="text-indigo-300 font-mono">&lt;id&gt;, &lt;type&gt;, &lt;description&gt;</code>. 
            Rules are stored in Cloud Firestore with Vertex AI <code className="text-emerald-300 font-mono">text-embedding-004</code> vectors for semantic code matching.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
          Total Embedded: <span className="font-bold text-emerald-400">{rules.length}</span> Rules
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Ingestion Panel */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-slate-200">CSV Rule Ingestion</span>
            </div>

            <label className="cursor-pointer px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg transition-colors border border-slate-700 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Choose CSV File</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="text-xs text-slate-400">
            Paste or edit raw CSV data below. Required columns: <code className="text-slate-300">id, type, description</code>
          </div>

          <textarea
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            rows={8}
            className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 focus:border-indigo-500 outline-none"
            placeholder="id,type,description&#10;1,formatting,Avoid single-character variable names&#10;2,performance,Cache repeated database lookups"
          />

          {uploadStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start space-x-2 ${
                uploadStatus.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}
            >
              {uploadStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 text-rose-400" />
              )}
              <span>{uploadStatus.message}</span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={isUploading || !csvInput.trim()}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              isUploading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Computing Vertex AI Embeddings...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Ingest & Embed Historical Rules</span>
              </>
            )}
          </button>
        </div>

        {/* Semantic Retrieval Playground */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-slate-200">Semantic Matching Sandbox</span>
          </div>

          <div className="text-xs text-slate-400">
            Test how Vertex AI <code className="text-slate-300">text-embedding-004</code> vector similarity retrieves guidelines for arbitrary code snippets:
          </div>

          <textarea
            value={testCodeSnippet}
            onChange={(e) => setTestCodeSnippet(e.target.value)}
            rows={3}
            className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 focus:border-indigo-500 outline-none"
            placeholder="Enter code to test matching rules..."
          />

          <button
            onClick={handleSemanticSearch}
            disabled={isSearching || !testCodeSnippet.trim()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center space-x-2"
          >
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isSearching ? 'Retrieving...' : 'Test Semantic Top-K Retrieval'}</span>
          </button>

          {semanticMatches.length > 0 && (
            <div className="space-y-2 mt-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Top Vector Matches
              </div>
              {semanticMatches.map((m) => (
                <div
                  key={m.rule.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-400">
                      Rule [{m.rule.id}] ({m.rule.type.toUpperCase()})
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Similarity: {(m.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-slate-300">{m.rule.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Rules Table */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-200">Active Ingested Guidelines</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                <th className="py-2.5 px-3">Rule ID</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Guideline Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">{r.id}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-300">
                      {r.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-200">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
