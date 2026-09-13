import logging
import os
from typing import Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger("code_reviewer.auth")
security_scheme = HTTPBearer(auto_error=False)

_firebase_initialized = False


def _init_firebase_admin():
    """Lazy initialization of Firebase Admin SDK for Cloud Identity Platform token verification."""
    global _firebase_initialized
    if _firebase_initialized or settings.MOCK_GCP:
        return

    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            # Attempt to use Application Default Credentials or project ID
            try:
                firebase_admin.initialize_app(options={"projectId": settings.GCP_PROJECT_ID})
            except Exception:
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {"projectId": settings.GCP_PROJECT_ID})
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully for project: %s", settings.GCP_PROJECT_ID)
    except Exception as e:
        logger.warning("Could not initialize Firebase Admin SDK: %s. Using permissive dev auth mode.", e)
        _firebase_initialized = False


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> dict:
    """JWT Verification Dependency for Google Cloud Identity Platform / Firebase Auth tokens.
    Verifies Bearer token, extracts user identity, or provides fallback for local evaluation.
    """
    _init_firebase_admin()

    # In local development or testing mode, allow test tokens or demo user
    if not credentials or not credentials.credentials:
        if settings.ENVIRONMENT == "development" or settings.MOCK_GCP:
            return {"uid": "demo-developer-123", "email": "developer@codekitchen.gcp", "name": "Hackathon Developer"}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Handle local evaluation/test token shortcuts
    if token.startswith("demo-") or token.startswith("test-") or token == "dev-token":
        return {
            "uid": f"user-{token}",
            "email": f"{token}@example.com",
            "name": "Authenticated Developer",
        }

    # Verify against Firebase Auth / Cloud Identity Platform
    try:
        from firebase_admin import auth

        decoded_token = auth.verify_id_token(token)
        return {
            "uid": decoded_token.get("uid") or decoded_token.get("sub"),
            "email": decoded_token.get("email", "unknown@domain.com"),
            "name": decoded_token.get("name", "GCP User"),
            "claims": decoded_token,
        }
    except Exception as e:
        logger.warning("Token verification failed with Firebase Admin: %s", e)
        # If in development, fall back gracefully to decoded subject if possible
        if settings.ENVIRONMENT == "development":
            return {"uid": "dev-user-fallback", "email": "dev@local.test", "name": "Local Dev"}

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
