from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.encryption import encrypt_token
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

    # Only fields the client explicitly sent (PATCH-style semantics over PUT).
    # Without this, sending `null` to clear a field is indistinguishable from
    # omitting it, so users can never blank out a previously-set URL/model/token.
    update_dict = settings_data.model_dump(exclude_unset=True)
    token_fields = {"generation_api_token", "embedding_api_token"}

    for field, value in update_dict.items():
        if field in token_fields:
            setattr(settings, field, encrypt_token(value) if value else None)
        else:
            setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings
