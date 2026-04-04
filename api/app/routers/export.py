import json

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.entry import Entry
from app.models.user import User

router = APIRouter()


@router.get("/entries")
async def export_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Export journal entries as JSONL (one JSON object per line).

    Embeddings are intentionally excluded: they are derived from content and
    can be used for semantic inference attacks if the export is shared or intercepted.
    """
    entries = db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted == False,
    ).all()

    lines = [
        json.dumps({
            "id": entry.id,
            "title": entry.title,
            "content": entry.content,
            "tags": entry.tags,
            "mood_user": entry.mood_user,
            "mood_inferred": entry.mood_inferred,
            "created_at": entry.created_at.isoformat(),
            "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
        })
        for entry in entries
    ]

    return Response(
        content="\n".join(lines),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=entries.jsonl"},
    )
