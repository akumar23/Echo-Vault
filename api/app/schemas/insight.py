from pydantic import BaseModel
from typing import List, Literal
from datetime import datetime


class InsightResponse(BaseModel):
    id: int
    user_id: int
    summary: str
    themes: List[str]
    actions: List[str]
    period_start: datetime
    period_end: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class SemanticMoodInsight(BaseModel):
    """A single semantic mood insight correlating content themes with mood."""
    type: Literal["positive_theme", "negative_theme", "mood_trend"]
    theme: str
    avg_mood: float
    count: int
    insight: str  # Human-readable actionable text


class SemanticMoodInsightsResponse(BaseModel):
    """Response containing semantic mood insights."""
    insights: List[SemanticMoodInsight]
    total_entries: int
    has_sufficient_data: bool

