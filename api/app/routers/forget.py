import logging
import pathlib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
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
    except Exception:
        logger.warning(
            "Could not resolve attachment path",
            extra={"path": filepath_relative},
            exc_info=True,
        )
        return

    # Ensure the resolved path is strictly *inside* the upload directory.
    # is_relative_to handles symlink-escape (resolve() follows symlinks so any
    # link pointing outside upload_base produces a path that fails this check)
    # and also rejects target == upload_base (we never delete the dir itself).
    if target == upload_base or not target.is_relative_to(upload_base):
        logger.error(
            "Path traversal attempt blocked",
            extra={"path": filepath_relative, "resolved": str(target)},
        )
        return

    if target.exists():
        try:
            target.unlink()
        except OSError:
            logger.warning(
                "Failed to delete attachment file",
                extra={"path": str(target)},
                exc_info=True,
            )


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

    try:
        if hard_delete:
            # Hard delete: commit the DB delete FIRST so we never orphan DB rows.
            # Capture attachment paths before deleting the row (cascade will remove them).
            attachment_paths = [
                a.filepath
                for a in db.query(Attachment).filter(Attachment.entry_id == entry_id).all()
            ]
            db.delete(entry)
            db.commit()

            # Now attempt to delete files. Orphan files are recoverable via
            # a janitor task; orphan DB rows are not. Failures here are logged
            # and swallowed.
            for path in attachment_paths:
                try:
                    _safe_delete_file(path)
                except OSError:
                    logger.warning(
                        "Failed to delete attachment file",
                        extra={"path": path},
                        exc_info=True,
                    )
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
    except SQLAlchemyError:
        db.rollback()
        logger.exception(
            "Failed to delete entry",
            extra={"user_id": current_user.id, "entry_id": entry_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete entry",
        )

    return None
