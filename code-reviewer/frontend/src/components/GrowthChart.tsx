import React, { useEffect, useState } from 'react';
import { TrendingUp, Award, AlertTriangle, CheckCircle2, BarChart3, RefreshCw } from 'lucide-react';
import { fetchDeveloperGrowth, DeveloperGrowthMetrics } from '../lib/api';

interface GrowthChartProps {
  token?: string;
}

export const GrowthChart: React.FC<GrowthChartProps> = ({ token }) => {
  const [metrics, setMetrics] = useState<DeveloperGrowthMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await fetchDeveloperGrowth(token);
      setMetrics(data);
    } catch (e) {
      console.warn("Could not fetch growth metrics:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [token]);

  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <div className="text-xs text-slate-400">Loading Developer Growth Metrics...</div>
      </div>
    );
  }

  if (!metrics || metrics.total_reviews === 0) {
    return (
      <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3 max-w-2xl mx-auto">
        <TrendingUp className="w-10 h-10 text-indigo-400 mx-auto opacity-50" />
        <h3 className="text-base font-bold text-slate-200">No Review Sessions Recorded Yet</h3>
        <p className="text-xs text-slate-400">
          Submit code in the <strong>Code Reviewer</strong> tab. Each review will be permanently stored in Cloud Firestore under <code className="text-indigo-300">users/&#123;userId&#125;/reviews</code> to track your score progression, recurring defects, and rule compliance.
        </p>
      </div>
    );
  }

  const trajectory = metrics.score_trajectory;
  const maxScore = 10.0;
  const minScore = 0.0;

  // Chart coordinates calculation
  const chartHeight = 160;
  const chartWidth = 500;
  const points = trajectory.map((item, index) => {
    const x = trajectory.length === 1 ? chartWidth / 2 : (index / (trajectory.length - 1)) * (chartWidth - 40) + 20;
    const y = chartHeight - (item.overall_score / maxScore) * (chartHeight - 30) - 15;
    return { x, y, score: item.overall_score, date: item.timestamp, lang: item.language };
  });

  const pathD = points.length > 1
    ? points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '')
    : '';

  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
    : '';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Average Quality Score</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {metrics.average_overall_score} <span className="text-xs text-slate-500">/ 10</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Total Code Reviews</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {metrics.total_reviews}
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Development Trajectory</div>
            <div className="text-sm font-semibold text-emerald-400 mt-0.5">
              Active Tracking
            </div>
          </div>
        </div>
      </div>

      {/* Score Progression Trajectory Chart */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-slate-200">Score Progression Trajectory</span>
          </div>
          <button
            onClick={loadMetrics}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* SVG Responsive Line Chart */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44 overflow-visible">
            <defs>
              <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[2.5, 5.0, 7.5, 10.0].map((val) => {
              const y = chartHeight - (val / maxScore) * (chartHeight - 30) - 15;
              return (
                <g key={val}>
                  <line x1="10" y1={y} x2={chartWidth - 10} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x="12" y={y - 4} fill="#64748b" fontSize="8" fontFamily="monospace">
                    {val.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Area */}
            {areaD && <path d={areaD} fill="url(#scoreAreaGradient)" />}

            {/* Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill="#0B0F19" stroke="#10b981" strokeWidth="2" />
                <text
                  x={p.x}
                  y={p.y - 8}
                  fill="#f1f5f9"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {p.score.toFixed(1)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Actionable growth summary */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
            Progress Analysis
          </span>
          {metrics.historical_progress_summary}
        </div>
      </div>

      {/* Recurring Vulnerabilities and Rules Applied Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vulnerability Patterns */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-slate-200">Recurring Vulnerability Patterns</span>
          </div>

          <div className="space-y-2.5">
            {Object.keys(metrics.vulnerability_patterns).length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">No recurring defects recorded.</div>
            ) : (
              Object.entries(metrics.vulnerability_patterns).map(([pattern, count]) => (
                <div key={pattern} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-300 font-medium">{pattern}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-bold">
                    {count} {count === 1 ? 'time' : 'times'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Historical Rules Triggered */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-bold text-slate-200">Most Triggered Historical Rules</span>
          </div>

          <div className="space-y-2.5">
            {Object.keys(metrics.applied_rules_frequency).length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">No historical rule violations logged.</div>
            ) : (
              Object.entries(metrics.applied_rules_frequency).map(([ruleId, count]) => (
                <div key={ruleId} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-indigo-400 font-mono font-bold">Rule [{ruleId}]</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono font-bold">
                    {count} {count === 1 ? 'violation' : 'violations'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
