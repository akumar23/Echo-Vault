import logging
from datetime import datetime, timedelta, timezone

import httpx
import redis as redis_lib
from celery import group
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import and_, exists
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.schemas.entry import (
    EchoItem,
    EchoesResponse,
    EntryCreate,
    EntryUpdate,
    EntryResponse,
    RetryFailedResponse,
)
from app.schemas.search import SearchResult
from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.jobs.embedding_job import create_embedding_task, enqueue_embedding_job
from app.jobs.mood_job import infer_mood_task, enqueue_mood_job
from app.jobs.reflection_job import enqueue_entry_reflection_job
from app.services.reflection_cache import (
    reflection_cache,
    get_cached_echoes,
    set_cached_echoes,
    invalidate_reverse_prompt,
)
from app.services.llm_service import (
    LLMProviderError,
    get_generation_service_for_user,
)

logger = logging.getLogger(__name__)

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
    # Fresh content may change which gaps exist — drop the cached reverse prompt.
    invalidate_reverse_prompt(current_user.id)

    return entry


_RETRY_FAILED_CAP = 500
# Recency gate: don't retry entries whose first-pass jobs haven't had a chance
# to run yet. Celery time_limit is 120s; with backoff this gives ~2x safety.
_RETRY_MIN_AGE = timedelta(minutes=5)
# TTL for the per-entry idempotency lock. Long enough to cover Celery
# time_limit (120s) plus exponential retry backoff (max 300s) with margin.
_RETRY_LOCK_TTL_SECONDS = 600
_RETRY_EMBED_LOCK_PREFIX = "retry:embed:"
_RETRY_MOOD_LOCK_PREFIX = "retry:mood:"


def _build_retry_query(db: Session, user_id: int, now: datetime):
    """Return a base SQLAlchemy query over ``Entry.id`` with the retry-eligibility
    guards baked in: user scope, not soft-deleted, and old enough for the
    original Celery job to have run.

    Soft-deleted ("forgotten") entries MUST stay out of every retry path —
    re-embedding them would feed the user's deleted content back through
    the LLM, a privacy regression. Baking ``is_deleted.is_(False)`` in here
    (rather than at each call site) prevents a future refactor from
    accidentally dropping it.
    """
    return db.query(Entry.id).filter(
        Entry.user_id == user_id,
        Entry.is_deleted.is_(False),
        Entry.created_at < (now - _RETRY_MIN_AGE),
    )


def _missing_embedding_predicate():
    """Return the SQL predicate for "entry has no active embedding row".

    Uses ``.correlate(Entry)`` so the inner EXISTS correlates against the
    outer ``entries`` table even if a future refactor adds another join that
    introduces a second alias — defensive belt-and-braces.
    """
    return ~exists().where(
        and_(
            EntryEmbedding.entry_id == Entry.id,
            EntryEmbedding.is_active.is_(True),
        )
    ).correlate(Entry)


def _try_acquire_retry_lock(key: str) -> bool:
    """Acquire a Redis SETNX lock with TTL. Returns True if we got the lock,
    False if another retry is already in flight for this entry.

    Reuses the shared ``reflection_cache.redis`` client (no new connection
    pool — free-tier Redis has tight connection limits). On Redis transport
    failure we deliberately fail OPEN (return True) because the cost of a
    duplicate enqueue is one extra LLM call, while the cost of failing
    closed is the user can't retry at all.
    """
    try:
        # nx=True means SET only if not exists; ex sets the TTL atomically.
        acquired = reflection_cache.redis.set(
            key, "1", nx=True, ex=_RETRY_LOCK_TTL_SECONDS
        )
        return bool(acquired)
    except redis_lib.RedisError:
        logger.warning(
            "Redis SETNX failed for retry lock; failing open",
            extra={"key": key},
            exc_info=True,
        )
        return True


