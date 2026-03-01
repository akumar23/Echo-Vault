import ssl
import redis
import json
import logging
import time
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
    HEALTH_CHECK_CACHE_TTL = 30  # Cache health check result for 30 seconds

    _redis_client: Optional[redis.Redis] = None
    _health_check_cache: Optional[tuple] = None  # (result, timestamp)

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
        """Check if Redis connection is healthy.

        Results are cached for 30 seconds to reduce Redis operations
        from frequent health checks (e.g., from Railway/Render).
        """
        now = time.time()

        # Return cached result if still valid
        if self._health_check_cache is not None:
            result, cached_at = self._health_check_cache
            if now - cached_at < self.HEALTH_CHECK_CACHE_TTL:
                return result

        # Perform actual ping and cache result
        try:
            result = self.redis.ping()
            self._health_check_cache = (result, now)
            return result
        except Exception:
            self._health_check_cache = (False, now)
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
        """Update just the status (e.g., mark as 'generating').

        Uses a Lua script to atomically GET + SET in a single Redis round-trip,
        reducing Redis operations by 50% for status updates.
        """
        key = self._get_key(user_id)

        # Lua script: get existing value, update status, set with TTL
        # This reduces 2 Redis operations (GET + SETEX) to 1
        lua_script = """
        local existing = redis.call('GET', KEYS[1])
        local reflection = ''
        if existing then
            local data = cjson.decode(existing)
            reflection = data.reflection or ''
        end
        local new_data = cjson.encode({reflection = reflection, status = ARGV[1]})
        return redis.call('SETEX', KEYS[1], ARGV[2], new_data)
        """
        self.redis.eval(lua_script, 1, key, status, self.REFLECTION_TTL)

    def delete_reflection(self, user_id: int) -> None:
        """Delete cached reflection for a user"""
        key = self._get_key(user_id)
        self.redis.delete(key)


reflection_cache = ReflectionCache()
