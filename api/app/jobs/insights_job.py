from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.entry import Entry
from app.models.insight import Insight
from app.services.llm_service import get_generation_service_for_user
from app.celery_app import celery_app
from datetime import datetime, timedelta
import asyncio


@celery_app.task(name="insights.generate_insights", ignore_result=True)
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

        # Get entries from last N days
        start_date = datetime.now() - timedelta(days=days)
        entries = db.query(Entry).filter(
            Entry.user_id == user_id,
            Entry.is_deleted == False,
            Entry.created_at >= start_date
        ).order_by(Entry.created_at).all()

        if not entries:
            return

        # Aggregate entries text
        entries_text = "\n\n".join([
            f"[{e.created_at.date()}] {e.title or 'Untitled'}\n{e.content}"
            for e in entries
        ])

        # Generate insights using OpenAI-compatible API
        insights_data = asyncio.run(generation_service.generate_insights(entries_text))
        
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


@celery_app.task(name="insights.nightly_insights", ignore_result=True)
def nightly_insights_task():
    """Nightly task to generate insights for all active users"""
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True).all()
        for user in users:
            generate_insights_task.delay(user.id, days=7)
            generate_insights_task.delay(user.id, days=30)
    finally:
        db.close()


def enqueue_insights_job(user_id: int, days: int = 7):
    """Enqueue insights generation job"""
    generate_insights_task.delay(user_id, days)

