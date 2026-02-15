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
    # Reduce Redis commands by not storing results and setting TTL
    "task_ignore_result": True,
    "result_expires": 3600,  # 1 hour TTL for any results that are stored
    # REDIS OPTIMIZATION: Reduce polling frequency to save on Redis operations
    # Beat scheduler: check every 5 minutes instead of every 5 seconds (default)
    # This reduces ~17,280 Redis ops/day to ~288 ops/day for scheduler alone
    "beat_max_loop_interval": 300,  # 5 minutes
    # Worker: reduce broker heartbeat frequency (default is 120s, but let's be explicit)
    "broker_heartbeat": 120,
    # Disable worker events to reduce Redis traffic (unless you need Flower monitoring)
    "worker_send_task_events": False,
    "task_send_sent_event": False,
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

