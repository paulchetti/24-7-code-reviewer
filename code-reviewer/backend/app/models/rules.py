from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class RuleEntry(BaseModel):
    """Pydantic model representing a historical coding rule."""

    id: str = Field(..., description="Unique rule identifier (e.g. '1', 'SEC-001')")
    type: str = Field(
        ...,
        description="Rule category/type (e.g. formatting, performance, security, correctness, architecture)",
    )
    description: str = Field(
        ...,
        description="Clear rule instruction (e.g. 'Never interpolate raw user input directly into SQL queries')",
    )
    embedding: Optional[List[float]] = Field(
        default=None,
        description="Vertex AI text-embedding-004 vector (typically 768 dimensions)",
    )
    created_at: Optional[str] = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Timestamp when rule was ingested",
    )


class RuleUploadResponse(BaseModel):
    """Response returned upon completing CSV rule ingestion."""

    status: str = "success"
    total_ingested: int
    rules: List[RuleEntry]
    message: str


class RuleMatch(BaseModel):
    """A matched rule resulting from semantic vector search."""

    rule: RuleEntry
    similarity_score: float = Field(
        ..., ge=-1.0, le=1.0, description="Cosine similarity score against query code"
    )


class RuleQueryRequest(BaseModel):
    """Request payload to test semantic retrieval against ingested rules."""

    code: str = Field(..., min_length=5, description="Code snippet to match against rules")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of rules to retrieve")
