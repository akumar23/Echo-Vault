"""Tests for the settings router, focused on the LLM connection probe."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings as app_settings
from app.services.llm_service import (
    LLMProviderError,
    LLMService,
    filter_models_for_purpose,
)
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


def test_settings_response_exposes_default_urls(settings_client):
    response = settings_client.get("/settings")
    assert response.status_code == 200
    body = response.json()
    # Used by the onboarding modal to build a deployment-aware "local" preset.
    assert body["default_generation_url"] == app_settings.default_generation_url
    assert body["default_embedding_url"] == app_settings.default_embedding_url


def test_test_llm_blocks_metadata_endpoint(settings_client, monkeypatch):
    # The probe must reject the cloud-metadata service before making any
    # request — it should never reach LLMService.
    def fail_if_called(self, *args, **kwargs):
        raise AssertionError("LLMService must not be called for a blocked URL")

    monkeypatch.setattr(LLMService, "chat_completion", fail_if_called)

    response = settings_client.post(
        "/settings/test-llm",
        json={"service_type": "generation", "url": "http://169.254.169.254"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "169.254.169.254" in body["message"]


def test_update_rejects_metadata_url(settings_client):
    response = settings_client.put(
        "/settings", json={"generation_url": "http://169.254.169.254"}
    )
    assert response.status_code == 400


def test_update_rejects_embedding_metadata_url(settings_client):
    response = settings_client.put(
        "/settings", json={"embedding_url": "http://169.254.169.254"}
    )
    assert response.status_code == 400


def test_list_models_requires_auth():
    with TestClient(app) as client:
        response = client.post("/settings/list-models", json={})
        assert response.status_code == 401


def test_list_models_rejects_invalid_url(settings_client):
    response = settings_client.post(
        "/settings/list-models", json={"url": "not-a-url"}
    )
    assert response.status_code == 422


def test_list_models_success(settings_client, monkeypatch):
    async def fake_list(self):
        return ["gpt-4o-mini", "llama3.1:8b"]

    monkeypatch.setattr(LLMService, "list_models", fake_list)

    response = settings_client.post(
        "/settings/list-models",
        json={"url": "http://localhost:11434"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["models"] == ["gpt-4o-mini", "llama3.1:8b"]
    assert "2 models" in body["message"]


def test_list_models_empty_list(settings_client, monkeypatch):
    async def fake_list(self):
        return []

    monkeypatch.setattr(LLMService, "list_models", fake_list)

    response = settings_client.post("/settings/list-models", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["models"] == []
    assert "no models" in body["message"].lower()


def test_list_models_unreachable_endpoint(settings_client, monkeypatch):
    async def fake_list(self):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(LLMService, "list_models", fake_list)

    response = settings_client.post(
        "/settings/list-models", json={"url": "http://localhost:9999"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["models"] == []
    assert "Could not reach" in body["message"]


def test_list_models_blocks_metadata_endpoint(settings_client, monkeypatch):
    def fail_if_called(self, *args, **kwargs):
        raise AssertionError("LLMService must not be called for a blocked URL")

    monkeypatch.setattr(LLMService, "list_models", fail_if_called)

    response = settings_client.post(
        "/settings/list-models", json={"url": "http://169.254.169.254"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "169.254.169.254" in body["message"]


def test_list_models_404_suggests_manual_entry(settings_client, monkeypatch):
    async def fake_list(self):
        raise LLMProviderError(
            "LLM provider returned 404",
            status_code=404,
            provider_url="https://example.com/v1/models",
        )

    monkeypatch.setattr(LLMService, "list_models", fake_list)

    response = settings_client.post(
        "/settings/list-models", json={"url": "https://example.com"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "/v1/models" in body["message"]
    assert "manually" in body["message"].lower()


def test_list_models_uses_saved_token_when_omitted(settings_client, monkeypatch):
    captured = {}

    async def fake_list(self):
        captured["token"] = self.api_token
        return ["gpt-4o-mini"]

    monkeypatch.setattr(LLMService, "list_models", fake_list)

    save = settings_client.put(
        "/settings", json={"generation_api_token": "sk-saved-token"}
    )
    assert save.status_code == 200

    response = settings_client.post(
        "/settings/list-models", json={"url": "https://api.openai.com"}
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert captured["token"] == "sk-saved-token"


def test_list_models_typed_token_overrides_saved(settings_client, monkeypatch):
    captured = {}

    async def fake_list(self):
        captured["token"] = self.api_token
        return ["gpt-4o-mini"]

    monkeypatch.setattr(LLMService, "list_models", fake_list)

    response = settings_client.post(
        "/settings/list-models",
        json={"url": "https://api.openai.com", "api_token": "sk-typed"},
    )
    assert response.status_code == 200
    assert captured["token"] == "sk-typed"


def test_list_models_unexpected_format(settings_client, monkeypatch):
    async def fake_list(self):
        raise ValueError("Unexpected models response format")

    monkeypatch.setattr(LLMService, "list_models", fake_list)

    response = settings_client.post("/settings/list-models", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "OpenAI-compatible" in body["message"]


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self.status_code = status_code
        self._payload = payload
        self.text = ""

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, payload, status_code=200):
        self._response = _FakeResponse(payload, status_code)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, endpoint, timeout=None):
        return self._response


async def test_llm_service_list_models_parses_openai_format(monkeypatch):
    service = LLMService(base_url="http://localhost:11434", model="unused")
    monkeypatch.setattr(
        service,
        "_create_client",
        lambda: _FakeClient(
            {
                "object": "list",
                "data": [{"id": "b-model"}, {"id": "a-model"}, {"id": "a-model"}],
            }
        ),
    )
    models = await service.list_models()
    assert models == ["a-model", "b-model"]


def test_filter_models_for_purpose_splits_chat_and_embed():
    models = [
        "gpt-4o-mini",
        "llama3.1:8b",
        "text-embedding-3-small",
        "mxbai-embed-large",
        "nomic-embed-text",
    ]
    assert filter_models_for_purpose(models, "generation") == [
        "gpt-4o-mini",
        "llama3.1:8b",
    ]
    assert filter_models_for_purpose(models, "embedding") == [
        "text-embedding-3-small",
        "mxbai-embed-large",
        "nomic-embed-text",
    ]


def test_filter_models_for_purpose_falls_back_when_empty():
    chat_only = ["gpt-4o-mini"]
    assert filter_models_for_purpose(chat_only, "embedding") == chat_only


def test_list_models_embedding_uses_saved_token(settings_client, monkeypatch):
    captured = {}

    async def fake_list(self):
        captured["token"] = self.api_token
        return ["mxbai-embed-large", "llama3.1:8b"]

    monkeypatch.setattr(LLMService, "list_models", fake_list)

    save = settings_client.put(
        "/settings", json={"embedding_api_token": "sk-embed-saved"}
    )
    assert save.status_code == 200

    response = settings_client.post(
        "/settings/list-models",
        json={"service_type": "embedding", "url": "http://localhost:11434"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert captured["token"] == "sk-embed-saved"
    assert body["models"] == ["mxbai-embed-large"]
    assert "embedding model" in body["message"]


async def test_llm_service_list_models_accepts_name_and_strings(monkeypatch):
    service = LLMService(base_url="http://localhost:11434", model="unused")
    monkeypatch.setattr(
        service,
        "_create_client",
        lambda: _FakeClient([{"name": "llama3.1:8b"}, "mistral"]),
    )
    models = await service.list_models()
    assert models == ["llama3.1:8b", "mistral"]


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
