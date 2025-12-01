from pydantic import BaseModel
from typing import List
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

