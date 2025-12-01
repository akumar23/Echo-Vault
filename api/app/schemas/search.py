from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


class DateRange(BaseModel):
    """Date range model with proper validation for search filtering."""
    start: Optional[datetime] = None
    end: Optional[datetime] = None

    @field_validator('start', 'end', mode='before')
    @classmethod
    def parse_datetime(cls, value):
        """Parse datetime from string or pass through if already datetime."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            if not value.strip():
                return None
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError as e:
                raise ValueError(f"Invalid date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS): {e}")
        raise ValueError(f"Date must be a string or datetime object, got {type(value)}")

    @field_validator('end')
    @classmethod
    def validate_date_range(cls, end_date, info):
        """Ensure end date is after start date if both are provided."""
        start_date = info.data.get('start')
        if start_date and end_date and end_date < start_date:
            raise ValueError("End date must be after start date")
        return end_date


class SearchRequest(BaseModel):
    query: str
    k: int = 10
    date_range: Optional[DateRange] = None
    tags: Optional[List[str]] = None


class SearchResult(BaseModel):
    entry_id: int
    title: Optional[str]
    content: str
    score: float
    created_at: datetime

