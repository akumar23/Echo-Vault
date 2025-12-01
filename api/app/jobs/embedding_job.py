from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.services.ollama_service import ollama_service
from app.celery_app import celery_app
import asyncio


@celery_app.task(name="embedding.create_embedding")
def create_embedding_task(entry_id: int):
    """
    Background task to create embedding for an entry.

    Note: Uses asyncio.run() to call async OllamaService methods. This pattern
    is intentional - the event loop creation overhead (~50-200μs) is negligible
    compared to LLM inference time (~500ms-2s). Alternative approaches would add
    complexity without meaningful performance benefit.
    """
    db = SessionLocal()
    try:
        entry = db.query(Entry).filter(Entry.id == entry_id).first()
        if not entry:
            return

        # Get embedding from Ollama
        text_to_embed = f"{entry.title or ''} {entry.content}"
        embedding_vector = asyncio.run(ollama_service.get_embedding(text_to_embed))
        
        # Delete old embeddings for this entry
        db.query(EntryEmbedding).filter(EntryEmbedding.entry_id == entry_id).delete()

        # Create new embedding (pgvector will handle the conversion)
        embedding = EntryEmbedding(
            entry_id=entry_id,
            embedding=embedding_vector,  # pgvector will handle the conversion
            is_active=True
        )
        db.add(embedding)
        db.commit()
    finally:
        db.close()


def enqueue_embedding_job(entry_id: int):
    """Enqueue embedding job"""
    create_embedding_task.delay(entry_id)

