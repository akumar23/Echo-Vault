from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.encryption import decrypt_token, encrypt_token
from app.database import get_db
from app.models.settings import Settings
from app.models.user import User
from app.schemas.settings import SettingsResponse, SettingsUpdate

router = APIRouter()


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("", response_model=SettingsResponse)
async def update_settings(
    settings_data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)

    if settings_data.search_half_life_days is not None:
        settings.search_half_life_days = settings_data.search_half_life_days
    if settings_data.privacy_hard_delete is not None:
        settings.privacy_hard_delete = settings_data.privacy_hard_delete

    if settings_data.generation_url is not None:
        settings.generation_url = settings_data.generation_url or None
    if settings_data.generation_api_token is not None:
        raw = settings_data.generation_api_token or None
        settings.generation_api_token = encrypt_token(raw) if raw else None
    if settings_data.generation_model is not None:
        settings.generation_model = settings_data.generation_model or None

    if settings_data.embedding_url is not None:
        settings.embedding_url = settings_data.embedding_url or None
    if settings_data.embedding_api_token is not None:
        raw = settings_data.embedding_api_token or None
        settings.embedding_api_token = encrypt_token(raw) if raw else None
    if settings_data.embedding_model is not None:
        settings.embedding_model = settings_data.embedding_model or None

    db.commit()
    db.refresh(settings)
    return settings
