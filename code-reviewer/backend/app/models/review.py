from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class LanguageEnum(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    GO = "go"
    JAVA = "java"
    CPP = "cpp"
    RUST = "rust"


class SeverityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class CategoryEnum(str, Enum):
    CORRECTNESS = "correctness"
    SECURITY = "security"
    PERFORMANCE = "performance"
    MAINTAINABILITY = "maintainability"
    ARCHITECTURE = "architecture"


class ReviewRequest(BaseModel):
    """Incoming request payload for a code review."""

    code: str = Field(..., min_length=5, description="Source code snippet to review")
    language: LanguageEnum = Field(..., description="Programming language of the snippet")
    context_description: Optional[str] = Field(
        default=None,
        description="Optional context or functional requirements for the code snippet",
    )
    top_k_rules: int = Field(
        default=5, ge=1, le=20, description="Max historical rules to semantically retrieve"
    )


class CodeIssue(BaseModel):
    """Detailed bug or vulnerability detected in the code."""

    id: str = Field(..., description="Issue identifier (e.g. 'ISSUE-1')")
    line_number: Optional[int] = Field(
        default=None, description="1-indexed line number where the issue occurs"
    )
    severity: SeverityEnum = Field(
        ..., description="Severity grading: CRITICAL, HIGH, MEDIUM, or LOW"
    )
    category: CategoryEnum = Field(
        ..., description="Category: correctness, security, performance, or maintainability"
    )
    title: str = Field(..., description="Brief headline of the issue")
    description: str = Field(..., description="Detailed explanation of the flaw or defect")
    suggestion: str = Field(..., description="Concrete guidance on how to resolve the issue")
    code_sample: Optional[str] = Field(
        default=None, description="Recommended replacement code or diff"
    )


class QualityScores(BaseModel):
    """Standardized 1 to 10 quality score breakdown and weighted overall rating."""

    correctness: float = Field(
        ..., ge=1.0, le=10.0, description="Correctness & bug-free logic score (1.0 to 10.0)"
    )
    security: float = Field(
        ..., ge=1.0, le=10.0, description="Security posture and vulnerability resistance (1.0 to 10.0)"
    )
    performance: float = Field(
        ..., ge=1.0, le=10.0, description="Runtime and resource efficiency (1.0 to 10.0)"
    )
    maintainability: float = Field(
        ...,
        ge=1.0,
        le=10.0,
        description="Readability, naming, and architectural elegance (1.0 to 10.0)",
    )
    overall_score: float = Field(
        ..., ge=1.0, le=10.0, description="Weighted composite score: 30% Corr + 30% Sec + 20% Perf + 20% Maint"
    )

    @classmethod
    def calculate_overall(
        cls,
        correctness: float,
        security: float,
        performance: float,
        maintainability: float,
    ) -> float:
        """Calculate weighted score: 30% correctness, 30% security, 20% performance, 20% maintainability."""
        weighted = (
            (correctness * 0.30)
            + (security * 0.30)
            + (performance * 0.20)
            + (maintainability * 0.20)
        )
        return round(max(1.0, min(10.0, weighted)), 2)


class ReviewResult(BaseModel):
    """Complete structured output from the 24/7 Intelligent Code Reviewer."""

    review_id: str = Field(..., description="Unique UUID for this review record")
    user_id: str = Field(..., description="Authenticated user ID")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC ISO-8601 timestamp",
    )
    language: str = Field(..., description="Source code language")
    code_snippet: str = Field(..., description="The reviewed code snippet")
    quality_scores: QualityScores = Field(..., description="Standardized 1 to 10 scores")
    detected_bugs: List[CodeIssue] = Field(
        default_factory=list, description="Comprehensive list of detected issues"
    )
    architectural_guidance: List[str] = Field(
        default_factory=list, description="Architectural best-practice guidance"
    )
    performance_insights: List[str] = Field(
        default_factory=list, description="Performance and optimization recommendations"
    )
    applied_historical_rule_ids: List[str] = Field(
        default_factory=list,
        description="IDs of historical rules from ingested CSV that were applied during this review",
    )
    retrieved_rule_ids: List[str] = Field(
        default_factory=list,
        description="IDs of historical rules retrieved via semantic vector search for this review",
    )
    summary: str = Field(
        ..., description="Executive summary of review findings and code quality"
    )


class DeveloperGrowthMetrics(BaseModel):
    """Aggregate developer metrics tracking progress and recurring patterns over time."""

    user_id: str
    total_reviews: int
    average_overall_score: float
    score_trajectory: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Chronological list of reviews with timestamp and scores",
    )
    vulnerability_patterns: Dict[str, int] = Field(
        default_factory=dict,
        description="Occurrences of issues grouped by category/severity",
    )
    applied_rules_frequency: Dict[str, int] = Field(
        default_factory=dict,
        description="Historical rules most frequently triggered by this user",
    )
    historical_progress_summary: str = Field(
        ..., description="Actionable summary of growth, improvements, and recurring pitfalls"
    )


# Vertex AI OpenAPI 3.0 Generation Schema
VERTEX_AI_REVIEW_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "summary": {
            "type": "STRING",
            "description": "Executive summary of the review findings and overall code quality.",
        },
        "quality_scores": {
            "type": "OBJECT",
            "properties": {
                "correctness": {
                    "type": "NUMBER",
                    "description": "Score from 1.0 to 10.0 for correctness and logic bugs.",
                },
                "security": {
                    "type": "NUMBER",
                    "description": "Score from 1.0 to 10.0 for security vulnerabilities and injection risks.",
                },
                "performance": {
                    "type": "NUMBER",
                    "description": "Score from 1.0 to 10.0 for resource efficiency and speed.",
                },
                "maintainability": {
                    "type": "NUMBER",
                    "description": "Score from 1.0 to 10.0 for readability, naming, and structure.",
                },
            },
            "required": ["correctness", "security", "performance", "maintainability"],
        },
        "detected_bugs": {
            "type": "ARRAY",
            "description": "List of bugs, defects, and security flaws.",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id": {"type": "STRING", "description": "Unique issue ID, e.g. ISSUE-1"},
                    "line_number": {
                        "type": "INTEGER",
                        "description": "1-indexed line number where the issue occurs",
                    },
                    "severity": {
                        "type": "STRING",
                        "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
                    },
                    "category": {
                        "type": "STRING",
                        "enum": ["correctness", "security", "performance", "maintainability", "architecture"],
                    },
                    "title": {"type": "STRING", "description": "Short headline"},
                    "description": {"type": "STRING", "description": "Detailed explanation"},
                    "suggestion": {"type": "STRING", "description": "Remediation steps"},
                    "code_sample": {"type": "STRING", "description": "Example fix or diff"},
                },
                "required": ["id", "severity", "category", "title", "description", "suggestion"],
            },
        },
        "architectural_guidance": {
            "type": "ARRAY",
            "description": "High-level design and architectural recommendations.",
            "items": {"type": "STRING"},
        },
        "performance_insights": {
            "type": "ARRAY",
            "description": "Optimization and efficiency insights.",
            "items": {"type": "STRING"},
        },
        "applied_historical_rule_ids": {
            "type": "ARRAY",
            "description": "List of rule IDs (from the injected historical guidelines) that were violated or applied to this code.",
            "items": {"type": "STRING"},
        },
    },
    "required": [
        "summary",
        "quality_scores",
        "detected_bugs",
        "architectural_guidance",
        "performance_insights",
        "applied_historical_rule_ids",
    ],
}
