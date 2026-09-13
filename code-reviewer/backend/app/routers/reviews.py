import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import get_current_user
from app.models.review import DeveloperGrowthMetrics, ReviewRequest, ReviewResult
from app.services.firestore_service import firestore_service
from app.services.rules_engine import rules_engine
from app.services.vertex_reviewer import vertex_reviewer

logger = logging.getLogger("code_reviewer.routers.reviews")
router = APIRouter(prefix="/api/reviews", tags=["Intelligent Code Reviews"])


@router.post(
    "",
    response_model=ReviewResult,
    status_code=status.HTTP_201_CREATED,
    summary="Execute intelligent multi-language code review",
)
async def create_code_review(
    request: ReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    """Analyze code snippet using Vertex AI Gemini model.
    1. Semantically retrieves top-k historical guidelines using Vertex AI text-embedding-004.
    2. Grounds Gemini system context with matched guidelines.
    3. Produces structured bug reports (with line numbers & severity) and 1-10 quality scores.
    4. Records session persistently in Cloud Firestore under users/{userId}/reviews/{reviewId}.
    """
    user_id = current_user.get("uid", "anonymous")

    try:
        # 1. Semantic retrieval of top-k rules
        matched_rules = rules_engine.retrieve_top_k(
            code_snippet=request.code, top_k=request.top_k_rules
        )
        logger.info(
            "Retrieved %d relevant historical rules for %s snippet.",
            len(matched_rules),
            request.language.value,
        )

        # 2. Execute Vertex AI Gemini review
        review_result = await vertex_reviewer.review_code(
            request=request,
            user_id=user_id,
            matched_rules=matched_rules,
        )

        # 3. Persist to Cloud Firestore
        firestore_service.save_review(review_result)

        return review_result
    except Exception as e:
        logger.error("Failed to process code review: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Code review failed: {str(e)}",
        )


@router.get(
    "/history",
    response_model=List[ReviewResult],
    summary="Retrieve user's historical code reviews",
)
async def get_review_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Fetch past review sessions for the authenticated developer ordered by timestamp desc."""
    user_id = current_user.get("uid", "anonymous")
    history = firestore_service.get_user_reviews(user_id=user_id, limit=limit)
    return history


@router.get(
    "/growth",
    response_model=DeveloperGrowthMetrics,
    summary="Get developer growth tracking and vulnerability patterns",
)
async def get_developer_growth(
    current_user: dict = Depends(get_current_user),
):
    """Aggregate developer growth metrics over time: score trajectory, recurring vulnerability patterns,
    and historical progress analysis.
    """
    user_id = current_user.get("uid", "anonymous")
    growth_metrics = firestore_service.calculate_developer_growth(user_id=user_id)
    return growth_metrics


@router.get(
    "/{review_id}",
    response_model=ReviewResult,
    summary="Retrieve details of a specific code review",
)
async def get_review_details(
    review_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Fetch single review by reviewId from Cloud Firestore."""
    user_id = current_user.get("uid", "anonymous")
    review = firestore_service.get_review_by_id(user_id=user_id, review_id=review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review record '{review_id}' not found.",
        )
    return review
