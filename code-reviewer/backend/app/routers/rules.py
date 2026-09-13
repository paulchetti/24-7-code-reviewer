import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel

from app.auth import get_current_user
from app.models.rules import RuleEntry, RuleMatch, RuleQueryRequest, RuleUploadResponse
from app.services.rules_engine import rules_engine

logger = logging.getLogger("code_reviewer.routers.rules")
router = APIRouter(prefix="/api/rules", tags=["Historical Rules"])


class DirectRuleTextRequest(BaseModel):
    csv_content: str


@router.post(
    "/upload",
    response_model=RuleUploadResponse,
    summary="Ingest historical engineering guidelines via CSV upload",
)
async def upload_rules_csv(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Upload CSV containing rules with schema: <id>, <type>, <description>.
    Supports both multipart form-data file uploads and JSON { "csv_content": "..." } payloads.
    Generates Vertex AI text-embedding-004 vectors and stores them in Cloud Firestore.
    """
    content = ""
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        if uploaded_file and hasattr(uploaded_file, "read"):
            raw_bytes = await uploaded_file.read()
            content = raw_bytes.decode("utf-8")
        elif form.get("csv_content"):
            content = str(form.get("csv_content"))
    else:
        try:
            body = await request.json()
            content = body.get("csv_content", "")
        except Exception:
            raw_bytes = await request.body()
            content = raw_bytes.decode("utf-8")

    if not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a multipart CSV file or 'csv_content' body is required.",
        )

    try:
        ingested_rules = rules_engine.ingest_rules_csv(content)
        return RuleUploadResponse(
            status="success",
            total_ingested=len(ingested_rules),
            rules=ingested_rules,
            message=f"Successfully ingested and embedded {len(ingested_rules)} historical guidelines with Vertex AI.",
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except Exception as e:
        logger.error("Unexpected error ingesting CSV rules: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rule ingestion failed: {str(e)}",
        )


@router.get("", response_model=List[RuleEntry], summary="List all active historical guidelines")
async def list_rules(current_user: dict = Depends(get_current_user)):
    """Retrieve all historical guidelines currently loaded in Cloud Firestore / memory."""
    rules = rules_engine.get_all_rules()
    return rules


@router.post(
    "/query",
    response_model=List[RuleMatch],
    summary="Semantically retrieve top-k rules for a code snippet",
)
async def query_relevant_rules(
    request: RuleQueryRequest, current_user: dict = Depends(get_current_user)
):
    """Perform cosine similarity vector retrieval against historical guidelines using Vertex AI embeddings."""
    matches = rules_engine.retrieve_top_k(request.code, top_k=request.top_k)
    return matches
