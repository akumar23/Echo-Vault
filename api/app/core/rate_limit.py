from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    # When Redis is unavailable, allow the request through rather than hard-failing
    strategy="fixed-window",
)
