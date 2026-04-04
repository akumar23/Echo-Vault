from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

_MAX_CONTENT_CHARS = 50_000  # ~50 KB / ~25 pages — prevents DB bloat and LLM token abuse
_MAX_TITLE_CHARS = 500
_MAX_TAG_LENGTH = 50
_MAX_TAGS = 20


class EntryCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=_MAX_TITLE_CHARS)
    content: str = Field(min_length=1, max_length=_MAX_CONTENT_CHARS)
    tags: List[str] = Field(default_factory=list, max_length=_MAX_TAGS)
    mood_user: Optional[int] = Field(default=None, ge=1, le=5)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        for tag in v:
            if len(tag) > _MAX_TAG_LENGTH:
                raise ValueError(f"Each tag must be {_MAX_TAG_LENGTH} characters or fewer")
        return v


class EntryUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=_MAX_TITLE_CHARS)
    content: Optional[str] = Field(default=None, min_length=1, max_length=_MAX_CONTENT_CHARS)
    tags: Optional[List[str]] = Field(default=None, max_length=_MAX_TAGS)
    mood_user: Optional[int] = Field(default=None, ge=1, le=5)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        for tag in v:
            if len(tag) > _MAX_TAG_LENGTH:
                raise ValueError(f"Each tag must be {_MAX_TAG_LENGTH} characters or fewer")
        return v


class EntryResponse(BaseModel):
    id: int
    user_id: int
    title: Optional[str]
    content: str
    tags: List[str]
    mood_user: Optional[int]
    mood_inferred: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
