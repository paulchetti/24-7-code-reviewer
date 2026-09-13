import csv
import io
import logging
import math
from typing import List, Optional, Tuple
import numpy as np

from app.config import settings
from app.models.rules import RuleEntry, RuleMatch

logger = logging.getLogger("code_reviewer.rules_engine")


class RulesEngine:
    """Service for parsing CSV historical rules, computing embeddings with Vertex AI text-embedding-004,
    and performing top-k semantic retrieval against source code snippets.
    """

    def __init__(self):
        self._rules_cache: List[RuleEntry] = []
        self._embedding_model = None
        self._vertex_initialized = False

    def _init_vertex(self):
        """Lazy initialization of Vertex AI embedding model."""
        if self._vertex_initialized or settings.MOCK_GCP:
            return

        try:
            import vertexai
            from vertexai.language_models import TextEmbeddingModel

            vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
            self._embedding_model = TextEmbeddingModel.from_pretrained(settings.EMBEDDING_MODEL)
            self._vertex_initialized = True
            logger.info("Vertex AI TextEmbeddingModel (%s) initialized.", settings.EMBEDDING_MODEL)
        except Exception as e:
            logger.warning("Failed to initialize Vertex AI Embedding Model (%s). Using fallback embeddings.", e)
            self._vertex_initialized = False

    def _generate_mock_embedding(self, text: str, dim: int = 768) -> List[float]:
        """Generate a deterministic pseudo-random normalized vector for local testing / offline mode."""
        import hashlib

        # Create a deterministic seed from text
        hasher = hashlib.sha256(text.encode("utf-8"))
        seed = int(hasher.hexdigest()[:8], 16)
        rng = np.random.RandomState(seed)
        vec = rng.randn(dim).astype(np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def get_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for the provided text using Vertex AI text-embedding-004."""
        self._init_vertex()

        if self._embedding_model and not settings.MOCK_GCP:
            try:
                embeddings = self._embedding_model.get_embeddings([text])
                return embeddings[0].values
            except Exception as e:
                logger.error("Vertex AI embedding generation error: %s. Falling back to local vector.", e)

        return self._generate_mock_embedding(text)

    def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Batch embedding generation with Vertex AI text-embedding-004."""
        self._init_vertex()

        if self._embedding_model and not settings.MOCK_GCP and texts:
            try:
                # Vertex AI batch size limit is typically 250
                results = []
                batch_size = 100
                for i in range(0, len(texts), batch_size):
                    batch = texts[i : i + batch_size]
                    batch_embeddings = self._embedding_model.get_embeddings(batch)
                    results.extend([emb.values for emb in batch_embeddings])
                return results
            except Exception as e:
                logger.error("Vertex AI batch embedding error: %s. Falling back to mock embeddings.", e)

        return [self._generate_mock_embedding(t) for t in texts]

    def parse_csv_content(self, csv_content: str) -> List[RuleEntry]:
        """Parse and validate CSV containing schema: <id>, <type>, <description>.
        Supports both header and non-header formats.
        """
        rules: List[RuleEntry] = []
        reader = csv.reader(io.StringIO(csv_content.strip()))

        first_row = True
        for row_idx, row in enumerate(reader, start=1):
            if not row:
                continue

            # Strip all whitespace from cells
            cleaned = [c.strip() for c in row if c.strip() != ""]
            if not cleaned:
                continue

            # Handle header detection
            if first_row:
                first_row = False
                lower_row = [c.lower() for c in cleaned]
                if "id" in lower_row and ("type" in lower_row or "description" in lower_row):
                    logger.debug("Skipping CSV header row: %s", cleaned)
                    continue

            if len(cleaned) < 3:
                raise ValueError(
                    f"Invalid CSV row {row_idx}: expected at least 3 columns (<id>, <type>, <description>), got {len(cleaned)}: {row}"
                )

            rule_id = cleaned[0]
            rule_type = cleaned[1].lower()
            # Join any additional comma-separated content back into description
            rule_desc = ", ".join(cleaned[2:])

            if not rule_id or not rule_type or not rule_desc:
                raise ValueError(f"Empty required field on CSV row {row_idx}: {row}")

            rules.append(RuleEntry(id=rule_id, type=rule_type, description=rule_desc))

        if not rules:
            raise ValueError("CSV contained no valid rule entries.")

        return rules

    def ingest_rules_csv(self, csv_content: str) -> List[RuleEntry]:
        """Ingest rules from CSV string, compute embeddings, and cache in memory / Firestore."""
        parsed_rules = self.parse_csv_content(csv_content)

        # Batch compute embeddings
        descriptions = [f"Rule category: {r.type}. Instruction: {r.description}" for r in parsed_rules]
        embeddings = self.get_embeddings_batch(descriptions)

        for rule, emb in zip(parsed_rules, embeddings):
            rule.embedding = emb

        # Update cache (merge by ID)
        existing_ids = {r.id: idx for idx, r in enumerate(self._rules_cache)}
        for rule in parsed_rules:
            if rule.id in existing_ids:
                self._rules_cache[existing_ids[rule.id]] = rule
            else:
                self._rules_cache.append(rule)

        # Persist to Firestore if available
        self._persist_to_firestore(parsed_rules)

        logger.info("Successfully ingested and embedded %d rules.", len(parsed_rules))
        return parsed_rules

    def _persist_to_firestore(self, rules: List[RuleEntry]):
        """Persist rules and their embeddings to Cloud Firestore."""
        if settings.MOCK_GCP:
            return

        try:
            from google.cloud import firestore

            db = firestore.Client(project=settings.GCP_PROJECT_ID, database=settings.FIRESTORE_DATABASE)
            batch = db.batch()
            for rule in rules:
                doc_ref = db.collection("rules").document(rule.id)
                batch.set(doc_ref, rule.model_dump())
            batch.commit()
            logger.info("Persisted %d rules to Firestore 'rules' collection.", len(rules))
        except Exception as e:
            logger.warning("Could not persist rules to Firestore (using in-memory): %s", e)

    def load_rules_from_firestore(self) -> List[RuleEntry]:
        """Load stored rules and embeddings from Cloud Firestore."""
        if settings.MOCK_GCP:
            return self._rules_cache

        try:
            from google.cloud import firestore

            db = firestore.Client(project=settings.GCP_PROJECT_ID, database=settings.FIRESTORE_DATABASE)
            docs = db.collection("rules").stream()
            loaded = []
            for doc in docs:
                data = doc.to_dict()
                loaded.append(RuleEntry(**data))
            if loaded:
                self._rules_cache = loaded
                logger.info("Loaded %d rules from Firestore.", len(loaded))
            return self._rules_cache
        except Exception as e:
            logger.warning("Could not load rules from Firestore: %s", e)
            return self._rules_cache

    def get_all_rules(self) -> List[RuleEntry]:
        """Return all active historical rules."""
        if not self._rules_cache:
            self.load_rules_from_firestore()
        return self._rules_cache

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Compute cosine similarity between two float vectors."""
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def retrieve_top_k(self, code_snippet: str, top_k: int = 5) -> List[RuleMatch]:
        """Semantically retrieve the top-k most relevant historical guidelines for a code snippet."""
        all_rules = self.get_all_rules()
        if not all_rules:
            return []

        # Generate embedding for the code snippet
        code_query = f"Analyze source code for coding standards and anti-patterns:\n{code_snippet[:2000]}"
        code_vec = self.get_embedding(code_query)

        scored_rules: List[RuleMatch] = []
        for rule in all_rules:
            if not rule.embedding:
                rule.embedding = self.get_embedding(f"{rule.type}: {rule.description}")

            score = self.cosine_similarity(code_vec, rule.embedding)
            scored_rules.append(RuleMatch(rule=rule, similarity_score=score))

        # Sort descending by similarity score
        scored_rules.sort(key=lambda x: x.similarity_score, reverse=True)
        return scored_rules[:top_k]


rules_engine = RulesEngine()
