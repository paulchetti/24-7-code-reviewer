import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import reviews_router, rules_router
from app.services.rules_engine import rules_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("code_reviewer.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup initialization and graceful shutdown."""
    logger.info("Initializing 'The 24/7 Intelligent Code Reviewer' Backend...")
    logger.info("GCP Project ID: %s | Region: %s", settings.GCP_PROJECT_ID, settings.GCP_REGION)
    logger.info("Gemini Model: %s | Embedding Model: %s", settings.GEMINI_MODEL, settings.EMBEDDING_MODEL)
    logger.info("Execution Mode: %s (MOCK_GCP=%s)", settings.ENVIRONMENT, settings.MOCK_GCP)

    # Preload rules from Firestore or memory
    try:
        rules_engine.load_rules_from_firestore()
    except Exception as e:
        logger.warning("Startup rule preloading skipped: %s", e)

    yield
    logger.info("Shutting down 'The 24/7 Intelligent Code Reviewer' Backend.")


app = FastAPI(
    title="The 24/7 Intelligent Code Reviewer API",
    description="Multi-language code review engine powered by Google Cloud Vertex AI (Gemini), text-embedding-004, and Cloud Firestore.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(reviews_router)
app.include_router(rules_router)


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint for Cloud Run container probes."""
    return {
        "status": "healthy",
        "service": "24/7-intelligent-code-reviewer",
        "gcp_project_id": settings.GCP_PROJECT_ID,
        "region": settings.GCP_REGION,
        "gemini_model": settings.GEMINI_MODEL,
        "embedding_model": settings.EMBEDDING_MODEL,
        "mock_mode": settings.MOCK_GCP,
        "rules_cached": len(rules_engine.get_all_rules()),
    }
