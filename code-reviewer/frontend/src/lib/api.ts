const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface QualityScores {
  correctness: number;
  security: number;
  performance: number;
  maintainability: number;
  overall_score: number;
}

export interface CodeIssue {
  id: string;
  line_number: number | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'correctness' | 'security' | 'performance' | 'maintainability' | 'architecture';
  title: string;
  description: string;
  suggestion: string;
  code_sample?: string;
}

export interface ReviewResult {
  review_id: string;
  user_id: string;
  timestamp: string;
  language: string;
  code_snippet: string;
  quality_scores: QualityScores;
  detected_bugs: CodeIssue[];
  architectural_guidance: string[];
  performance_insights: string[];
  applied_historical_rule_ids: string[];
  retrieved_rule_ids: string[];
  summary: string;
}

export interface DeveloperGrowthMetrics {
  user_id: string;
  total_reviews: number;
  average_overall_score: number;
  score_trajectory: Array<{
    review_id: string;
    timestamp: string;
    overall_score: number;
    correctness: number;
    security: number;
    performance: number;
    maintainability: number;
    language: string;
  }>;
  vulnerability_patterns: Record<string, number>;
  applied_rules_frequency: Record<string, number>;
  historical_progress_summary: string;
}

export interface RuleEntry {
  id: string;
  type: string;
  description: string;
  created_at?: string;
}

export interface RuleUploadResponse {
  status: string;
  total_ingested: number;
  rules: RuleEntry[];
  message: string;
}

export interface RuleMatch {
  rule: RuleEntry;
  similarity_score: number;
}

export interface ReviewRequest {
  code: string;
  language: string;
  context_description?: string;
  top_k_rules?: number;
}

function getHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function submitCodeReview(
  request: ReviewRequest,
  token?: string
): Promise<ReviewResult> {
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Review request failed with HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchReviewHistory(token?: string): Promise<ReviewResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/reviews/history`, {
    method: 'GET',
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch history: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchDeveloperGrowth(token?: string): Promise<DeveloperGrowthMetrics> {
  const res = await fetch(`${API_BASE_URL}/api/reviews/growth`, {
    method: 'GET',
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch growth metrics: HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadRulesCsv(
  csvContent: string,
  token?: string
): Promise<RuleUploadResponse> {
  const res = await fetch(`${API_BASE_URL}/api/rules/upload`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ csv_content: csvContent }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `CSV Upload failed with HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchActiveRules(token?: string): Promise<RuleEntry[]> {
  const res = await fetch(`${API_BASE_URL}/api/rules`, {
    method: 'GET',
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch rules: HTTP ${res.status}`);
  }
  return res.json();
}

export async function queryRulesSemantic(
  code: string,
  topK: number = 5,
  token?: string
): Promise<RuleMatch[]> {
  const res = await fetch(`${API_BASE_URL}/api/rules/query`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ code, top_k: topK }),
  });
  if (!res.ok) {
    throw new Error(`Semantic query failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function checkBackendHealth(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/health`);
  return res.json();
}
