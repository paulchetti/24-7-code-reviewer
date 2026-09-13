import logging
from typing import Dict, List, Optional
from collections import Counter
from datetime import datetime

from app.config import settings
from app.models.review import ReviewResult, DeveloperGrowthMetrics

logger = logging.getLogger("code_reviewer.firestore_service")


class FirestoreService:
    """Service handling Cloud Firestore persistence under users/{userId}/reviews/{reviewId}
    and calculating developer growth metrics and recurring vulnerability patterns.
    """

    def __init__(self):
        self._db = None
        self._initialized = False
        # In-memory storage for offline / testing mode
        self._memory_store: Dict[str, Dict[str, ReviewResult]] = {}

    def _init_firestore(self):
        """Lazy initialization of Google Cloud Firestore client."""
        if self._initialized or settings.MOCK_GCP:
            return

        try:
            from google.cloud import firestore

            self._db = firestore.Client(
                project=settings.GCP_PROJECT_ID,
                database=settings.FIRESTORE_DATABASE,
            )
            self._initialized = True
            logger.info("Connected to Cloud Firestore database: %s", settings.FIRESTORE_DATABASE)
        except Exception as e:
            logger.warning("Failed to initialize Cloud Firestore: %s. Using in-memory store.", e)
            self._initialized = False

    def save_review(self, review: ReviewResult) -> None:
        """Persist review result under users/{userId}/reviews/{reviewId}."""
        user_id = review.user_id
        review_id = review.review_id

        # Always update memory store
        if user_id not in self._memory_store:
            self._memory_store[user_id] = {}
        self._memory_store[user_id][review_id] = review

        self._init_firestore()
        if self._db and not settings.MOCK_GCP:
            try:
                doc_ref = (
                    self._db.collection("users")
                    .document(user_id)
                    .collection("reviews")
                    .document(review_id)
                )
                doc_ref.set(review.model_dump())
                logger.info("Saved review %s for user %s to Cloud Firestore.", review_id, user_id)
            except Exception as e:
                logger.error("Error persisting review to Firestore: %s", e)

    def get_user_reviews(self, user_id: str, limit: int = 50) -> List[ReviewResult]:
        """Fetch all reviews for a user ordered by timestamp descending."""
        self._init_firestore()

        if self._db and not settings.MOCK_GCP:
            try:
                from google.cloud import firestore

                reviews_ref = (
                    self._db.collection("users")
                    .document(user_id)
                    .collection("reviews")
                    .order_by("timestamp", direction=firestore.Query.DESCENDING)
                    .limit(limit)
                )
                docs = reviews_ref.stream()
                results = [ReviewResult(**doc.to_dict()) for doc in docs]
                if results:
                    return results
            except Exception as e:
                logger.error("Error retrieving user reviews from Firestore: %s", e)

        # Fallback to in-memory store
        user_reviews = list(self._memory_store.get(user_id, {}).values())
        user_reviews.sort(key=lambda r: r.timestamp, reverse=True)
        return user_reviews[:limit]

    def get_review_by_id(self, user_id: str, review_id: str) -> Optional[ReviewResult]:
        """Retrieve a specific review record by ID."""
        self._init_firestore()

        if self._db and not settings.MOCK_GCP:
            try:
                doc_ref = (
                    self._db.collection("users")
                    .document(user_id)
                    .collection("reviews")
                    .document(review_id)
                )
                doc = doc_ref.get()
                if doc.exists:
                    return ReviewResult(**doc.to_dict())
            except Exception as e:
                logger.error("Error fetching review %s from Firestore: %s", review_id, e)

        return self._memory_store.get(user_id, {}).get(review_id)

    def calculate_developer_growth(self, user_id: str) -> DeveloperGrowthMetrics:
        """Compute score trajectory, recurring vulnerability patterns, and historical progress."""
        reviews = self.get_user_reviews(user_id, limit=100)

        if not reviews:
            return DeveloperGrowthMetrics(
                user_id=user_id,
                total_reviews=0,
                average_overall_score=0.0,
                score_trajectory=[],
                vulnerability_patterns={},
                applied_rules_frequency={},
                historical_progress_summary="No reviews yet. Submit code to track your development growth!",
            )

        # Reverse so trajectory is chronological (oldest to newest)
        chronological_reviews = list(reversed(reviews))

        total_reviews = len(reviews)
        overall_sum = sum(r.quality_scores.overall_score for r in reviews)
        avg_score = round(overall_sum / total_reviews, 2)

        # Score trajectory over time
        trajectory = []
        for r in chronological_reviews:
            trajectory.append({
                "review_id": r.review_id,
                "timestamp": r.timestamp,
                "overall_score": r.quality_scores.overall_score,
                "correctness": r.quality_scores.correctness,
                "security": r.quality_scores.security,
                "performance": r.quality_scores.performance,
                "maintainability": r.quality_scores.maintainability,
                "language": r.language,
            })

        # Vulnerability patterns (grouped by category & severity)
        vuln_counter = Counter()
        rule_counter = Counter()

        for r in reviews:
            for bug in r.detected_bugs:
                cat_key = f"{bug.category.value.capitalize()} ({bug.severity.value})"
                vuln_counter[cat_key] += 1
            for rule_id in r.applied_historical_rule_ids:
                rule_counter[rule_id] += 1

        # Calculate progress commentary
        first_score = chronological_reviews[0].quality_scores.overall_score
        latest_score = chronological_reviews[-1].quality_scores.overall_score
        score_diff = round(latest_score - first_score, 1)

        most_common_vuln = vuln_counter.most_common(1)
        top_vuln_text = (
            f"Most frequent pitfall: {most_common_vuln[0][0]} ({most_common_vuln[0][1]} occurrences)."
            if most_common_vuln
            else "No recurring vulnerabilities detected."
        )

        trend_text = (
            f"Your score has improved by +{score_diff} points since your first review!"
            if score_diff > 0
            else (
                f"Your score is down {abs(score_diff)} points from initial baseline."
                if score_diff < 0
                else "Your quality score has remained steady."
            )
        )

        progress_summary = (
            f"Completed {total_reviews} reviews with an average score of {avg_score}/10.0. "
            f"{trend_text} {top_vuln_text}"
        )

        return DeveloperGrowthMetrics(
            user_id=user_id,
            total_reviews=total_reviews,
            average_overall_score=avg_score,
            score_trajectory=trajectory,
            vulnerability_patterns=dict(vuln_counter),
            applied_rules_frequency=dict(rule_counter),
            historical_progress_summary=progress_summary,
        )


firestore_service = FirestoreService()
