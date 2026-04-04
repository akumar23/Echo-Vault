import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)

_ENCRYPTED_PREFIX = "enc:"


def _get_fernet() -> Optional[Fernet]:
    if not settings.encryption_key:
        return None
    try:
        return Fernet(settings.encryption_key.encode())
    except Exception:
        logger.warning("Invalid ENCRYPTION_KEY — LLM token encryption disabled")
        return None


def encrypt_token(token: str) -> str:
    """Encrypt a token. Returns 'enc:<ciphertext>' or plaintext if key not configured."""
    fernet = _get_fernet()
    if not fernet:
        return token
    encrypted = fernet.encrypt(token.encode()).decode()
    return f"{_ENCRYPTED_PREFIX}{encrypted}"


def decrypt_token(stored: str) -> str:
    """Decrypt a stored token. Falls back gracefully for legacy plaintext tokens."""
    if not stored or not stored.startswith(_ENCRYPTED_PREFIX):
        return stored  # Legacy plaintext — return as-is

    fernet = _get_fernet()
    if not fernet:
        logger.error("Cannot decrypt token: ENCRYPTION_KEY not configured")
        return ""  # Return empty so the LLM call fails with auth error, not a data leak

    try:
        encrypted_part = stored[len(_ENCRYPTED_PREFIX):]
        return fernet.decrypt(encrypted_part.encode()).decode()
    except InvalidToken:
        logger.error("Failed to decrypt LLM API token — token may be corrupt or key may have changed")
        return ""