@router.post("/retry-failed", response_model=RetryFailedResponse)
@limiter.limit("3/minute")
async def retry_failed_entries(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-enqueue embedding and mood jobs for entries the worker never processed
    (typically because LLM settings were misconfigured).

    Guards:
    - Per-call cap of ``_RETRY_FAILED_CAP`` per job type — keeps the queue
      from being flooded. Clients should call again when ``capped`` is true.
    - Recency gate: only entries older than ``_RETRY_MIN_AGE`` are eligible,
      so a brand-new entry whose Celery job is still mid-flight doesn't get
      double-enqueued.
    - Redis SETNX lock per (entry_id, job_type) prevents the user from
      double-enqueueing by clicking retry twice or while a job is still in
      its retry-backoff window. Locked entries are reported in
      ``*_skipped_locked``.
    """
    now = datetime.now(timezone.utc)

    # Fetch +1 over the cap so we can detect "capped" in a single query.
    embed_rows = _build_retry_query(db, current_user.id, now).filter(
        _missing_embedding_predicate()
    ).limit(_RETRY_FAILED_CAP + 1).all()
    embed_capped = len(embed_rows) > _RETRY_FAILED_CAP
    embed_candidates = [row[0] for row in embed_rows[:_RETRY_FAILED_CAP]]

    mood_rows = _build_retry_query(db, current_user.id, now).filter(
        Entry.mood_inferred.is_(None)
    ).limit(_RETRY_FAILED_CAP + 1).all()
    mood_capped = len(mood_rows) > _RETRY_FAILED_CAP
    mood_candidates = [row[0] for row in mood_rows[:_RETRY_FAILED_CAP]]

    # Filter by idempotency lock: only enqueue entries whose lock we acquire.
    embed_targets: List[int] = []
    embed_skipped_locked = 0
    for entry_id in embed_candidates:
        if _try_acquire_retry_lock(f"{_RETRY_EMBED_LOCK_PREFIX}{entry_id}"):
            embed_targets.append(entry_id)
        else:
            embed_skipped_locked += 1

    mood_targets: List[int] = []
    mood_skipped_locked = 0
    for entry_id in mood_candidates:
        if _try_acquire_retry_lock(f"{_RETRY_MOOD_LOCK_PREFIX}{entry_id}"):
            mood_targets.append(entry_id)
        else:
            mood_skipped_locked += 1

    # Batch-enqueue with Celery groups: one Redis round-trip per group rather
    # than N synchronous .delay() calls. Also shows up nicely in Flower.
    if embed_targets:
        group(create_embedding_task.s(eid) for eid in embed_targets).apply_async()
    if mood_targets:
        group(infer_mood_task.s(eid) for eid in mood_targets).apply_async()

    capped = embed_capped or mood_capped

    logger.info(
        "Retry-failed batch enqueued",
        extra={
            "user_id": current_user.id,
            "embedding_enqueued": len(embed_targets),
            "mood_enqueued": len(mood_targets),
            "embedding_skipped_locked": embed_skipped_locked,
            "mood_skipped_locked": mood_skipped_locked,
            "capped": capped,
        },
    )

    return RetryFailedResponse(
        embedding_jobs_enqueued=len(embed_targets),
        mood_jobs_enqueued=len(mood_targets),
        embedding_skipped_locked=embed_skipped_locked,
        mood_skipped_locked=mood_skipped_locked,
        capped=capped,
    )


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


@router.get("/{entry_id}/echoes", response_model=EchoesResponse)
@limiter.limit("30/minute")
async def get_entry_echoes(
    request: Request,
    entry_id: int,
    k: int = Query(3, ge=1, le=5),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return entries that semantically resonate with the given entry,
    wrapped in a short LLM-generated observation about what connects them.

    Cached in Redis for 7 days per (user, entry). Returns `status='empty'`
    when the user has no other entries yet, and `status='pending'` if the
    source embedding isn't ready yet.
    """
    entry = db.query(Entry).filter(
        Entry.id == entry_id,
        Entry.user_id == current_user.id,
        Entry.is_deleted == False,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    cached = get_cached_echoes(current_user.id, entry_id)
    if cached:
        return EchoesResponse(**cached)

    source = db.query(EntryEmbedding).filter(
        EntryEmbedding.entry_id == entry_id,
        EntryEmbedding.is_active == True,
    ).first()
    if not source:
        # Embedding job hasn't completed yet — don't cache, let the client retry.
        return EchoesResponse(echoes=[], framing=None, status="pending")

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

    echoes = [
        EchoItem(
            entry_id=row.entry_id,
            title=row.title,
            content=row.content,
            created_at=row.created_at,
            similarity=float(row.score),
        )
        for row in rows
    ]

    if not echoes:
        payload = {"echoes": [], "framing": None, "status": "empty"}
        set_cached_echoes(current_user.id, entry_id, payload)
        return EchoesResponse(**payload)

    # Generate the 'then vs now' framing paragraph.
    llm_service = get_generation_service_for_user(db, current_user.id)
    framing: Optional[str] = None
    try:
        framing = await llm_service.generate_echo_framing(
            current_entry=entry.content,
            current_entry_date=entry.created_at.strftime("%B %d, %Y"),
            echoes=[
                {
                    "date": e.created_at.strftime("%B %d, %Y"),
                    "content": e.content,
                }
                for e in echoes
            ],
        )
    except (LLMProviderError, httpx.HTTPError, httpx.TimeoutException):
        logger.warning(
            "Echo framing generation failed; returning echoes without framing",
            extra={"user_id": current_user.id, "entry_id": entry_id},
            exc_info=True,
        )

    payload = {
        "echoes": [e.model_dump(mode="json") for e in echoes],
        "framing": framing,
        "status": "complete",
    }
    set_cached_echoes(current_user.id, entry_id, payload)
    return EchoesResponse(echoes=echoes, framing=framing, status="complete")


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

