import os
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.models.insight import Insight
from app.schemas.insight import InsightResponse, SemanticMoodInsightsResponse, SemanticMoodInsight
from app.core.dependencies import get_current_user
from app.jobs.insights_job import generate_insights_task, nightly_insights_task
from app.services.llm_service import get_generation_service_for_user

router = APIRouter()

# Internal cron secret for triggering scheduled tasks without Celery Beat
# Set CRON_SECRET env var to enable this endpoint
CRON_SECRET = os.getenv("CRON_SECRET")


@router.post("/cron/weekly")
async def trigger_weekly_insights(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret")
):
    """
    Internal endpoint for triggering weekly insights via external cron.

    This replaces Celery Beat to reduce Redis operations.
    Configure your platform (Railway, Render, etc.) to call this endpoint
    weekly with the X-Cron-Secret header matching your CRON_SECRET env var.

    Example Railway cron:
        Schedule: 0 0 * * 5 (Friday at midnight)
        Command: curl -X POST https://your-api.railway.app/insights/cron/weekly -H "X-Cron-Secret: your-secret"
    """
    if not CRON_SECRET:
        raise HTTPException(status_code=404, detail="Not found")

    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Trigger the nightly insights task (runs for all users)
    nightly_insights_task.delay()

    return {"status": "queued", "message": "Weekly insights generation triggered for all users"}


@router.post("/generate")
async def generate_insights(
    days: int = 7,
    current_user: User = Depends(get_current_user),
):
    """Manually trigger insight generation for the current user."""
    generate_insights_task.delay(current_user.id, days)
    return {"status": "queued", "message": f"Generating insights for the past {days} days"}


@router.get("/recent", response_model=List[InsightResponse])
async def get_recent_insights(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    insights = db.query(Insight).filter(
        Insight.user_id == current_user.id
    ).order_by(Insight.created_at.desc()).limit(limit).all()
    return insights


@router.get("/mood-content", response_model=SemanticMoodInsightsResponse)
async def get_semantic_mood_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze correlations between journal content themes and mood.

    Returns insights like:
    - "You tend to feel better when writing about creative projects"
    - "Work-related entries correlate with lower mood"
    """
    MIN_ENTRIES = 10
    MIN_CLUSTER_SIZE = 3

    # Fetch entries with embeddings and mood scores
    entries = db.query(
        Entry.id,
        Entry.content,
        Entry.title,
        Entry.mood_user,
        Entry.mood_inferred
    ).join(
        EntryEmbedding, Entry.id == EntryEmbedding.entry_id
    ).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted.is_not(True),  # Handles NULL as not deleted
        EntryEmbedding.is_active.is_not(False)  # Handles NULL as active
    ).all()

    total_entries = len(entries)

    # Check for sufficient data
    if total_entries < MIN_ENTRIES:
        return SemanticMoodInsightsResponse(
            insights=[],
            total_entries=total_entries,
            has_sufficient_data=False
        )

    # Calculate effective mood for each entry (prefer user-provided)
    entries_with_mood = []
    for entry in entries:
        mood = entry.mood_user if entry.mood_user is not None else entry.mood_inferred
        if mood is not None:
            entries_with_mood.append({
                "id": entry.id,
                "content": entry.content,
                "title": entry.title,
                "mood": mood
            })

    if len(entries_with_mood) < MIN_ENTRIES:
        return SemanticMoodInsightsResponse(
            insights=[],
            total_entries=total_entries,
            has_sufficient_data=False
        )

    # Separate into high-mood and low-mood entries
    high_mood_entries = [e for e in entries_with_mood if e["mood"] >= 4]
    low_mood_entries = [e for e in entries_with_mood if e["mood"] <= 2]

    insights: List[SemanticMoodInsight] = []
    llm_service = get_generation_service_for_user(db, current_user.id)

    # Analyze high-mood entries
    if len(high_mood_entries) >= MIN_CLUSTER_SIZE:
        avg_mood = sum(e["mood"] for e in high_mood_entries) / len(high_mood_entries)
        entry_texts = [f"{e['title'] or ''}\n{e['content']}" for e in high_mood_entries]
        theme = await llm_service.extract_common_theme(entry_texts)

        insights.append(SemanticMoodInsight(
            type="positive_theme",
            theme=theme,
            avg_mood=round(avg_mood, 1),
            count=len(high_mood_entries),
            insight=f"Your mood lifts when writing about {theme}"
        ))

    # Analyze low-mood entries
    if len(low_mood_entries) >= MIN_CLUSTER_SIZE:
        avg_mood = sum(e["mood"] for e in low_mood_entries) / len(low_mood_entries)
        entry_texts = [f"{e['title'] or ''}\n{e['content']}" for e in low_mood_entries]
        theme = await llm_service.extract_common_theme(entry_texts)

        insights.append(SemanticMoodInsight(
            type="negative_theme",
            theme=theme,
            avg_mood=round(avg_mood, 1),
            count=len(low_mood_entries),
            insight=f"Entries about {theme} tend toward lower mood"
        ))

    # Calculate overall mood trend if we have enough data
    if len(entries_with_mood) >= 20:
        # Compare first half to second half by entry order (roughly chronological)
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
                insight=f"Your overall mood has been {direction} over time"
            ))

    return SemanticMoodInsightsResponse(
        insights=insights,
        total_entries=total_entries,
        has_sufficient_data=True
    )

