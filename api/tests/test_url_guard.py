"""Tests for the outbound URL policy (SSRF guard) on LLM endpoints.

These are DB-free and run without the Docker stack — they exercise the policy
directly via literal IPs (so no external DNS is required).
"""

import pytest

from app.core.config import settings as app_settings
from app.core.url_guard import OutboundPolicyError, validate_llm_url


@pytest.fixture(autouse=True)
def reset_policy(monkeypatch):
    """Default to the permissive (self-hosted) policy unless a test overrides it."""
    monkeypatch.setattr(app_settings, "restrict_llm_endpoints", False)


async def test_metadata_ip_always_blocked():
    # 169.254.169.254 is the cloud metadata service — link-local, never allowed.
    with pytest.raises(OutboundPolicyError) as exc:
        await validate_llm_url("http://169.254.169.254")
    assert "link-local/metadata" in str(exc.value)


async def test_loopback_allowed_by_default():
    # The headline use case: a local Ollama. Must work out of the box.
    await validate_llm_url("http://127.0.0.1:11434")
    await validate_llm_url("http://[::1]:11434")


async def test_private_allowed_by_default():
    await validate_llm_url("http://10.0.0.5:11434")


async def test_private_blocked_when_restricted(monkeypatch):
    monkeypatch.setattr(app_settings, "restrict_llm_endpoints", True)
    with pytest.raises(OutboundPolicyError) as exc:
        await validate_llm_url("http://10.0.0.5:11434")
    assert "loopback/private" in str(exc.value)


async def test_loopback_blocked_when_restricted(monkeypatch):
    monkeypatch.setattr(app_settings, "restrict_llm_endpoints", True)
    with pytest.raises(OutboundPolicyError):
        await validate_llm_url("http://127.0.0.1:11434")


async def test_metadata_blocked_even_when_unrestricted(monkeypatch):
    monkeypatch.setattr(app_settings, "restrict_llm_endpoints", True)
    with pytest.raises(OutboundPolicyError) as exc:
        await validate_llm_url("http://169.254.169.254")
    assert "link-local/metadata" in str(exc.value)


async def test_url_without_host_rejected():
    with pytest.raises(OutboundPolicyError):
        await validate_llm_url("http://")


async def test_unresolvable_host_rejected():
    # `.invalid` is reserved by RFC 6761 to never resolve — no real DNS needed.
    with pytest.raises(OutboundPolicyError) as exc:
        await validate_llm_url("http://does-not-exist.invalid")
    assert "resolve" in str(exc.value).lower()
