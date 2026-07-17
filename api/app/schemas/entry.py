from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime

_MAX_CONTENT_CHARS = 50_000  # ~50 KB / ~25 pages — prevents DB bloat and LLM token abuse
_MAX_TITLE_CHARS = 500
_MAX_TAG_LENGTH = 50
_MAX_TAGS = 20

# Re-export for upload form validation in the entries router.
MAX_TITLE_CHARS = _MAX_TITLE_CHARS
MAX_TAG_LENGTH = _MAX_TAG_LENGTH
MAX_TAGS = _MAX_TAGS


class EntryCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=_MAX_TITLE_CHARS)
    content: str = Field(min_length=1, max_length=_MAX_CONTENT_CHARS)
    tags: List[str] = Field(default_factory=list, max_length=_MAX_TAGS)
    mood_user: Optional[int] = Field(default=None, ge=1, le=5)
    entry_date: Optional[date] = None

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
    entry_date: Optional[date] = None

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
    mood_confidence: Optional[str] = None  # "high" | "medium" | "low" — UI gates display on this
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AttachmentInfo(BaseModel):
    id: int
    filename: str
    mime_type: Optional[str] = None

    class Config:
        from_attributes = True


class EntryUploadResponse(EntryResponse):
    """Entry created from an uploaded file, plus source attachment metadata."""
    attachment: AttachmentInfo
    truncated: bool = False


class EchoItem(BaseModel):
    """A past entry surfaced as an 'echo' of the current one."""
    entry_id: int
    title: Optional[str]
    content: str
    created_at: datetime
    similarity: float


class EchoesResponse(BaseModel):
    """A collection of echoes plus an LLM-generated 'then vs now' framing paragraph."""
    echoes: List[EchoItem]
    framing: Optional[str]
    status: str  # "complete" | "empty"


class RetryFailedResponse(BaseModel):
    """Counts for the retry-failed endpoint.

    `mood_jobs_enqueued` is the number of jobs actually pushed to Celery.
    `mood_skipped_locked` is the number of eligible entries that already had a
    Redis idempotency lock in place (i.e., a previous retry is still
    in-flight). `capped` is true when more eligible entries exist than the
    per-call cap allowed us to scan, so the client should call again.

    Note: We deliberately do NOT report exact pending totals because that
    would require an extra full COUNT query against the eligible set. The
    `capped` flag is the actionable signal — when true, retry; when false,
    you've drained the queue.
    """
    mood_jobs_enqueued: int
    mood_skipped_locked: int
    capped: bool
