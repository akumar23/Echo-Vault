import hmac
import logging
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.database import get_db
from app.jobs.insights_job import generate_insights_task, nightly_insights_task
from app.models.embedding import EntryEmbedding
from app.models.entry import Entry
from app.models.insight import Insight
from app.models.user import User
from app.schemas.insight import InsightResponse, SemanticMoodInsight, SemanticMoodInsightsResponse
from app.services.llm_service import get_generation_service_for_user

router = APIRouter()
logger = logging.getLogger(__name__)

_CRON_SECRET = os.getenv("CRON_SECRET", "")
_MIN_CRON_SECRET_LEN = 32  # Enforce minimum entropy


@router.post("/cron/weekly")
async def trigger_weekly_insights(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """
    Trigger weekly insights via external cron.

    Requires the X-Cron-Secret header to match the CRON_SECRET env var (min 32 chars).
    Uses timing-safe comparison to prevent timing attacks.
    """
    if not _CRON_SECRET:
        raise HTTPException(status_code=404, detail="Not found")

    if len(_CRON_SECRET) < _MIN_CRON_SECRET_LEN:
        logger.error(f"CRON_SECRET is too short ({len(_CRON_SECRET)} chars) — minimum {_MIN_CRON_SECRET_LEN} required")
        raise HTTPException(status_code=500, detail="Server misconfiguration")

    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, _CRON_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")

    nightly_insights_task.delay()
    return {"status": "queued", "message": "Weekly insights generation triggered for all users"}


@router.post("/generate")
@limiter.limit("5/minute")
async def generate_insights(
    request: Request,
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger insight generation for the current user."""
    generate_insights_task.delay(current_user.id, days)
    return {"status": "queued", "message": f"Generating insights for the past {days} days"}


@router.get("/recent", response_model=List[InsightResponse])
async def get_recent_insights(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    insights = db.query(Insight).filter(
        Insight.user_id == current_user.id
    ).order_by(Insight.created_at.desc()).limit(limit).all()
    return insights


@router.get("/mood-content", response_model=SemanticMoodInsightsResponse)
async def get_semantic_mood_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze correlations between journal content themes and mood."""
    MIN_ENTRIES = 10
    MIN_CLUSTER_SIZE = 3

    entries = db.query(
        Entry.id,
        Entry.content,
        Entry.title,
        Entry.mood_user,
        Entry.mood_inferred,
    ).join(
        EntryEmbedding, Entry.id == EntryEmbedding.entry_id
    ).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted.is_not(True),
        EntryEmbedding.is_active.is_not(False),
    ).all()

    total_entries = len(entries)

    if total_entries < MIN_ENTRIES:
        return SemanticMoodInsightsResponse(
            insights=[], total_entries=total_entries, has_sufficient_data=False
        )

    entries_with_mood = []
    for entry in entries:
        mood = entry.mood_user if entry.mood_user is not None else entry.mood_inferred
        if mood is not None:
            entries_with_mood.append({
                "id": entry.id,
                "content": entry.content,
                "title": entry.title,
                "mood": mood,
            })

    if len(entries_with_mood) < MIN_ENTRIES:
        return SemanticMoodInsightsResponse(
            insights=[], total_entries=total_entries, has_sufficient_data=False
        )

    high_mood_entries = [e for e in entries_with_mood if e["mood"] >= 4]
    low_mood_entries = [e for e in entries_with_mood if e["mood"] <= 2]

    insights: List[SemanticMoodInsight] = []
    llm_service = get_generation_service_for_user(db, current_user.id)

    if len(high_mood_entries) >= MIN_CLUSTER_SIZE:
        avg_mood = sum(e["mood"] for e in high_mood_entries) / len(high_mood_entries)
        entry_texts = [f"{e['title'] or ''}\n{e['content']}" for e in high_mood_entries]
        theme = await llm_service.extract_common_theme(entry_texts)
        insights.append(SemanticMoodInsight(
            type="positive_theme",
            theme=theme,
            avg_mood=round(avg_mood, 1),
            count=len(high_mood_entries),
            insight=f"Your mood lifts when writing about {theme}",
        ))

    if len(low_mood_entries) >= MIN_CLUSTER_SIZE:
        avg_mood = sum(e["mood"] for e in low_mood_entries) / len(low_mood_entries)
        entry_texts = [f"{e['title'] or ''}\n{e['content']}" for e in low_mood_entries]
        theme = await llm_service.extract_common_theme(entry_texts)
        insights.append(SemanticMoodInsight(
            type="negative_theme",
            theme=theme,
            avg_mood=round(avg_mood, 1),
            count=len(low_mood_entries),
            insight=f"Entries about {theme} tend toward lower mood",
        ))

    if len(entries_with_mood) >= 20:
        sorted_entries = sorted(entries_with_mood, key=lambda e: e["id"])
        mid = len(sorted_entries) // 2
        first_half_avg = sum(e["mood"] for e in sorted_entries[:mid]) / mid
        second_half_avg = sum(e["mood"] for e in sorted_entries[mid:]) / (len(sorted_entries) - mid)

        diff = second_half_avg - first_half_avg
        if abs(diff) >= 0.3:
            direction = "improving" if diff > 0 else "declining"
            insights.append(SemanticMoodInsight(
                type="mood_trend",
                theme="overall trend",
                avg_mood=round(second_half_avg, 1),
                count=len(entries_with_mood),
                insight=f"Your overall mood has been {direction} over time",
            ))

    return SemanticMoodInsightsResponse(
        insights=insights,
        total_entries=total_entries,
        has_sufficient_data=True,
    )
