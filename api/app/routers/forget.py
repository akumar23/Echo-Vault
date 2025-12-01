from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.models.attachment import Attachment
from app.models.settings import Settings
from app.core.dependencies import get_current_user
import os
from app.core.config import settings as app_settings

router = APIRouter()


@router.post("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def forget_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(Entry).filter(
        Entry.id == entry_id,
        Entry.user_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    
    # Get user settings
    user_settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    hard_delete = user_settings.privacy_hard_delete if user_settings else False
    
    if hard_delete:
        # Hard delete: remove everything
        # Delete attachments files
        attachments = db.query(Attachment).filter(Attachment.entry_id == entry_id).all()
        for attachment in attachments:
            filepath = os.path.join(app_settings.upload_dir, attachment.filepath)
            if os.path.exists(filepath):
                os.remove(filepath)
        
        # Delete from database (cascade will handle relationships)
        db.delete(entry)
    else:
        # Soft forget: zero out embeddings, mark inactive
        embeddings = db.query(EntryEmbedding).filter(EntryEmbedding.entry_id == entry_id).all()
        for embedding in embeddings:
            # Zero out vector (create zero vector of same dimension)
            embedding.embedding = [0.0] * 1024
            embedding.is_active = False
        
        # Mark entry as deleted
        entry.is_deleted = True
    
    db.commit()
    return None

