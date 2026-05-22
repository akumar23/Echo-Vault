from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.database import SessionLocal
from app.models.entry import Entry
from app.services.context_service import Intent, context_service
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

        # Pull mood context via ContextService: balanced few-shot examples
        # from this user's own labeled entries (when enough exist) plus the
        # user's mood baseline. This calibrates the LLM against the user's
        # personal scale rather than relying on a generic 1-5 rubric.
        bundle = asyncio.run(
            context_service.get_context(
                db=db,
                user_id=entry.user_id,
                intent=Intent.MOOD,
                anchor_entry_id=entry_id,
                k=0,  # Intent.MOOD doesn't use related_entries for the prompt
            )
        )

        examples_for_prompt = [
            {"content": ex.content, "mood": ex.mood}
            for ex in bundle.mood_examples
        ]

        mood, confidence = asyncio.run(
            generation_service.infer_mood(
                entry.content,
                examples=examples_for_prompt or None,
                baseline_mean=bundle.user_baseline.mood_user_mean,
            )
        )

        # Persist both — the UI gates display on confidence so low-confidence
        # guesses don't masquerade as authoritative.
        entry.mood_inferred = mood
        entry.mood_confidence = confidence
        db.commit()

        logger.info(
            "Inferred mood",
            extra={
                "entry_id": entry_id,
                "mood": mood,
                "confidence": confidence,
                "few_shot_examples": len(examples_for_prompt),
            },
        )
    finally:
        db.close()


def enqueue_mood_job(entry_id: int):
    """Enqueue mood inference job"""
    infer_mood_task.delay(entry_id)

