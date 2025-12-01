from pydantic import BaseModel
from typing import Optional


class SettingsUpdate(BaseModel):
    search_half_life_days: Optional[float] = None
    privacy_hard_delete: Optional[bool] = None


class SettingsResponse(BaseModel):
    id: int
    user_id: int
    search_half_life_days: float
    privacy_hard_delete: bool

    class Config:
        from_attributes = True

