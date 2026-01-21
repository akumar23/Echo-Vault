from pydantic import BaseModel
from typing import List, Literal, Optional
from datetime import datetime


class PromptInteractionCreate(BaseModel):
    """Request to log a prompt interaction."""
    prompt_text: str
    prompt_type: Literal["question", "prompt", "continuation"]
    action: Literal["displayed", "clicked", "cycled", "dismissed", "completed"]
    entry_id: Optional[int] = None
    source_entry_id: Optional[int] = None


class PromptInteractionResponse(BaseModel):
    """Response for a logged prompt interaction."""
    id: int
    prompt_text: str
    prompt_type: str
    action: str
    entry_id: Optional[int]
    source_entry_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class WritingSuggestion(BaseModel):
    """A single AI-generated writing suggestion."""
    id: str
    text: str
    type: Literal["question", "prompt", "continuation"]
    context: str
    source_entry_id: Optional[int] = None


class SuggestionsResponse(BaseModel):
    """Response containing AI-generated writing suggestions."""
    suggestions: List[WritingSuggestion]
    preferred_type: Optional[str] = None
    has_sufficient_data: bool


class PromptStats(BaseModel):
    """Statistics for prompt engagement."""
    prompt_type: str
    displayed_count: int
    clicked_count: int
    completed_count: int
    completion_rate: float


class PromptStatsResponse(BaseModel):
    """Response containing prompt engagement statistics."""
    stats: List[PromptStats]
    total_interactions: int
