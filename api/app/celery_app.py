import ssl
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "journal",
    broker=settings.redis_url,
    # Result backend removed - all tasks use ignore_result=True
    # This eliminates ~30-50% of Redis operations from result cleanup/polling
)

# Base configuration - optimized for minimal Redis operations
celery_config = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "timezone": "UTC",
    "enable_utc": True,
    # No results stored (all tasks use ignore_result=True)
    "task_ignore_result": True,
    # Worker heartbeat - only needed for failure detection
    "broker_heartbeat": 120,
    # Disable all worker events to reduce Redis traffic
    "worker_send_task_events": False,
    "task_send_sent_event": False,
    # Broker transport options to minimize Redis polling
    "broker_transport_options": {
        # Visibility timeout for unacked messages (default is 1 hour)
        "visibility_timeout": 3600,
        # Reduce fanout prefix operations
        "fanout_prefix": True,
        "fanout_patterns": True,
        # Use BRPOP with longer timeout to reduce polling
        "socket_timeout": 30,
        "socket_connect_timeout": 5,
    },
    # Single worker process - sufficient for low-traffic/single-user
    # Override with CELERY_WORKER_CONCURRENCY env var if needed
    "worker_concurrency": 1,
    # Disable prefetching to reduce Redis operations
    "worker_prefetch_multiplier": 1,
}

# Add SSL configuration if using TLS (rediss://)
if settings.redis_url.startswith("rediss://"):
    ssl_config = {
        "ssl_cert_reqs": ssl.CERT_REQUIRED,
    }
    celery_config["broker_use_ssl"] = ssl_config

celery_app.conf.update(**celery_config)

# Auto-discover tasks in the jobs module
celery_app.autodiscover_tasks(['app.jobs'])

