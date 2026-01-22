import ssl
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "journal",
    broker=settings.redis_url,
    backend=settings.redis_url
)

# Base configuration
celery_config = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
}

# Add SSL configuration if using TLS (rediss://)
if settings.redis_url.startswith("rediss://"):
    ssl_config = {
        "ssl_cert_reqs": ssl.CERT_REQUIRED,
    }
    celery_config["broker_use_ssl"] = ssl_config
    celery_config["redis_backend_use_ssl"] = ssl_config

celery_app.conf.update(**celery_config)

# Celery Beat schedule
celery_app.conf.beat_schedule = {
    "weekly-insights-friday-midnight": {
        "task": "insights.nightly_insights",
        "schedule": crontab(hour=0, minute=0, day_of_week=5),  # Friday at 00:00 UTC
    },
}

# Auto-discover tasks in the jobs module
celery_app.autodiscover_tasks(['app.jobs'])

