import pytest
from app.services.rules_engine import RulesEngine
from app.models.rules import RuleEntry


def test_parse_valid_csv_with_header():
    engine = RulesEngine()
    csv_data = """id,type,description
1,formatting,Avoid single-character variable names
2,performance,Cache repeated database lookups
3,security,Never interpolate raw user input directly into SQL queries
"""
    rules = engine.parse_csv_content(csv_data)
    assert len(rules) == 3
    assert rules[0].id == "1"
    assert rules[0].type == "formatting"
    assert "single-character" in rules[0].description
    assert rules[2].id == "3"
    assert rules[2].type == "security"


def test_parse_valid_csv_without_header():
    engine = RulesEngine()
    csv_data = """SEC-101,security,Sanitize all HTML output to prevent XSS
PERF-201,performance,Use bulk batch operations instead of row-by-row queries
"""
    rules = engine.parse_csv_content(csv_data)
    assert len(rules) == 2
    assert rules[0].id == "SEC-101"
    assert rules[1].id == "PERF-201"


def test_parse_csv_with_commas_in_description():
    engine = RulesEngine()
    csv_data = """RULE-42,architecture,Decouple handlers, repositories, and domain models cleanly"""
    rules = engine.parse_csv_content(csv_data)
    assert len(rules) == 1
    assert "Decouple handlers, repositories, and domain models cleanly" in rules[0].description


def test_parse_invalid_csv_raises_error():
    engine = RulesEngine()
    # Row with only 2 columns
    csv_data = """id,type
1,formatting
"""
    with pytest.raises(ValueError):
        engine.parse_csv_content(csv_data)


def test_cosine_similarity_calculation():
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [1.0, 0.0, 0.0]
    vec_c = [0.0, 1.0, 0.0]

    # Identical vectors should have similarity ~1.0
    sim_identical = RulesEngine.cosine_similarity(vec_a, vec_b)
    assert pytest.approx(sim_identical, 0.001) == 1.0

    # Orthogonal vectors should have similarity 0.0
    sim_orthogonal = RulesEngine.cosine_similarity(vec_a, vec_c)
    assert pytest.approx(sim_orthogonal, 0.001) == 0.0


def test_ingest_and_top_k_retrieval():
    engine = RulesEngine()
    csv_data = """1,formatting,Avoid single-character variable names
2,performance,Cache repeated database lookups
3,security,Never interpolate raw user input directly into SQL queries
"""
    ingested = engine.ingest_rules_csv(csv_data)
    assert len(ingested) == 3
    assert all(r.embedding is not None for r in ingested)

    # Query for SQL injection snippet
    sql_snippet = "cursor.execute(f'SELECT * FROM accounts WHERE user = {name}')"
    top_matches = engine.retrieve_top_k(sql_snippet, top_k=2)

    assert len(top_matches) <= 2
    assert top_matches[0].similarity_score is not None
    assert top_matches[0].rule.id in ["1", "2", "3"]
