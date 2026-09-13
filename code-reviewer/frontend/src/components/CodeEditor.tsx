import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Sparkles, Code2, RotateCcw, FileCode, Check } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
  contextDesc: string;
  setContextDesc: (desc: string) => void;
  onReview: () => void;
  isLoading: boolean;
}

const LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'go', label: 'Go' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'rust', label: 'Rust' },
];

const CODE_PRESETS = [
  {
    name: 'Python SQL Injection & Hardcoded Secret',
    language: 'python',
    code: `import sqlite3

def authenticate_user(username, password):
    # Rule 4 Violation: Hardcoded API secret
    ADMIN_TOKEN = "sk-live-98745234-supersecret"
    
    conn = sqlite3.connect("production.db")
    cursor = conn.cursor()
    
    # Rule 3 Violation: Raw SQL string formatting
    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
    cursor.execute(query)
    
    user = cursor.fetchone()
    return user
`,
  },
  {
    name: 'Go Deadlock & Unhandled Nil Pointer',
    language: 'go',
    code: `package main

import (
	"fmt"
	"sync"
)

type Account struct {
	Balance *float64
	mu      sync.Mutex
}

func Transfer(from *Account, to *Account, amount float64) {
	// Rule 8 Violation: Mutex lock without defer
	from.mu.Lock()
	to.mu.Lock()

	// Rule 7 Violation: Direct pointer dereference without nil check
	*from.Balance -= amount
	*to.Balance += amount

	from.mu.Unlock()
	to.mu.Unlock()
}
`,
  },
  {
    name: 'TypeScript XSS & Array Bounds',
    language: 'typescript',
    code: `export function renderUserProfile(container: HTMLElement, userData: any) {
  // Rule 5 Violation: Direct innerHTML assignment with unescaped input
  container.innerHTML = \`<div class="profile">
    <h2>\${userData.name}</h2>
    <p>\${userData.bio}</p>
  </div>\`;

  // Rule 15 Violation: Unchecked array indexing
  const primaryRole = userData.roles[0].title;
  return primaryRole;
}
`,
  },
  {
    name: 'Rust Memory & Concurrency Pattern',
    language: 'rust',
    code: `use std::thread;

pub fn compute_metrics(data: Vec<i32>) -> i32 {
    let mut total = 0;
    
    // Potentially problematic thread spawning with shared reference
    let handle = thread::spawn(move || {
        let sum: i32 = data.iter().sum();
        sum
    });

    total += handle.join().unwrap();
    total
}
`,
  },
];

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  setCode,
  language,
  setLanguage,
  contextDesc,
  setContextDesc,
  onReview,
  isLoading,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const handleApplyPreset = (presetName: string) => {
    const preset = CODE_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setSelectedPreset(presetName);
      setLanguage(preset.language);
      setCode(preset.code);
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-full shadow-2xl">
      {/* Editor Header */}
      <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-slate-900 text-slate-200">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Preset Selector */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={selectedPreset}
              onChange={(e) => handleApplyPreset(e.target.value)}
              className="bg-transparent text-slate-300 outline-none cursor-pointer max-w-[180px] text-xs"
            >
              <option value="" disabled className="bg-slate-900">
                Load Test Snippet...
              </option>
              {CODE_PRESETS.map((p) => (
                <option key={p.name} value={p.name} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onReview}
          disabled={isLoading || !code.trim()}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
            isLoading || !code.trim()
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analyzing with Vertex AI...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Run Intelligent Review</span>
            </>
          )}
        </button>
      </div>

      {/* Optional Context Input */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60">
        <input
          type="text"
          value={contextDesc}
          onChange={(e) => setContextDesc(e.target.value)}
          placeholder="Optional: Enter functional requirements or PR context for this code..."
          className="w-full bg-transparent text-xs text-slate-300 placeholder-slate-500 outline-none"
        />
      </div>

      {/* Monaco Editor Container */}
      <div className="h-[420px] relative">
        <Editor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          value={code}
          onChange={(val) => setCode(val || '')}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
};
