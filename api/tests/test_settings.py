"""Tests for the settings router, focused on the LLM connection probe."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings as app_settings
from app.services.llm_service import LLMProviderError, LLMService
from main import app


@pytest.fixture(scope="module")
def settings_client():
    """Module-scoped authenticated client.

    Logs in once for the whole module — the per-test auth_client fixture
    trips the 5/minute login rate limit with this many tests.
    """
    with TestClient(app) as session_client:
        session_client.post(
            "/auth/register",
            json={
                "email": "settings@example.com",
                "username": "settingsuser",
                "password": "testpass123",
            },
        )
        session_client.post(
            "/auth/login",
            json={"email": "settings@example.com", "password": "testpass123"},
        )
        yield session_client


def test_update_marks_onboarding_completed(settings_client):
    response = settings_client.put("/settings", json={"onboarding_completed": True})
    assert response.status_code == 200
    assert response.json()["onboarding_completed"] is True


def test_test_llm_requires_auth():
    with TestClient(app) as client:
        response = client.post(
            "/settings/test-llm", json={"service_type": "generation"}
        )
        assert response.status_code == 401


def test_test_llm_rejects_invalid_url(settings_client):
    response = settings_client.post(
        "/settings/test-llm",
        json={"service_type": "generation", "url": "not-a-url"},
    )
    assert response.status_code == 422


def test_test_llm_generation_success(settings_client, monkeypatch):
    async def fake_chat(self, messages, temperature=0.7, max_tokens=None):
        return "ok"

    monkeypatch.setattr(LLMService, "chat_completion", fake_chat)

    response = settings_client.post(
        "/settings/test-llm",
        json={
            "service_type": "generation",
            "url": "http://localhost:11434",
            "model": "llama3.1:8b",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert "llama3.1:8b" in body["message"]


def test_test_llm_embedding_success(settings_client, monkeypatch):
    async def fake_embed(self, text, input_type=None):
        return [0.0] * app_settings.embedding_dim

    monkeypatch.setattr(LLMService, "get_embedding", fake_embed)

    response = settings_client.post(
        "/settings/test-llm",
        json={"service_type": "embedding", "model": "mxbai-embed-large"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert str(app_settings.embedding_dim) in body["message"]


def test_test_llm_embedding_dimension_mismatch(settings_client, monkeypatch):
    wrong_dim = app_settings.embedding_dim + 512

    async def fake_embed(self, text, input_type=None):
        return [0.0] * wrong_dim

    monkeypatch.setattr(LLMService, "get_embedding", fake_embed)

    response = settings_client.post(
        "/settings/test-llm",
        json={"service_type": "embedding", "model": "text-embedding-3-small"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert str(wrong_dim) in body["message"]
    assert str(app_settings.embedding_dim) in body["message"]


def test_test_llm_unreachable_endpoint(settings_client, monkeypatch):
    async def fake_chat(self, messages, temperature=0.7, max_tokens=None):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(LLMService, "chat_completion", fake_chat)

    response = settings_client.post(
        "/settings/test-llm",
        json={"service_type": "generation", "url": "http://localhost:9999"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "Could not reach" in body["message"]


def test_test_llm_auth_error_mentions_token(settings_client, monkeypatch):
    async def fake_chat(self, messages, temperature=0.7, max_tokens=None):
        raise LLMProviderError(
            "LLM provider returned 401",
            status_code=401,
            provider_url="https://api.openai.com/v1/chat/completions",
            body_snippet='{"error": "invalid api key"}',
        )

    monkeypatch.setattr(LLMService, "chat_completion", fake_chat)

    response = settings_client.post(
        "/settings/test-llm",
        json={
            "service_type": "generation",
            "url": "https://api.openai.com",
            "api_token": "bad-token",
            "model": "gpt-4o-mini",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "401" in body["message"]
    assert "token" in body["message"].lower()
