"""Uvicorn entrypoint: run from backend/ as ``uvicorn main:app --reload --port 8000``."""

from rally.api.app import create_app

app = create_app()
