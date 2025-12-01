from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.entry import Entry
from app.services.ollama_service import ollama_service
from app.celery_app import celery_app
import asyncio
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="mood.infer_mood")
def infer_mood_task(entry_id: int):
    """
    Background task to infer mood for an entry.

    Note: Uses asyncio.run() to call async OllamaService methods. This pattern
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

        # Infer mood from Ollama
        mood = asyncio.run(ollama_service.infer_mood(entry.content))

        # Update entry
        entry.mood_inferred = mood
        db.commit()

        # Log successful inference
        logger.info(f"Successfully inferred mood {mood} for entry {entry_id}")
    except Exception as e:
        logger.error(f"Error inferring mood for entry {entry_id}: {str(e)}")
        raise
    finally:
        db.close()


def enqueue_mood_job(entry_id: int):
    """Enqueue mood inference job"""
    infer_mood_task.delay(entry_id)

