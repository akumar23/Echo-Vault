from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.schemas.entry import EntryCreate, EntryUpdate, EntryResponse
from app.schemas.search import SearchResult
from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.jobs.embedding_job import enqueue_embedding_job
from app.jobs.mood_job import enqueue_mood_job
from app.jobs.reflection_job import enqueue_entry_reflection_job
from app.services.reflection_cache import reflection_cache

router = APIRouter()


class EntryReflectionResponse(BaseModel):
    reflection: Optional[str]
    status: str  # "pending" | "generating" | "complete" | "error"


@router.post("", response_model=EntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    entry_data: EntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = Entry(
        user_id=current_user.id,
        title=entry_data.title,
        content=entry_data.content,
        tags=entry_data.tags,
        mood_user=entry_data.mood_user
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    # Enqueue background jobs
    enqueue_embedding_job(entry.id)
    enqueue_mood_job(entry.id)

    # Invalidate cached reflection so it regenerates on next view
    reflection_cache.delete_reflection(current_user.id)

    return entry


@router.get("", response_model=List[EntryResponse])
async def list_entries(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entries = db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted == False
    ).order_by(Entry.created_at.desc()).offset(skip).limit(limit).all()
    return entries


@router.get("/{entry_id}", response_model=EntryResponse)
async def get_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(Entry).filter(
        Entry.id == entry_id,
        Entry.user_id == current_user.id,
        Entry.is_deleted == False
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return entry


@router.get("/{entry_id}/related", response_model=List[SearchResult])
async def get_related_entries(
    entry_id: int,
    k: int = Query(3, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the k entries most semantically similar to the given entry.

    Similarity uses pgvector cosine distance against the source entry's stored
    embedding. If the embedding hasn't been generated yet (async Celery job) or
    was zeroed by a soft delete, an empty list is returned so the UI can degrade
    gracefully rather than erroring.
    """
    entry = db.query(Entry).filter(
        Entry.id == entry_id,
        Entry.user_id == current_user.id,
        Entry.is_deleted == False,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    source = db.query(EntryEmbedding).filter(
        EntryEmbedding.entry_id == entry_id,
        EntryEmbedding.is_active == True,
    ).first()
    if not source:
        return []

    distance = EntryEmbedding.embedding.cosine_distance(source.embedding)
    similarity_expr = 1 - (distance / 2)

    rows = db.query(
        Entry.id.label("entry_id"),
        Entry.title,
        Entry.content,
        Entry.created_at,
        similarity_expr.label("score"),
    ).join(
        EntryEmbedding, Entry.id == EntryEmbedding.entry_id
    ).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted == False,
        Entry.id != entry_id,
        EntryEmbedding.is_active == True,
    ).order_by(distance).limit(k).all()

    return [
        {
            "entry_id": row.entry_id,
            "title": row.title,
            "content": row.content,
            "created_at": row.created_at,
            "score": float(row.score),
        }
        for row in rows
    ]


@router.get("/{entry_id}/reflection", response_model=EntryReflectionResponse)
async def get_entry_reflection(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the stored reflection for an entry, enqueueing generation
    on first access so each entry gets its own unique reflection."""
    entry = db.query(Entry).filter(
        Entry.id == entry_id,
        Entry.user_id == current_user.id,
        Entry.is_deleted == False,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    if entry.reflection_status is None:
        entry.reflection_status = "generating"
        db.commit()
        enqueue_entry_reflection_job(current_user.id, entry.id)
        return EntryReflectionResponse(reflection=None, status="generating")

    return EntryReflectionResponse(
        reflection=entry.reflection,
        status=entry.reflection_status,
    )


@router.post("/{entry_id}/reflection/regenerate", response_model=EntryReflectionResponse)
@limiter.limit("5/minute")
async def regenerate_entry_reflection(
    request: Request,
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Force regeneration of the entry's reflection."""
    entry = db.query(Entry).filter(
        Entry.id == entry_id,
        Entry.user_id == current_user.id,
        Entry.is_deleted == False,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    entry.reflection = None
    entry.reflection_status = "generating"
    entry.reflection_generated_at = None
    db.commit()

    enqueue_entry_reflection_job(current_user.id, entry.id)
    return EntryReflectionResponse(reflection=None, status="generating")


@router.put("/{entry_id}", response_model=EntryResponse)
async def update_entry(
    entry_id: int,
    entry_data: EntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(Entry).filter(
        Entry.id == entry_id,
        Entry.user_id == current_user.id,
        Entry.is_deleted == False
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    
    if entry_data.title is not None:
        entry.title = entry_data.title
    if entry_data.content is not None:
        entry.content = entry_data.content
    if entry_data.tags is not None:
        entry.tags = entry_data.tags
    if entry_data.mood_user is not None:
        entry.mood_user = entry_data.mood_user
    
    db.commit()
    db.refresh(entry)
    
    # Re-embed and invalidate entry reflection if content changed
    if entry_data.content is not None:
        enqueue_embedding_job(entry.id)
        entry.reflection = None
        entry.reflection_status = None
        entry.reflection_generated_at = None
        db.commit()

    # Invalidate cached reflection so it regenerates on next view
    reflection_cache.delete_reflection(current_user.id)

    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
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
    
    entry.is_deleted = True
    db.commit()

    # Invalidate cached reflection so it regenerates on next view
    reflection_cache.delete_reflection(current_user.id)

    return None

