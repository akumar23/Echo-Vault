from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
import re


class SettingsUpdate(BaseModel):
    """Schema for updating user settings. All fields are optional for partial updates."""
    search_half_life_days: Optional[float] = None
    privacy_hard_delete: Optional[bool] = None

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
        if v is None or v == '':
            return None
        url_pattern = re.compile(
            r'^https?://'
            r'[^\s/$.?#].'
            r'[^\s]*$',
            re.IGNORECASE
        )
        if not url_pattern.match(v):
            raise ValueError('Invalid URL format. Must be a valid HTTP/HTTPS URL (e.g., http://localhost:11434)')
        return v.rstrip('/')

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


class SettingsResponse(BaseModel):
    """Schema for settings response. API tokens are never exposed."""
    id: int
    user_id: int
    search_half_life_days: float
    privacy_hard_delete: bool

    # Generation LLM settings
    generation_url: Optional[str] = None
    generation_api_token_set: bool = False
    generation_model: Optional[str] = None

    # Embedding LLM settings
    embedding_url: Optional[str] = None
    embedding_api_token_set: bool = False
    embedding_model: Optional[str] = None

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
                'generation_url': data.generation_url,
                'generation_api_token_set': bool(data.generation_api_token),
                'generation_model': data.generation_model,
                'embedding_url': data.embedding_url,
                'embedding_api_token_set': bool(data.embedding_api_token),
                'embedding_model': data.embedding_model,
            }
            return result
        return data
