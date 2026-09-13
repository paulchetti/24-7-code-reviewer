import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.review import (
    LanguageEnum,
    QualityScores,
    ReviewRequest,
    ReviewResult,
    SeverityEnum,
    VERTEX_AI_REVIEW_SCHEMA,
)
from app.models.rules import RuleEntry, RuleMatch
from app.services.vertex_reviewer import VertexReviewer


def test_quality_score_rubric_weights():
    # 10 across all dimensions
    score_max = QualityScores.calculate_overall(10.0, 10.0, 10.0, 10.0)
    assert score_max == 10.0

    # 1 across all dimensions
    score_min = QualityScores.calculate_overall(1.0, 1.0, 1.0, 1.0)
    assert score_min == 1.0

    # Custom weighted calculation:
    # 10 * 0.30 = 3.0
    # 5  * 0.30 = 1.5
    # 8  * 0.20 = 1.6
    # 7  * 0.20 = 1.4
    # Total = 3.0 + 1.5 + 1.6 + 1.4 = 7.5
    score_custom = QualityScores.calculate_overall(
        correctness=10.0,
        security=5.0,
        performance=8.0,
        maintainability=7.0,
    )
    assert score_custom == 7.5


def test_vertex_ai_schema_structure():
    assert VERTEX_AI_REVIEW_SCHEMA["type"] == "OBJECT"
    required_fields = VERTEX_AI_REVIEW_SCHEMA["required"]
    assert "quality_scores" in required_fields
    assert "detected_bugs" in required_fields
    assert "architectural_guidance" in required_fields
    assert "performance_insights" in required_fields
    assert "applied_historical_rule_ids" in required_fields

    scores_schema = VERTEX_AI_REVIEW_SCHEMA["properties"]["quality_scores"]
    assert "correctness" in scores_schema["required"]
    assert "security" in scores_schema["required"]
    assert "performance" in scores_schema["required"]
    assert "maintainability" in scores_schema["required"]


def test_system_instruction_grounding_rules():
    reviewer = VertexReviewer()
    dummy_rule = RuleEntry(
        id="RULE-101",
        type="security",
        description="Never interpolate raw user input directly into SQL queries",
    )
    matched = [RuleMatch(rule=dummy_rule, similarity_score=0.92)]

    instruction = reviewer._build_system_instruction(matched)
    assert "RULE-101" in instruction
    assert "Never interpolate raw user input directly into SQL queries" in instruction
    assert "applied_historical_rule_ids" in instruction


@pytest.mark.asyncio
async def test_vertex_reviewer_review_code_offline():
    reviewer = VertexReviewer()
    dummy_rule = RuleEntry(
        id="SEC-001",
        type="security",
        description="Never interpolate raw user input directly into SQL queries",
    )
    matched = [RuleMatch(rule=dummy_rule, similarity_score=0.88)]

    req = ReviewRequest(
        code="query = f'SELECT * FROM users WHERE id = {user_id}'\ncursor.execute(query)",
        language=LanguageEnum.PYTHON,
        top_k_rules=5,
    )

    result = await reviewer.review_code(
        request=req,
        user_id="test-developer-456",
        matched_rules=matched,
    )

    assert isinstance(result, ReviewResult)
    assert result.user_id == "test-developer-456"
    assert result.language == "python"
    assert result.quality_scores.overall_score >= 1.0
    assert result.quality_scores.overall_score <= 10.0
    assert len(result.detected_bugs) > 0
    assert any(b.severity == SeverityEnum.CRITICAL for b in result.detected_bugs)
    assert "SEC-001" in result.retrieved_rule_ids


def test_fastapi_endpoints_integration():
    client = TestClient(app)

    # 1. Health check
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    # 2. Upload historical rules
    csv_payload = {
        "csv_content": "1,formatting,Avoid single-character variable names\n2,performance,Cache repeated database lookups\n3,security,Never interpolate raw user input directly into SQL queries"
    }
    upload_resp = client.post(
        "/api/rules/upload",
        json=csv_payload,
        headers={"Authorization": "Bearer demo-token"},
    )
    assert upload_resp.status_code == 200
    assert upload_resp.json()["total_ingested"] == 3

    # 3. List rules
    list_resp = client.get(
        "/api/rules",
        headers={"Authorization": "Bearer demo-token"},
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 3

    # 4. Review code
    review_payload = {
        "code": "def find_user(user_id):\n    return db.query(f'SELECT * FROM users WHERE id = {user_id}')",
        "language": "python",
        "top_k_rules": 3,
    }
    review_resp = client.post(
        "/api/reviews",
        json=review_payload,
        headers={"Authorization": "Bearer demo-token"},
    )
    assert review_resp.status_code == 201
    review_data = review_resp.json()
    assert "review_id" in review_data
    assert "quality_scores" in review_data
    assert review_data["quality_scores"]["overall_score"] > 0

    # 5. Developer growth
    growth_resp = client.get(
        "/api/reviews/growth",
        headers={"Authorization": "Bearer demo-token"},
    )
    assert growth_resp.status_code == 200
    growth_data = growth_resp.json()
    assert growth_data["total_reviews"] >= 1
    assert "average_overall_score" in growth_data
