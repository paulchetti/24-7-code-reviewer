import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronRight, BookOpen, Layers, Zap } from 'lucide-react';
import { CodeIssue, ReviewResult } from '../lib/api';

interface IssuesListProps {
  review: ReviewResult;
}

export const IssuesList: React.FC<IssuesListProps> = ({ review }) => {
  const [activeTab, setActiveTab] = useState<'bugs' | 'architecture' | 'performance'>('bugs');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(
    review.detected_bugs.length > 0 ? review.detected_bugs[0].id : null
  );

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'LOW':
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return <AlertOctagon className="w-4 h-4 text-rose-400" />;
      case 'MEDIUM':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'LOW':
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Tab Header */}
      <div className="bg-slate-900/90 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('bugs')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'bugs'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Detected Defects ({review.detected_bugs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'architecture'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Architectural Guidance ({review.architectural_guidance.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'performance'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Performance Insights ({review.performance_insights.length})</span>
          </button>
        </div>

        {/* Historical Rules Cited Badge */}
        {review.applied_historical_rule_ids && review.applied_historical_rule_ids.length > 0 && (
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Applied Rules: {review.applied_historical_rule_ids.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'bugs' && (
          <div className="space-y-4">
            {review.detected_bugs.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-200">Zero Critical Defects Found</div>
                <p className="text-xs text-slate-400 mt-1">
                  The code passes all correctness, security, and rule checks with high confidence.
                </p>
              </div>
            ) : (
              review.detected_bugs.map((issue) => {
                const isExpanded = expandedIssue === issue.id;
                return (
                  <div
                    key={issue.id}
                    className="glass-panel rounded-xl border border-slate-800/90 overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {getSeverityIcon(issue.severity)}
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getSeverityBadge(
                              issue.severity
                            )}`}
                          >
                            {issue.severity}
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {issue.category}
                          </span>
                          {issue.line_number && (
                            <span className="text-xs font-mono text-indigo-400 font-semibold">
                              Line {issue.line_number}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-200">{issue.title}</span>
                        </div>
                      </div>

                      <div className="text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </div>

                    {/* Collapsible details */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-800/60 bg-slate-950/40 text-xs text-slate-300">
                        <div>
                          <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider mb-1">
                            Description
                          </div>
                          <p className="leading-relaxed">{issue.description}</p>
                        </div>

                        <div>
                          <div className="font-semibold text-emerald-400 text-[11px] uppercase tracking-wider mb-1">
                            Remediation Suggestion
                          </div>
                          <p className="leading-relaxed text-slate-200">{issue.suggestion}</p>
                        </div>

                        {issue.code_sample && (
                          <div>
                            <div className="font-semibold text-indigo-400 text-[11px] uppercase tracking-wider mb-1 font-mono">
                              Recommended Fix Code
                            </div>
                            <pre className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-slate-200 font-mono text-[11px] overflow-x-auto">
                              {issue.code_sample}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="space-y-3">
            {review.architectural_guidance.map((guidance, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3 text-xs text-slate-200"
              >
                <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 leading-relaxed">{guidance}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-3">
            {review.performance_insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3 text-xs text-slate-200"
              >
                <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1 leading-relaxed">{insight}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
