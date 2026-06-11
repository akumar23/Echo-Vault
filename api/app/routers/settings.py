import asyncio

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.core.dependencies import get_current_user
from app.core.encryption import encrypt_token
from app.core.url_guard import OutboundPolicyError, validate_llm_url
from app.database import get_db
from app.models.settings import Settings
from app.models.user import User
from app.schemas.settings import (
    LLMTestRequest,
    LLMTestResponse,
    SettingsResponse,
    SettingsUpdate,
)
from app.services.llm_service import LLMProviderError, LLMService

router = APIRouter()

# Bounds the whole probe so a hung provider can't hold the request open.
# Generous because a cold Ollama model load can take tens of seconds.
TEST_TIMEOUT_SECONDS = 45.0


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("", response_model=SettingsResponse)
async def update_settings(
    settings_data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)

    # Only fields the client explicitly sent (PATCH-style semantics over PUT).
    # Without this, sending `null` to clear a field is indistinguishable from
    # omitting it, so users can never blank out a previously-set URL/model/token.
    update_dict = settings_data.model_dump(exclude_unset=True)
    token_fields = {"generation_api_token", "embedding_api_token"}

    # The saved URLs are fetched server-side by the worker, so a user-supplied
    # endpoint must clear the same SSRF policy as the connection probe.
    for url_field in ("generation_url", "embedding_url"):
        url = update_dict.get(url_field)
        if url:
            try:
                await validate_llm_url(url)
            except OutboundPolicyError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
                )

    for field, value in update_dict.items():
        if field in token_fields:
            setattr(settings, field, encrypt_token(value) if value else None)
        else:
            setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings


def _provider_error_message(exc: LLMProviderError) -> str:
    msg = f"The endpoint responded with HTTP {exc.status_code}."
    if exc.status_code in (401, 403):
        msg += " Check the API token."
    elif exc.status_code == 404:
        msg += " Check the URL and model name."
    detail = (exc.body_snippet or "").strip()
    if detail:
        if len(detail) > 200:
            detail = detail[:200] + "…"
        msg += f" Provider response: {detail}"
    return msg


@router.post("/test-llm", response_model=LLMTestResponse)
async def test_llm_connection(
    payload: LLMTestRequest,
    current_user: User = Depends(get_current_user),
):
    """Probe an LLM endpoint with the given connection values before saving.

    Generation: requests a one-word completion. Embedding: embeds a short
    string and verifies the vector dimension matches the pgvector column
    width (a mismatched embedding model silently breaks semantic search).
    Failures are returned as ok=False with an actionable message, never as
    HTTP errors — a failed probe is a valid result, not a server fault.
    """
    if payload.service_type == "generation":
        base_url = payload.url or app_settings.default_generation_url
        model = payload.model or app_settings.default_generation_model
    else:
        base_url = payload.url or app_settings.default_embedding_url
        model = payload.model or app_settings.default_embedding_model

    # Only a user-supplied URL is attacker-controlled; server defaults are
    # operator-chosen and trusted. Reject disallowed outbound targets before
    # any request is made (and before any response is reflected back).
    if payload.url:
        try:
            await validate_llm_url(payload.url)
        except OutboundPolicyError as exc:
            return LLMTestResponse(ok=False, message=str(exc))

    # Constructed directly rather than via the per-user factories because this
    # must test values the user has typed but not yet saved.
    service = LLMService(
        base_url=base_url,
        model=model,
        api_token=payload.api_token,
        service_type=payload.service_type,
    )

    try:
        if payload.service_type == "generation":
            await asyncio.wait_for(
                service.chat_completion(
                    [{"role": "user", "content": "Reply with the single word: ok"}],
                    temperature=0.0,
                    max_tokens=5,
                ),
                timeout=TEST_TIMEOUT_SECONDS,
            )
            return LLMTestResponse(ok=True, message=f"Connected — {model} responded.")

        embedding = await asyncio.wait_for(
            service.get_embedding("connection test"),
            timeout=TEST_TIMEOUT_SECONDS,
        )
        dim = len(embedding)
        if dim != app_settings.embedding_dim:
            return LLMTestResponse(
                ok=False,
                message=(
                    f"{model} returns {dim}-dimensional vectors, but this server "
                    f"stores {app_settings.embedding_dim}. Semantic search would "
                    f"break — pick a model that produces "
                    f"{app_settings.embedding_dim}-dimensional embeddings "
                    f"(e.g. mxbai-embed-large or voyage-3)."
                ),
            )
        return LLMTestResponse(
            ok=True,
            message=f"Connected — {model} returned {dim}-dimensional embeddings.",
        )
    except LLMProviderError as exc:
        return LLMTestResponse(ok=False, message=_provider_error_message(exc))
    except asyncio.TimeoutError:
        return LLMTestResponse(
            ok=False,
            message=(
                f"Timed out after {int(TEST_TIMEOUT_SECONDS)}s. The endpoint is "
                "reachable but didn't respond — the model may still be loading."
            ),
        )
    except httpx.RequestError:
        return LLMTestResponse(
            ok=False,
            message=(
                "Could not reach the endpoint. Check the URL and that the "
                "service is running and reachable from the EchoVault server."
            ),
        )
    except (ValueError, KeyError):
        return LLMTestResponse(
            ok=False,
            message="The endpoint responded, but not in an OpenAI-compatible format.",
        )
