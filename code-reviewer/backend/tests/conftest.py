import os

# Enforce MOCK_GCP for fast, reliable unit & integration tests
os.environ["MOCK_GCP"] = "true"
os.environ["ENVIRONMENT"] = "development"
os.environ["GCP_PROJECT_ID"] = "qwiklabs-gcp-04-a30b79abe2f7"
os.environ["GCP_REGION"] = "us-central1"
