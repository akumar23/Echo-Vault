from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.entry import Entry
from app.models.insight import Insight
from app.services.context_service import Intent, context_service
from app.services.llm_service import get_generation_service_for_user
from app.celery_app import celery_app
from datetime import datetime, timedelta
import asyncio


@celery_app.task(
    name="insights.generate_insights",
    ignore_result=True,
    time_limit=180,  # Hard kill at 3 minutes
    soft_time_limit=150,  # Graceful shutdown at 2.5 minutes
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 2, "countdown": 120},
    retry_backoff=True,
)
def generate_insights_task(user_id: int, days: int = 7):
    """
    Background task to generate insights for a user.

    Note: Uses asyncio.run() to call async LLMService methods. This pattern
    is intentional - the event loop creation overhead (~50-200μs) is negligible
    compared to LLM inference time (~5-30s). Alternative approaches would add
    complexity without meaningful performance benefit.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        # Get user-specific generation service
        generation_service = get_generation_service_for_user(db, user_id)

        # Pull recent window + MMR-diverse older themed entries via ContextService.
        # The centroid-anchored related_entries surface recurring patterns
        # from outside the window — the substantive upgrade over the old
        # chronological-concatenation approach.
        bundle = asyncio.run(
            context_service.get_context(
                db=db,
                user_id=user_id,
                intent=Intent.INSIGHTS,
                time_window_days=days,
                k=8,  # older themed entries to surface
            )
        )

        if bundle.cold_start or not bundle.recent_window:
            return

        start_date = datetime.now() - timedelta(days=days)

        recent_text = "\n\n".join(
            f"[{e.created_at.date()}] {e.title or 'Untitled'}\n{e.content}"
            for e in bundle.recent_window
        )

        if bundle.related_entries:
            older_text = "\n\n".join(
                f"[{e.created_at.date()}] {e.title or 'Untitled'}\n{e.content}"
                for e in bundle.related_entries
            )
            insights_data = asyncio.run(
                generation_service.generate_insights_with_themes(
                    recent_entries_text=recent_text,
                    older_themed_text=older_text,
                )
            )
        else:
            # No older corpus or all entries fell within the window — use the
            # generic single-bucket prompt.
            insights_data = asyncio.run(
                generation_service.generate_insights(recent_text)
            )

        # Create insight record
        insight = Insight(
            user_id=user_id,
            summary=insights_data["summary"],
            themes=insights_data.get("themes", []),
            actions=insights_data.get("actions", []),
            period_start=start_date,
            period_end=datetime.now()
        )
        db.add(insight)
        db.commit()
    finally:
        db.close()


_NIGHTLY_BATCH_SIZE = 100  # Users per batch — prevents OOM on large deployments


@celery_app.task(
    name="insights.nightly_insights",
    ignore_result=True,
    time_limit=60,  # Hard kill at 1 minute (just enqueues tasks)
    soft_time_limit=45,
)
def nightly_insights_task():
    """
    Enqueue insights generation for all active users.

    Uses cursor-based batching (BATCH_SIZE rows at a time) to avoid loading
    the entire user table into memory. Only fetches user IDs, not full rows.
    """
    db = SessionLocal()
    try:
        last_id = 0
        while True:
            batch = (
                db.query(User.id)
                .filter(User.is_active == True, User.id > last_id)
                .order_by(User.id)
                .limit(_NIGHTLY_BATCH_SIZE)
                .all()
            )
            if not batch:
                break
            for (user_id,) in batch:
                generate_insights_task.delay(user_id, days=7)
                generate_insights_task.delay(user_id, days=30)
            last_id = batch[-1][0]
    finally:
        db.close()


def enqueue_insights_job(user_id: int, days: int = 7):
    """Enqueue insights generation job"""
    generate_insights_task.delay(user_id, days)

