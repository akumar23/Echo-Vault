from pydantic import BaseModel, field_validator
from typing import Optional
import re


class SettingsUpdate(BaseModel):
    search_half_life_days: Optional[float] = None
    privacy_hard_delete: Optional[bool] = None
    ollama_url: Optional[str] = None

    @field_validator('ollama_url')
    @classmethod
    def validate_ollama_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        # Basic URL validation for http/https
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'[^\s/$.?#].'  # domain
            r'[^\s]*$',  # rest of URL
            re.IGNORECASE
        )
        if not url_pattern.match(v):
            raise ValueError('Invalid URL format. Must be a valid HTTP/HTTPS URL (e.g., http://localhost:11434)')
        return v.rstrip('/')  # Normalize by removing trailing slash


class SettingsResponse(BaseModel):
    id: int
    user_id: int
    search_half_life_days: float
    privacy_hard_delete: bool
    ollama_url: Optional[str] = None

    class Config:
        from_attributes = True

