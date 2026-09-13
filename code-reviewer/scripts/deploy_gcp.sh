#!/usr/bin/env bash
# ==============================================================================
# The 24/7 Intelligent Code Reviewer - Automated GCP Deployment Script
# Tracks: Code Kitchen Track 01 Hackathon
# Services: Cloud Run, Vertex AI (Gemini + text-embedding-004), Cloud Firestore
# ==============================================================================

set -euo pipefail

# Configuration Defaults (Override via environment variables)
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo '')}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-code-reviewer-backend}"
AR_REPO="${AR_REPO:-code-reviewer-repo}"
IMAGE_TAG="latest"

echo "======================================================================"
echo " Starting GCP Deployment for 'The 24/7 Intelligent Code Reviewer'"
echo "======================================================================"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: No GCP Project ID specified or configured in gcloud."
  echo "Usage: GCP_PROJECT_ID=your-project-id ./deploy_gcp.sh"
  exit 1
fi

echo "Target Project: ${PROJECT_ID}"
echo "Target Region:  ${REGION}"
echo "Cloud Run Svc:  ${SERVICE_NAME}"
echo ""

# 1. Enable Required GCP APIs
echo "==> [1/6] Enabling Required Google Cloud APIs..."
gcloud services enable \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  identitytoolkit.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Configure Artifact Registry
echo "==> [2/6] Ensuring Artifact Registry Docker repository exists..."
if ! gcloud artifacts repositories describe "${AR_REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Creating Artifact Registry repository: ${AR_REPO} in ${REGION}..."
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Docker repository for 24/7 Intelligent Code Reviewer" \
    --project="${PROJECT_ID}"
else
  echo "Artifact Registry repository '${AR_REPO}' already exists."
fi

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE_NAME}:${IMAGE_TAG}"

# 3. Build & Push Image via Cloud Build
echo "==> [3/6] Building container image via Cloud Build..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="${REPO_ROOT}/code-reviewer/backend"

if [ ! -d "${BACKEND_DIR}" ]; then
  # Fallback check
  BACKEND_DIR="${REPO_ROOT}/backend"
fi

echo "Source context: ${BACKEND_DIR}"
gcloud builds submit "${BACKEND_DIR}" \
  --tag="${IMAGE_URI}" \
  --project="${PROJECT_ID}"

# 4. Deploy to Cloud Run
echo "==> [4/6] Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_URI}" \
  --platform=managed \
  --region="${REGION}" \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},GEMINI_MODEL=gemini-1.5-flash,EMBEDDING_MODEL=text-embedding-004,ENVIRONMENT=production,MOCK_GCP=false" \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=120 \
  --project="${PROJECT_ID}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)')

echo "==> [5/6] Verifying Cloud Run Service Health..."
echo "Service URL: ${SERVICE_URL}"
curl -s "${SERVICE_URL}/health" | grep -q "healthy" && echo "Service is healthy!" || echo "Warning: Health probe did not return healthy status yet."

# 5. Seed Historical Rules
echo "==> [6/6] Seeding Historical Guidelines from scripts/seed_rules.csv..."
SEED_FILE="${SCRIPT_DIR}/seed_rules.csv"
if [ -f "$SEED_FILE" ]; then
  CSV_CONTENT=$(cat "$SEED_FILE")
  curl -s -X POST "${SERVICE_URL}/api/rules/upload" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer demo-token" \
    -d "$(jq -n --arg content "$CSV_CONTENT" '{csv_content: $content}')" || true
  echo "Seed rules upload triggered."
fi

echo ""
echo "======================================================================"
echo " DEPLOYMENT COMPLETE!"
echo " Service Endpoint: ${SERVICE_URL}"
echo " API Docs:         ${SERVICE_URL}/docs"
echo " Health Status:    ${SERVICE_URL}/health"
echo "======================================================================"
