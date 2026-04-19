from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.database import SessionLocal
from app.models.entry import Entry
from app.services.llm_service import get_generation_service_for_user
from app.celery_app import celery_app
import asyncio
import httpx
import logging
import redis

logger = logging.getLogger(__name__)


@celery_app.task(
    name="mood.infer_mood",
    ignore_result=True,
    time_limit=120,  # Hard kill at 2 minutes
    soft_time_limit=90,  # Graceful shutdown at 90 seconds
    autoretry_for=(
        httpx.HTTPError,
        httpx.TimeoutException,
        ConnectionError,
        redis.RedisError,
        SQLAlchemyError,
    ),
    retry_kwargs={"max_retries": 3, "countdown": 60},
    retry_backoff=True,
    retry_backoff_max=300,
)
def infer_mood_task(entry_id: int):
    """
    Background task to infer mood for an entry.

    Note: Uses asyncio.run() to call async LLMService methods. This pattern
    is intentional - the event loop creation overhead (~50-200μs) is negligible
    compared to LLM inference time (~1-5s). Alternative approaches would add
    complexity without meaningful performance benefit.
    """
    db = SessionLocal()
    try:
        entry = db.query(Entry).filter(Entry.id == entry_id).first()
        if not entry:
            logger.warning(f"Entry {entry_id} not found for mood inference")
            return

        # Get user-specific generation service
        generation_service = get_generation_service_for_user(db, entry.user_id)

        # Infer mood using OpenAI-compatible API
        mood = asyncio.run(generation_service.infer_mood(entry.content))

        # Update entry
        entry.mood_inferred = mood
        db.commit()

        # Log successful inference
        logger.info(f"Successfully inferred mood {mood} for entry {entry_id}")
    finally:
        db.close()


def enqueue_mood_job(entry_id: int):
    """Enqueue mood inference job"""
    infer_mood_task.delay(entry_id)

