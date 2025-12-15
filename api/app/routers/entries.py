from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.schemas.entry import EntryCreate, EntryUpdate, EntryResponse
from app.core.dependencies import get_current_user
from app.jobs.embedding_job import enqueue_embedding_job
from app.jobs.mood_job import enqueue_mood_job
from app.services.reflection_cache import reflection_cache

router = APIRouter()


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
    
    # Re-embed if content changed
    if entry_data.content is not None:
        enqueue_embedding_job(entry.id)

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

