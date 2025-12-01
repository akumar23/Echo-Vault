from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class EntryCreate(BaseModel):
    title: Optional[str] = None
    content: str
    tags: List[str] = []
    mood_user: Optional[int] = None  # 1-5


class EntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    mood_user: Optional[int] = None


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

