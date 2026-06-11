from pydantic import BaseModel, field_validator, model_validator
from typing import Literal, Optional
import re

from app.core.config import settings as _app_settings

_URL_PATTERN = re.compile(
    r'^https?://'
    r'[^\s/$.?#].'
    r'[^\s]*$',
    re.IGNORECASE
)


def _validate_optional_url(v: Optional[str]) -> Optional[str]:
    if v is None or v == '':
        return None
    if not _URL_PATTERN.match(v):
        raise ValueError('Invalid URL format. Must be a valid HTTP/HTTPS URL (e.g., http://localhost:11434)')
    return v.rstrip('/')


class SettingsUpdate(BaseModel):
    """Schema for updating user settings. All fields are optional for partial updates."""
    search_half_life_days: Optional[float] = None
    privacy_hard_delete: Optional[bool] = None
    onboarding_completed: Optional[bool] = None

    # Generation LLM settings
    generation_url: Optional[str] = None
    generation_api_token: Optional[str] = None
    generation_model: Optional[str] = None

    # Embedding LLM settings
    embedding_url: Optional[str] = None
    embedding_api_token: Optional[str] = None
    embedding_model: Optional[str] = None

    @field_validator('generation_url', 'embedding_url')
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_optional_url(v)

    @field_validator('generation_api_token', 'embedding_api_token')
    @classmethod
    def validate_api_token(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        return v.strip()

    @field_validator('generation_model', 'embedding_model')
    @classmethod
    def validate_model(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        return v.strip()


class LLMTestRequest(BaseModel):
    """Schema for probing an LLM endpoint with (possibly unsaved) connection values.

    Blank fields fall back to the server defaults, mirroring how the runtime
    factories resolve per-user settings — so the test reflects what will
    actually be used after saving.
    """
    service_type: Literal["generation", "embedding"]
    url: Optional[str] = None
    api_token: Optional[str] = None
    model: Optional[str] = None

    @field_validator('url')
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_optional_url(v)

    @field_validator('api_token', 'model')
    @classmethod
    def strip_value(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        return v.strip()


class LLMTestResponse(BaseModel):
    """Result of an LLM connection probe."""
    ok: bool
    message: str


class SettingsResponse(BaseModel):
    """Schema for settings response. API tokens are never exposed."""
    id: int
    user_id: int
    search_half_life_days: float
    privacy_hard_delete: bool
    onboarding_completed: bool = False

    # Generation LLM settings
    generation_url: Optional[str] = None
    generation_api_token_set: bool = False
    generation_model: Optional[str] = None

    # Embedding LLM settings
    embedding_url: Optional[str] = None
    embedding_api_token_set: bool = False
    embedding_model: Optional[str] = None

    # Server-configured default endpoints (not user secrets). Exposed so the
    # client can offer a "local" preset that points at this deployment's actual
    # backend host instead of hard-coding localhost — which resolves to the
    # backend container, not the user's machine, in Docker/hosted setups.
    default_generation_url: str
    default_embedding_url: str

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def set_token_flags(cls, data):
        """Convert ORM model to response with token flags."""
        if hasattr(data, '__dict__'):
            # SQLAlchemy model
            result = {
                'id': data.id,
                'user_id': data.user_id,
                'search_half_life_days': data.search_half_life_days,
                'privacy_hard_delete': data.privacy_hard_delete,
                'onboarding_completed': bool(data.onboarding_completed),
                'generation_url': data.generation_url,
                'generation_api_token_set': bool(data.generation_api_token),
                'generation_model': data.generation_model,
                'embedding_url': data.embedding_url,
                'embedding_api_token_set': bool(data.embedding_api_token),
                'embedding_model': data.embedding_model,
                'default_generation_url': _app_settings.default_generation_url,
                'default_embedding_url': _app_settings.default_embedding_url,
            }
            return result
        return data
