"""
Redis-backed store for short-lived auth tokens.

Stores:
- Refresh tokens (7-day TTL, revokable on logout)
- WebSocket one-time tickets (60s TTL, consumed on first use)
"""
import logging
import secrets
from typing import Optional

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_REFRESH_PREFIX = "refresh_token:"
_WS_TICKET_PREFIX = "ws_ticket:"


class TokenStore:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            self._client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
            )
        return self._client

    # --- Refresh tokens ---

    def store_refresh_token(self, token_hash: str, user_id: int) -> bool:
        try:
            ttl = settings.jwt_refresh_token_expire_days * 86400
            self._get_client().setex(f"{_REFRESH_PREFIX}{token_hash}", ttl, str(user_id))
            return True
        except redis.RedisError:
            logger.warning(
                "Redis unavailable for %s",
                "store_refresh_token",
                exc_info=True,
                extra={"user_id": user_id},
            )
            return False

    def validate_refresh_token(self, token_hash: str) -> Optional[int]:
        """Returns user_id if valid and not expired/revoked, else None."""
        try:
            value = self._get_client().get(f"{_REFRESH_PREFIX}{token_hash}")
            return int(value) if value is not None else None
        except redis.RedisError:
            logger.warning(
                "Redis unavailable for %s",
                "validate_refresh_token",
                exc_info=True,
            )
            return None

    def revoke_refresh_token(self, token_hash: str) -> bool:
        try:
            self._get_client().delete(f"{_REFRESH_PREFIX}{token_hash}")
            return True
        except redis.RedisError:
            # Redis is unreachable — we cannot confirm revocation, so the
            # token may remain valid server-side until its TTL expires.
            logger.error(
                "Redis unavailable for revoke_refresh_token; token may remain valid server-side",
                exc_info=True,
            )
            return False

    # --- WebSocket one-time tickets ---

    def create_ws_ticket(self, user_id: int) -> str:
        """Issue a one-time ticket valid for 60 seconds for WebSocket auth."""
        ticket = secrets.token_urlsafe(32)
        try:
            self._get_client().setex(f"{_WS_TICKET_PREFIX}{ticket}", 60, str(user_id))
        except redis.RedisError:
            logger.warning(
                "Redis unavailable for %s",
                "create_ws_ticket",
                exc_info=True,
                extra={"user_id": user_id},
            )
        return ticket

    def consume_ws_ticket(self, ticket: str) -> Optional[int]:
        """Validate and immediately delete a WS ticket (one-time use). Returns user_id or None."""
        try:
            client = self._get_client()
            key = f"{_WS_TICKET_PREFIX}{ticket}"
            pipe = client.pipeline()
            pipe.get(key)
            pipe.delete(key)
            value, _ = pipe.execute()
            return int(value) if value is not None else None
        except redis.RedisError:
            logger.warning(
                "Redis unavailable for %s",
                "consume_ws_ticket",
                exc_info=True,
            )
            return None


token_store = TokenStore()
