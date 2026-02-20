import ssl
from celery import Celery
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

# Auto-discover tasks in the jobs module
celery_app.autodiscover_tasks(['app.jobs'])

