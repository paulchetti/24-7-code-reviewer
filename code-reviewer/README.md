# The 24/7 Intelligent Code Reviewer
**Code Kitchen Track 01 Hackathon Project**

> Autonomous, multi-language code review and developer growth tracking platform built **exclusively** on Google Cloud Platform (GCP) native services: **Vertex AI (Gemini + text-embedding-004)**, **Cloud Firestore**, **Google Cloud Identity Platform / Firebase Auth**, and **Cloud Run**.

---

## Architecture Overview

```mermaid
graph TD
    User([Developer / Browser])
    Dashboard[Next.js / React + Tailwind CSS Frontend]
    Auth[Google Cloud Identity Platform / Firebase Auth]
    CloudRun[FastAPI Backend on Cloud Run]
    VertexEmbed[Vertex AI: text-embedding-004]
    VertexGemini[Vertex AI: Gemini 1.5 Pro / Flash]
    Firestore[(Google Cloud Firestore)]

    User -->|Access Dashboard| Dashboard
    Dashboard -->|Sign-In / JWT Token| Auth
    Dashboard -->|Submit Code / Upload CSV| CloudRun
    CloudRun -->|Verify Bearer JWT| Auth
    CloudRun -->|1. Vectorize Code & Guidelines| VertexEmbed
    CloudRun -->|2. Retrieve Top-K Guidelines| Firestore
    CloudRun -->|3. Grounded Prompt + Structured Schema| VertexGemini
    CloudRun -->|4. Save Session under users/{uid}/reviews| Firestore
    CloudRun -->|5. Return Quality Scores & Bug Reports| Dashboard
```

---

## Core Features & Capabilities

### 1. Multi-Language Intelligent Code Review Engine
- Multi-language static & semantic analysis supporting **Python**, **JavaScript/TypeScript**, **Go**, **Java**, **C++**, and **Rust**.
- Output includes comprehensive bug reports with **1-indexed line numbers**, **severity grading** (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), remediation advice, and actionable code diffs.
- Architectural guidance and performance/optimization recommendations tailored to the specific language.

### 2. Standardized 1 to 10 Quality Rating Engine
- Enforces deterministic, structured output via Vertex AI's `GenerationConfig(response_mime_type="application/json", response_schema=...)`.
- Evaluates code on a standardized 1.0 to 10.0 scale using a strictly weighted rubric:
  $$\text{Overall Score} = 0.30 \times \text{Correctness} + 0.30 \times \text{Security} + 0.20 \times \text{Performance} + 0.20 \times \text{Maintainability}$$
- Displays a category-by-category breakdown with visual progress meters.

### 3. Historical Review Learning & Grounding (CSV Ingestion)
- Ingests organizational coding guidelines from CSV formatted as:
  ```csv
  <id>, <type>, <description>
  1, formatting, Avoid single-character variable names outside of trivial loop counters
  2, performance, Cache repeated database lookups and expensive calculations
  3, security, Never interpolate raw user input directly into SQL queries; always use parameterized queries
  ```
- Generates 768-dimensional vector embeddings via Vertex AI `text-embedding-004`.
- Stores rules and embeddings in Cloud Firestore collection `rules`.
- Before executing reviews, performs semantic cosine similarity search to retrieve the top-$k$ relevant rules.
- Grounding: Injects matched guidelines into Gemini's system context and requires Gemini to explicitly output `applied_historical_rule_ids` referencing any rules violated.

### 4. Persistent Session History & Developer Growth Tracking
- Records every review in Cloud Firestore under `users/{userId}/reviews/{reviewId}`.
- Tracks developer score trajectories over time across review sessions.
- Identifies recurring vulnerability patterns (e.g. repeated SQL injections or unhandled nil pointers).
- Generates actionable progress summaries and milestone improvements.

### 5. Modern Web Interface
- Responsive dark-mode dashboard built with React and Tailwind CSS.
- **Monaco Editor** with syntax highlighting, language selector, and preloaded security vulnerability test presets.
- **CSV Rule Manager** with file uploader, live preview table, and semantic retrieval tester.
- **Scorecard & Issue Inspector** with severity badges, line jumps, and rule citations.
- **Growth Dashboard** with responsive SVG score progression charts and recurring issue distributions.

---

## Directory Structure

