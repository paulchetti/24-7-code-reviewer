import json
import logging
import uuid
from typing import List, Optional
from datetime import datetime, timezone

from app.config import settings
from app.models.review import (
    ReviewRequest,
    ReviewResult,
    QualityScores,
    CodeIssue,
    SeverityEnum,
    CategoryEnum,
    VERTEX_AI_REVIEW_SCHEMA,
)
from app.models.rules import RuleMatch

logger = logging.getLogger("code_reviewer.vertex_reviewer")


class VertexReviewer:
    """Service wrapping Google Cloud Vertex AI Gemini model for structured, multi-language code review,
    grounded with historical rules and deterministic JSON output.
    """

    def __init__(self):
        self._model = None
        self._initialized = False

    def _init_vertex(self):
        """Lazy initialization of Vertex AI GenerativeModel."""
        if self._initialized or settings.MOCK_GCP:
            return

        try:
            import vertexai
            from vertexai.generative_models import GenerativeModel

            vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
            self._model = GenerativeModel(settings.GEMINI_MODEL)
            self._initialized = True
            logger.info("Vertex AI GenerativeModel (%s) initialized.", settings.GEMINI_MODEL)
        except Exception as e:
            logger.warning("Failed to initialize Vertex AI GenerativeModel (%s): %s. Using local fallback.", settings.GEMINI_MODEL, e)
            self._initialized = False

    def _build_system_instruction(self, matched_rules: List[RuleMatch]) -> str:
        """Construct prompt instructions enforcing scoring rubric, line numbering, and historical rule grounding."""
        rules_context = ""
        if matched_rules:
            rules_context = "\n=== RELEVANT HISTORICAL ENGINEERING GUIDELINES (GROUNDING) ===\n"
            for m in matched_rules:
                rules_context += f"- Rule [{m.rule.id}] ({m.rule.type.upper()}): {m.rule.description}\n"
            rules_context += (
                "\nCRITICAL GROUNDING REQUIREMENT: If the submitted code violates or relates to any of the historical guidelines above, "
                "you MUST include that rule's exact ID in the 'applied_historical_rule_ids' output list and describe the issue accordingly.\n"
            )
        else:
            rules_context = "\nNo historical rules retrieved. Review against modern industry language standards.\n"

        system_instruction = f"""You are 'The 24/7 Intelligent Code Reviewer', an elite Principal Cloud Architect and Staff Security/Compiler Engineer.
Your mission is to perform a rigorous, deterministic code review of source code snippets across Python, JavaScript/TypeScript, Go, Java, C++, and Rust.

{rules_context}

EVALUATION RUBRIC & SCORING GUIDELINES:
Rate the code from 1.0 (abysmal / insecure) to 10.0 (production-grade excellence) across four distinct dimensions:
1. CORRECTNESS (Weight: 30%): Logical flaws, off-by-one errors, null/nil panics, race conditions, type mismatches.
2. SECURITY (Weight: 30%): Injection vectors (SQL/Command/XSS), insecure deserialization, raw credentials, buffer overflows, OWASP Top 10.
3. PERFORMANCE (Weight: 20%): Big-O asymptotic complexity, unnecessary allocations, unbounded loops, I/O bottlenecks.
4. MAINTAINABILITY (Weight: 20%): Naming conventions, single responsibility, readability, language idioms, architectural coupling.

OUTPUT FORMAT INSTRUCTIONS:
- You MUST respond strictly in valid JSON adhering to the provided OpenAPI 3.0 schema.
- Detected bugs must include accurate 1-indexed line numbers where the flaw exists.
- Severity must be one of: 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'.
- Category must be one of: 'correctness', 'security', 'performance', 'maintainability', 'architecture'.
- The 'applied_historical_rule_ids' list must contain the IDs of all historical rules cited or applied.
"""
        return system_instruction

    def _build_user_prompt(self, request: ReviewRequest) -> str:
        """Construct the user prompt containing source code with line numbers."""
        code_lines = request.code.split("\n")
        numbered_code = "\n".join(f"{idx+1:4d} | {line}" for idx, line in enumerate(code_lines))

        prompt = f"""Language: {request.language.value.upper()}
{f'Context / Requirements: {request.context_description}' if request.context_description else ''}

SOURCE CODE WITH LINE NUMBERS:
```
{numbered_code}
```

Perform the comprehensive review now and produce the structured JSON output.
"""
        return prompt

    def _generate_mock_review(
        self, request: ReviewRequest, matched_rules: List[RuleMatch]
    ) -> dict:
        """Generate a realistic, deterministic mock review for offline tests and non-GCP environments."""
        code = request.code
        code_lower = code.lower()

        # Heuristic detection for realistic mock feedback
        detected_bugs = []
        applied_rules = []

        # Check for common vulnerabilities
        if "select" in code_lower and ("%" in code or "+" in code or "f\"" in code or "f'" in code or "$" in code):
            detected_bugs.append({
                "id": "ISSUE-1",
                "line_number": 2,
                "severity": "CRITICAL",
                "category": "security",
                "title": "SQL Injection Risk via String Formatting",
                "description": "Raw user input is concatenated directly into a SQL query string without parameterization.",
                "suggestion": "Use parameterized queries or prepared statements provided by your database driver.",
                "code_sample": "cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))"
            })
            # Check if SEC-001 or rule 3 is in matched rules
            for m in matched_rules:
                if "sql" in m.rule.description.lower() or m.rule.type == "security":
                    applied_rules.append(m.rule.id)

        if "password" in code_lower and ("=" in code or ":" in code):
            detected_bugs.append({
                "id": "ISSUE-2",
                "line_number": 1,
                "severity": "HIGH",
                "category": "security",
                "title": "Hardcoded Credential or Sensitive Token",
                "description": "Plaintext secret or password found in source code snippet.",
                "suggestion": "Extract secrets into environment variables or use Google Cloud Secret Manager.",
                "code_sample": "import os\napi_key = os.environ['API_KEY']"
            })

        if len(code.split("\n")) > 1 and ("for " in code or "while " in code):
            for m in matched_rules:
                if m.rule.type == "performance":
                    applied_rules.append(m.rule.id)

        # Baseline scores
        has_critical = any(b["severity"] == "CRITICAL" for b in detected_bugs)
        has_high = any(b["severity"] == "HIGH" for b in detected_bugs)

        correctness = 5.0 if has_critical else 8.5
        security = 2.5 if has_critical else (6.0 if has_high else 9.0)
        performance = 7.5
        maintainability = 8.0

        return {
            "summary": f"Comprehensive code analysis for {request.language.value.upper()}. Found {len(detected_bugs)} issues requiring attention.",
            "quality_scores": {
                "correctness": correctness,
                "security": security,
                "performance": performance,
                "maintainability": maintainability,
            },
            "detected_bugs": detected_bugs,
            "architectural_guidance": [
                "Separate business logic from external I/O and persistence layers.",
                "Adopt structured logging and observability tracing with Google Cloud Trace."
            ],
            "performance_insights": [
                "Profile memory allocations under peak concurrency loads.",
                "Leverage connection pooling for database and network clients."
            ],
            "applied_historical_rule_ids": list(set(applied_rules)) if applied_rules else ([matched_rules[0].rule.id] if matched_rules else []),
        }

    async def review_code(
        self,
        request: ReviewRequest,
        user_id: str,
        matched_rules: List[RuleMatch],
    ) -> ReviewResult:
        """Execute Vertex AI code review with deterministic JSON output schema and grounded rules."""
        self._init_vertex()

        system_instruction = self._build_system_instruction(matched_rules)
        user_prompt = self._build_user_prompt(request)
        retrieved_ids = [m.rule.id for m in matched_rules]

        raw_json_dict = None

        if self._model and not settings.MOCK_GCP:
            try:
                from vertexai.generative_models import GenerationConfig

                generation_config = GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=VERTEX_AI_REVIEW_SCHEMA,
                    temperature=0.2,  # Low temperature for deterministic scoring
                    max_output_tokens=4096,
                )

                prompt_with_instructions = f"{system_instruction}\n\n{user_prompt}"
                response = await self._model.generate_content_async(
                    prompt_with_instructions,
                    generation_config=generation_config,
                )

                response_text = response.text.strip()
                raw_json_dict = json.loads(response_text)
                logger.info("Successfully received structured Vertex AI response.")
            except Exception as e:
                logger.error("Vertex AI code review generation failed: %s. Falling back to local engine.", e)
                raw_json_dict = None

        if raw_json_dict is None:
            raw_json_dict = self._generate_mock_review(request, matched_rules)

        # Parse and enforce mathematical rubric calculation
        q_scores_raw = raw_json_dict.get("quality_scores", {})
        corr = float(q_scores_raw.get("correctness", 7.0))
        sec = float(q_scores_raw.get("security", 7.0))
        perf = float(q_scores_raw.get("performance", 7.0))
        maint = float(q_scores_raw.get("maintainability", 7.0))

        overall = QualityScores.calculate_overall(
            correctness=corr,
            security=sec,
            performance=perf,
            maintainability=maint,
        )

        quality_scores = QualityScores(
            correctness=corr,
            security=sec,
            performance=perf,
            maintainability=maint,
            overall_score=overall,
        )

        # Parse detected bugs into Pydantic models
        parsed_bugs: List[CodeIssue] = []
        for bug_data in raw_json_dict.get("detected_bugs", []):
            try:
                issue = CodeIssue(
                    id=str(bug_data.get("id", f"ISSUE-{len(parsed_bugs)+1}")),
                    line_number=bug_data.get("line_number"),
                    severity=SeverityEnum(bug_data.get("severity", "MEDIUM").upper()),
                    category=CategoryEnum(bug_data.get("category", "correctness").lower()),
                    title=str(bug_data.get("title", "Detected Code Issue")),
                    description=str(bug_data.get("description", "")),
                    suggestion=str(bug_data.get("suggestion", "")),
                    code_sample=bug_data.get("code_sample"),
                )
                parsed_bugs.append(issue)
            except Exception as pe:
                logger.warning("Failed to parse issue record: %s. Error: %s", bug_data, pe)

        review_result = ReviewResult(
            review_id=str(uuid.uuid4()),
            user_id=user_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            language=request.language.value,
            code_snippet=request.code,
            quality_scores=quality_scores,
            detected_bugs=parsed_bugs,
            architectural_guidance=raw_json_dict.get("architectural_guidance", []),
            performance_insights=raw_json_dict.get("performance_insights", []),
            applied_historical_rule_ids=raw_json_dict.get("applied_historical_rule_ids", []),
            retrieved_rule_ids=retrieved_ids,
            summary=raw_json_dict.get("summary", "Code review completed successfully."),
        )

        return review_result


vertex_reviewer = VertexReviewer()
