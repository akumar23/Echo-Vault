from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "journal",
    broker=settings.redis_url,
    backend=settings.redis_url
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Celery Beat schedule
celery_app.conf.beat_schedule = {
    "weekly-insights-friday-midnight": {
        "task": "insights.nightly_insights",
        "schedule": crontab(hour=0, minute=0, day_of_week=5),  # Friday at 00:00 UTC
    },
}

# Auto-discover tasks in the jobs module
celery_app.autodiscover_tasks(['app.jobs'])