```text
code-reviewer/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # FastAPI entry point & CORS
│   │   ├── config.py                   # GCP project & environment settings
│   │   ├── auth.py                     # Cloud Identity Platform / Firebase Auth JWT verification
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── review.py               # Pydantic models & JSON schemas for Vertex AI
│   │   │   └── rules.py                # Pydantic models for CSV rule entries
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── vertex_reviewer.py      # Vertex AI Gemini review & scoring logic
│   │   │   ├── rules_engine.py         # CSV parser, text-embedding-004 & semantic match
│   │   │   └── firestore_service.py    # User session and history persistence
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── reviews.py              # POST /api/reviews, GET /api/reviews/history, GET /api/reviews/growth
│   │       └── rules.py                # POST /api/rules/upload, GET /api/rules, POST /api/rules/query
│   ├── tests/
│   │   ├── test_rules.py               # CSV parsing, embedding, top-k retrieval tests
│   │   └── test_review_engine.py       # Scoring rubric, Vertex AI prompt & schema validation tests
│   ├── requirements.txt
│   └── Dockerfile                      # Cloud Run container definition
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CodeEditor.tsx          # Monaco multi-language editor
│   │   │   ├── ScoreCard.tsx           # Quality score gauge & breakdown (1-10)
│   │   │   ├── IssuesList.tsx          # Severity-badged issues, rule citations, guidance
│   │   │   ├── RulesUploader.tsx       # CSV uploader & rule management table
│   │   │   ├── GrowthChart.tsx         # Developer trajectory & vulnerability distribution
│   │   │   ├── ReviewHistory.tsx       # Historical reviews explorer
│   │   │   └── Navbar.tsx              # Top navigation & user profile
│   │   ├── lib/
│   │   │   ├── firebase.ts             # Firebase Auth configuration
│   │   │   └── api.ts                  # API client calling FastAPI backend
│   │   ├── App.tsx                     # Main interactive dashboard container
│   │   ├── index.css                   # Tailwind styles, glassmorphism, dark palette
│   │   └── main.tsx                    # React DOM entry
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── index.html
├── scripts/
│   ├── deploy_gcp.sh                   # Automated gcloud deployment to Cloud Run
│   └── seed_rules.csv                  # Sample CSV with rules matching the brief
└── README.md
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Cloud SDK (`gcloud`) with active billing (for live cloud deployment)

### 1. Running the Backend Locally

```bash
cd code-reviewer/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI backend with hot reloading
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Backend endpoints will be available at:
- **API Base**: `http://localhost:8080`
- **Interactive Swagger Docs**: `http://localhost:8080/docs`
- **Health Probe**: `http://localhost:8080/health`

### 2. Running the Frontend Dashboard

```bash
cd code-reviewer/frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## Running the Automated Test Suite

The test suite validates:
1. CSV schema parsing and edge cases (commas in descriptions, missing headers, malformed rows).
2. Embedding vector generation and cosine similarity calculation.
3. Top-$k$ semantic retrieval and ranking.
4. Weighted rubric score calculations (30% Correctness, 30% Security, 20% Performance, 20% Maintainability).
5. Vertex AI OpenAPI 3.0 schema compliance and system instruction grounding.
6. FastAPI endpoints integration (`/health`, `/api/rules/upload`, `/api/reviews`, `/api/reviews/growth`).

Execute tests with `pytest`:

```bash
cd code-reviewer/backend
pytest tests/ -v
```

---

## Deploying to Google Cloud Run

We provide an automated deployment script in `scripts/deploy_gcp.sh` that:
1. Enables necessary Google Cloud APIs (`aiplatform`, `firestore`, `run`, `cloudbuild`, `artifactregistry`, `identitytoolkit`).
2. Configures Artifact Registry Docker repository.
3. Submits container build via Google Cloud Build.
4. Deploys the service to Google Cloud Run with environment variables.
5. Verifies service health and seeds historical guidelines from `scripts/seed_rules.csv`.

```bash
# Make script executable
chmod +x scripts/deploy_gcp.sh

# Run deployment with your GCP Project ID
GCP_PROJECT_ID="your-project-id" GCP_REGION="us-central1" ./scripts/deploy_gcp.sh
```

---

## API Reference

### Code Reviews
- `POST /api/reviews` — Analyze code snippet with Vertex AI Gemini, grounded with top-$k$ historical rules.
- `GET /api/reviews/history` — List past reviews for the authenticated developer.
- `GET /api/reviews/growth` — Calculate developer trajectory, recurring vulnerabilities, and progress commentary.
- `GET /api/reviews/{review_id}` — Fetch detailed review record by ID.

### Historical Rules
- `POST /api/rules/upload` — Ingest CSV file or raw CSV text, compute `text-embedding-004` vectors, and store in Firestore.
- `GET /api/rules` — List all active embedded rules.
- `POST /api/rules/query` — Test semantic cosine similarity retrieval for a code snippet.

---

## Evaluation & Demo Authentication

For frictionless hackathon evaluation, the platform includes a **Demo Developer profile** with preset credentials (`demo-token-12345`), allowing full end-to-end functionality (code reviews, rule uploads, growth analytics) immediately without requiring live Google Cloud Identity Platform login setup. To test with production Google Accounts, click the login icon in the top navigation bar.
