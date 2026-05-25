"""Pytest hooks — set ENCRYPTION_KEY before any test module imports the app."""

import os

# Deterministic Fernet key for tests only. Do not use in production.
_TEST_ENCRYPTION_KEY = "pNBVy1hvmXnD_leliL5aeBq_gXUxZh7cKEXks7f9zP4="

os.environ.setdefault("ENCRYPTION_KEY", _TEST_ENCRYPTION_KEY)

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def auth_client():
    """Authenticated TestClient (cookie-based session)."""
    with TestClient(app) as session_client:
        session_client.post(
            "/auth/register",
            json={
                "email": "entries@example.com",
                "username": "entriesuser",
                "password": "testpass123",
            },
        )
        session_client.post(
            "/auth/login",
            json={"email": "entries@example.com", "password": "testpass123"},
        )
        yield session_client
