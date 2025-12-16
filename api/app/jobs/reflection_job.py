from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.entry import Entry
from app.services.llm_service import get_generation_service_for_user
from app.services.reflection_cache import reflection_cache
from app.celery_app import celery_app
import asyncio
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="reflection.generate_reflection")
def generate_reflection_task(user_id: int):
    """
    Background task to generate and cache reflection for a user.

    Note: Uses asyncio.run() to call async LLMService methods. This pattern
    is intentional - the event loop creation overhead (~50-200μs) is negligible
    compared to LLM inference time (~5-30s). Alternative approaches would add
    complexity without meaningful performance benefit.
    """
    db = SessionLocal()
    try:
        # Mark as generating
        reflection_cache.set_status(user_id, "generating")

        # Get user-specific generation service
        generation_service = get_generation_service_for_user(db, user_id)

        # Get recent entries (last 7 days, max 10 entries)
        start_date = datetime.now() - timedelta(days=7)
        recent_entries = db.query(Entry).filter(
            Entry.user_id == user_id,
            Entry.is_deleted == False,
            Entry.created_at >= start_date
        ).order_by(Entry.created_at.desc()).limit(10).all()

        if not recent_entries:
            # No entries to reflect on
            reflection_cache.set_reflection(
                user_id,
                "No recent entries to reflect on. Start journaling to see reflections!",
                status="complete"
            )
            return

        # Format entries for reflection
        entries_text = "\n\n".join([
            f"[{e.created_at.date()}] {e.title or 'Untitled'}\n{e.content}"
            for e in recent_entries
        ])

        # Generate reflection using OpenAI-compatible API
        reflection = asyncio.run(generation_service.generate_reflection(entries_text))

        # Cache the result
        reflection_cache.set_reflection(user_id, reflection, status="complete")
        logger.info(f"Generated reflection for user {user_id}")

    except Exception as e:
        logger.error(f"Error generating reflection for user {user_id}: {e}")
        reflection_cache.set_reflection(
            user_id,
            "Unable to generate reflection at this time. Please try again later.",
            status="error"
        )
    finally:
        db.close()


def enqueue_reflection_job(user_id: int):
    """Enqueue reflection generation job for a user"""
    generate_reflection_task.delay(user_id)
