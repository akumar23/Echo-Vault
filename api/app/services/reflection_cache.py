import ssl
import redis
import json
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class ReflectionCache:
    """Redis-based cache for user reflections.

    Uses lazy initialization to avoid creating connections at import time.
    Connection pooling is limited to prevent exhausting free-tier Redis quotas.
    """

    REFLECTION_KEY_PREFIX = "reflection:user:"
    REFLECTION_TTL = 60 * 60 * 24 * 7  # 7 days TTL

    _redis_client: Optional[redis.Redis] = None

    @property
    def redis(self) -> redis.Redis:
        """Lazy-initialize Redis connection with proper pooling limits."""
        if self._redis_client is None:
            # Connection pool settings optimized for free-tier Redis (Upstash, etc.)
            pool_kwargs = {
                "decode_responses": True,
                "max_connections": 3,  # Limit connections per process
                "socket_connect_timeout": 5,
                "socket_timeout": 5,
                "retry_on_timeout": True,
            }

            # Add SSL configuration if using TLS (rediss://)
            if settings.redis_url.startswith("rediss://"):
                pool_kwargs["ssl_cert_reqs"] = ssl.CERT_REQUIRED

            self._redis_client = redis.from_url(settings.redis_url, **pool_kwargs)
            logger.info("Redis connection pool initialized (max_connections=3)")

        return self._redis_client

    def ping(self) -> bool:
        """Check if Redis connection is healthy."""
        try:
            return self.redis.ping()
        except Exception:
            return False

    def _get_key(self, user_id: int) -> str:
        return f"{self.REFLECTION_KEY_PREFIX}{user_id}"

    def get_reflection(self, user_id: int) -> Optional[dict]:
        """Get cached reflection for a user"""
        key = self._get_key(user_id)
        data = self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    def set_reflection(self, user_id: int, reflection: str, status: str = "complete") -> None:
        """Cache reflection for a user"""
        key = self._get_key(user_id)
        data = {
            "reflection": reflection,
            "status": status  # "generating", "complete", "error"
        }
        self.redis.setex(key, self.REFLECTION_TTL, json.dumps(data))

    def set_status(self, user_id: int, status: str) -> None:
        """Update just the status (e.g., mark as 'generating')"""
        key = self._get_key(user_id)
        existing = self.get_reflection(user_id)
        data = {
            "reflection": existing["reflection"] if existing else "",
            "status": status
        }
        self.redis.setex(key, self.REFLECTION_TTL, json.dumps(data))

    def delete_reflection(self, user_id: int) -> None:
        """Delete cached reflection for a user"""
        key = self._get_key(user_id)
        self.redis.delete(key)


reflection_cache = ReflectionCache()
