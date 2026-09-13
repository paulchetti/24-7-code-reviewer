import React, { useEffect, useState } from 'react';
import { History, Calendar, Code2, ArrowRight, Award } from 'lucide-react';
import { fetchReviewHistory, ReviewResult } from '../lib/api';

interface ReviewHistoryProps {
  token?: string;
  onSelectReview: (review: ReviewResult) => void;
}

export const ReviewHistory: React.FC<ReviewHistoryProps> = ({ token, onSelectReview }) => {
  const [history, setHistory] = useState<ReviewResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchReviewHistory(token);
        setHistory(data);
      } catch (e) {
        console.warn("Error fetching review history:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <div className="text-xs text-slate-400">Retrieving Cloud Firestore History...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3 max-w-xl mx-auto">
        <History className="w-10 h-10 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-200">No Historical Reviews Found</h3>
        <p className="text-xs text-slate-400">
          Run your first review in the Code Reviewer tab to start building your session history.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Review History</h2>
          <p className="text-xs text-slate-400">
            Recorded in Cloud Firestore under <code className="text-indigo-400 font-mono">users/&#123;userId&#125;/reviews</code>
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total Reviews: <span className="font-bold text-emerald-400">{history.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {history.map((review) => {
          const date = new Date(review.timestamp).toLocaleString();
          const score = review.quality_scores.overall_score;
          const scoreColor =
            score >= 8.0
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : score >= 6.0
              ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

          return (
            <div
              key={review.review_id}
              onClick={() => onSelectReview(review)}
              className="glass-panel-interactive p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center font-mono font-bold ${scoreColor}`}>
                  <span className="text-base leading-none">{score.toFixed(1)}</span>
                  <span className="text-[9px] opacity-70">/10</span>
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-300 font-bold">
                      {review.language}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 line-clamp-1 max-w-md">
                      {review.summary}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-1 font-mono">
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {date}
                    </span>
                    <span>•</span>
                    <span>{review.detected_bugs.length} defects</span>
                    {review.applied_historical_rule_ids?.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400">
                          {review.applied_historical_rule_ids.length} rules cited
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs text-indigo-400 font-semibold self-end sm:self-center">
                <span>View Results</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
