from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.entry import Entry
from app.services.llm_service import get_generation_service_for_user
from app.services.reflection_cache import reflection_cache
from app.celery_app import celery_app
import asyncio
import httpx
import logging

logger = logging.getLogger(__name__)

_ERROR_STATUS_TTL_SECONDS = 60


@celery_app.task(
    name="reflection.generate_reflection",
    ignore_result=True,
    time_limit=180,  # Hard kill at 3 minutes (reflections take longer)
    soft_time_limit=150,  # Graceful shutdown at 2.5 minutes
    autoretry_for=(httpx.HTTPError, httpx.TimeoutException, ConnectionError),
    retry_kwargs={"max_retries": 2, "countdown": 60},
    retry_backoff=True,
    retry_backoff_max=300,
)
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

    except (httpx.HTTPError, httpx.TimeoutException, ConnectionError):
        # Transient failures — let Celery retry. Don't poison the cache here;
        # the "generating" marker set earlier is fine while retries run.
        logger.exception(
            "Transient error generating reflection, retrying",
            extra={"user_id": user_id},
        )
        raise
    except Exception:
        logger.exception(
            "Fatal error generating reflection",
            extra={"user_id": user_id},
        )
        reflection_cache.set_reflection(
            user_id,
            "Unable to generate reflection at this time. Please try again later.",
            status="error",
            ttl=_ERROR_STATUS_TTL_SECONDS,
        )
    finally:
        db.close()


def enqueue_reflection_job(user_id: int):
    """Enqueue reflection generation job for a user"""
    generate_reflection_task.delay(user_id)


@celery_app.task(
    name="reflection.generate_entry_reflection",
    ignore_result=True,
    time_limit=180,
    soft_time_limit=150,
    autoretry_for=(httpx.HTTPError, httpx.TimeoutException, ConnectionError),
    retry_kwargs={"max_retries": 2, "countdown": 60},
    retry_backoff=True,
    retry_backoff_max=300,
)
def generate_entry_reflection_task(user_id: int, entry_id: int):
    """Generate and persist a reflection scoped to a single entry.

    Status is tracked directly on the Entry row so each entry can display
    its own reflection across visits without sharing the user-wide Redis cache.
    """
    db = SessionLocal()
    try:
        entry = (
            db.query(Entry)
            .filter(
                Entry.id == entry_id,
                Entry.user_id == user_id,
                Entry.is_deleted == False,  # noqa: E712
            )
            .first()
        )
        if entry is None:
            logger.warning(
                "Entry not found for reflection",
                extra={"user_id": user_id, "entry_id": entry_id},
            )
            return

        entry.reflection_status = "generating"
        db.commit()

        generation_service = get_generation_service_for_user(db, user_id)

        entry_text = (
            f"[{entry.created_at.date()}] {entry.title or 'Untitled'}\n{entry.content}"
        )

        reflection_text = asyncio.run(
            generation_service.generate_reflection(entry_text)
        )

        entry.reflection = reflection_text
        entry.reflection_status = "complete"
        entry.reflection_generated_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            "Generated entry reflection",
            extra={"user_id": user_id, "entry_id": entry_id},
        )

    except (httpx.HTTPError, httpx.TimeoutException, ConnectionError):
        logger.exception(
            "Transient error generating entry reflection, retrying",
            extra={"user_id": user_id, "entry_id": entry_id},
        )
        raise
    except Exception:
        logger.exception(
            "Fatal error generating entry reflection",
            extra={"user_id": user_id, "entry_id": entry_id},
        )
        try:
            entry = (
                db.query(Entry)
                .filter(Entry.id == entry_id, Entry.user_id == user_id)
                .first()
            )
            if entry is not None:
                entry.reflection_status = "error"
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


def enqueue_entry_reflection_job(user_id: int, entry_id: int) -> None:
    """Enqueue reflection generation for a specific entry."""
    generate_entry_reflection_task.delay(user_id, entry_id)
