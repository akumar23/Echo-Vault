import re
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.entry import Entry
from app.models.settings import Settings
from app.models.user import User
from app.schemas.search import SearchRequest, SearchResult

router = APIRouter()
_MAX_SEARCH_CORPUS = 1000


def _terms(query: str) -> List[str]:
    return [term.casefold() for term in re.findall(r"\w+", query) if term]


def _entry_score(entry: Entry, terms: List[str], half_life_days: float) -> float:
    searchable = " ".join(
        [entry.title or "", entry.content or "", *(entry.tags or [])]
    ).casefold()
    matches = sum(searchable.count(term) for term in terms)
    if matches == 0:
        return 0.0
    created_at = entry.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_days = max((datetime.now(timezone.utc) - created_at).total_seconds() / 86400, 0)
    recency = 1 / (1 + age_days / half_life_days)
    return float(matches) + recency


@router.post("", response_model=List[SearchResult])
@limiter.limit("20/minute")
async def keyword_search(
    request: Request,
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search decrypted entries in-process and rank keyword matches by recency."""
    terms = _terms(search_request.query)
    if not terms:
        return []

    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    half_life_days = max(
        float(settings.search_half_life_days if settings else 30.0), 0.1
    )

    query = db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted.is_(False),
    )
    if search_request.date_range:
        if search_request.date_range.start:
            query = query.filter(Entry.created_at >= search_request.date_range.start)
        if search_request.date_range.end:
            query = query.filter(Entry.created_at <= search_request.date_range.end)
    if search_request.tags:
        query = query.filter(Entry.tags.contains(search_request.tags))

    entries = (
        query.order_by(Entry.created_at.desc()).limit(_MAX_SEARCH_CORPUS).all()
    )
    ranked = [
        (entry, _entry_score(entry, terms, half_life_days))
        for entry in entries
    ]
    ranked = [
        (entry, score)
        for entry, score in ranked
        if score > 0
    ]
    ranked.sort(key=lambda item: item[1], reverse=True)

    return [
        SearchResult(
            entry_id=entry.id,
            title=entry.title,
            content=entry.content,
            created_at=entry.created_at,
            score=score,
        )
        for entry, score in ranked[: search_request.k]
    ]
