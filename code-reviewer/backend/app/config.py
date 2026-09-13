import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings backed by environment variables."""

    # GCP Core Configuration
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "qwiklabs-gcp-04-a30b79abe2f7")
    GCP_REGION: str = os.getenv("GCP_REGION", "us-central1")

    # Vertex AI Configuration
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")

    # Firestore Configuration
    FIRESTORE_DATABASE: str = os.getenv("FIRESTORE_DATABASE", "(default)")

    # Environment and Execution Mode
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    MOCK_GCP: bool = os.getenv("MOCK_GCP", "false").lower() in ("true", "1", "yes")

    # Security & CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*",
    ]

    # Weighted Rubric for Quality Scoring (Must sum to 1.0)
    WEIGHT_CORRECTNESS: float = 0.30
    WEIGHT_SECURITY: float = 0.30
    WEIGHT_PERFORMANCE: float = 0.20
    WEIGHT_MAINTAINABILITY: float = 0.20

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
