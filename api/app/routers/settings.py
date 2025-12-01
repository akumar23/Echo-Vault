from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.settings import Settings
from app.schemas.settings import SettingsUpdate, SettingsResponse
from app.core.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        # Create default settings
        settings = Settings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("", response_model=SettingsResponse)
async def update_settings(
    settings_data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)
    
    if settings_data.search_half_life_days is not None:
        settings.search_half_life_days = settings_data.search_half_life_days
    if settings_data.privacy_hard_delete is not None:
        settings.privacy_hard_delete = settings_data.privacy_hard_delete
    
    db.commit()
    db.refresh(settings)
    return settings

