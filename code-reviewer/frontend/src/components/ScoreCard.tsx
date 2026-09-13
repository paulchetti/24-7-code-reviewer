import React from 'react';
import { ShieldCheck, Bug, Zap, PenTool, Award, Info } from 'lucide-react';
import { QualityScores } from '../lib/api';

interface ScoreCardProps {
  scores: QualityScores;
  summary: string;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ scores, summary }) => {
  const getScoreColor = (score: number) => {
    if (score >= 8.5) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 7.0) return 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10';
    if (score >= 5.0) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getScoreProgressColor = (score: number) => {
    if (score >= 8.5) return 'bg-emerald-400';
    if (score >= 7.0) return 'bg-indigo-400';
    if (score >= 5.0) return 'bg-amber-400';
    return 'bg-rose-400';
  };

  const categories = [
    {
      name: 'Correctness',
      weight: '30%',
      score: scores.correctness,
      icon: Bug,
      desc: 'Logic correctness, boundary safety, panic prevention',
    },
    {
      name: 'Security',
      weight: '30%',
      score: scores.security,
      icon: ShieldCheck,
      desc: 'Injection protection, secrets hygiene, OWASP defense',
    },
    {
      name: 'Performance',
      weight: '20%',
      score: scores.performance,
      icon: Zap,
      desc: 'Algorithmic efficiency, I/O streaming, memory overhead',
    },
    {
      name: 'Maintainability',
      weight: '20%',
      score: scores.maintainability,
      icon: PenTool,
      desc: 'Idiomatic patterns, naming clarity, clean architecture',
    },
  ];

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
      {/* Overall Score Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 tracking-wider uppercase">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Standardized 1-10 Quality Rating</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Review Assessment</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl line-clamp-2">{summary}</p>
        </div>

        {/* Big Overall Score Badge */}
        <div className="flex items-center space-x-4 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 self-start sm:self-center">
          <div
            className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center font-bold font-mono ${getScoreColor(
              scores.overall_score
            )}`}
          >
            <span className="text-2xl leading-none">{scores.overall_score.toFixed(1)}</span>
            <span className="text-[10px] opacity-70">/ 10.0</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Weighted Score</div>
            <div className="text-[11px] text-slate-400 font-mono">
              30% Corr + 30% Sec<br />20% Perf + 20% Maint
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const colorClass = getScoreColor(cat.score);
          const progressColor = getScoreProgressColor(cat.score);

          return (
            <div
              key={cat.name}
              className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                    <Icon className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">{cat.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Weight: {cat.weight}</div>
                  </div>
                </div>
                <div
                  className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${colorClass}`}
                >
                  {cat.score.toFixed(1)}
                </div>
              </div>

              {/* Progress Bar (0 - 10 mapped to 0% - 100%) */}
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden p-[1px] border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
                  style={{ width: `${Math.min(100, Math.max(10, (cat.score / 10) * 100))}%` }}
                />
              </div>

              <div className="text-[11px] text-slate-400 leading-tight">{cat.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
