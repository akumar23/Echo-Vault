import redis
import json
from typing import Optional
from app.core.config import settings


class ReflectionCache:
    """Redis-based cache for user reflections"""

    REFLECTION_KEY_PREFIX = "reflection:user:"
    REFLECTION_TTL = 60 * 60 * 24 * 7  # 7 days TTL

    def __init__(self):
        self.redis = redis.from_url(settings.redis_url, decode_responses=True)

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
