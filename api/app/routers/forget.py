import logging
import os
import pathlib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.attachment import Attachment
from app.models.embedding import EntryEmbedding
from app.models.entry import Entry
from app.models.settings import Settings
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


def _safe_delete_file(filepath_relative: str) -> None:
    """
    Delete an uploaded file, guarding against path traversal.

    Resolves the full path and verifies it stays inside the upload directory
    before unlinking. Logs and skips if a traversal attempt is detected.
    """
    upload_base = pathlib.Path(app_settings.upload_dir).resolve()
    try:
        target = (upload_base / filepath_relative).resolve()
    except Exception as e:
        logger.error(f"Could not resolve attachment path '{filepath_relative}': {e}")
        return

    # Ensure the resolved path is actually inside the upload directory
    if not str(target).startswith(str(upload_base) + os.sep):
        logger.error(
            f"Path traversal attempt blocked: '{filepath_relative}' resolved to '{target}'"
        )
        return

    if target.exists():
        try:
            target.unlink()
        except OSError as e:
            logger.error(f"Failed to delete attachment file '{target}': {e}")


@router.post("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def forget_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(Entry).filter(
        Entry.id == entry_id,
        Entry.user_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    user_settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    hard_delete = user_settings.privacy_hard_delete if user_settings else False

    if hard_delete:
        # Hard delete: remove files then delete the row (cascade handles relationships)
        attachments = db.query(Attachment).filter(Attachment.entry_id == entry_id).all()
        for attachment in attachments:
            _safe_delete_file(attachment.filepath)
        db.delete(entry)
    else:
        # Soft forget: zero the embedding vector and wipe PII from the entry row.
        # The row is kept for referential integrity but contains no recoverable content.
        embeddings = db.query(EntryEmbedding).filter(EntryEmbedding.entry_id == entry_id).all()
        for embedding in embeddings:
            embedding.embedding = [0.0] * app_settings.embedding_dim
            embedding.is_active = False

        entry.content = ""
        entry.title = None
        entry.tags = []
        entry.mood_user = None
        entry.mood_inferred = None
        entry.is_deleted = True

    db.commit()
    return None
