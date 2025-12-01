from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.core.dependencies import get_current_user
import json
from datetime import datetime

router = APIRouter()


@router.get("/entries")
async def export_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export entries as JSONL"""
    entries = db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted == False
    ).all()
    
    lines = []
    for entry in entries:
        embeddings = db.query(EntryEmbedding).filter(
            EntryEmbedding.entry_id == entry.id,
            EntryEmbedding.is_active == True
        ).first()
        
        export_data = {
            "id": entry.id,
            "title": entry.title,
            "content": entry.content,
            "tags": entry.tags,
            "mood_user": entry.mood_user,
            "mood_inferred": entry.mood_inferred,
            "created_at": entry.created_at.isoformat(),
            "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
            "embedding": embeddings.embedding.tolist() if embeddings and embeddings.embedding else None
        }
        lines.append(json.dumps(export_data))
    
    return Response(
        content="\n".join(lines),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=entries.jsonl"}
    )

