import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import Text, TypeDecorator

from app.core.config import settings

logger = logging.getLogger(__name__)

# Prefix for Fernet-encrypted LLM provider API tokens in Settings rows.
_TOKEN_PREFIX = "enc:"

# Prefix for Fernet-encrypted entry content/title, versioned so future scheme
# migrations can coexist with existing ciphertext.
_CONTENT_PREFIX = "encv1:"


def _get_fernet() -> Optional[Fernet]:
    if not settings.encryption_key:
        return None
    try:
        return Fernet(settings.encryption_key.encode())
    except Exception:
        logger.warning("Invalid ENCRYPTION_KEY — at-rest encryption disabled")
        return None


def encrypt_token(token: str) -> str:
    """Encrypt an LLM API token. Returns 'enc:<ciphertext>' or plaintext if key not configured."""
    fernet = _get_fernet()
    if not fernet:
        return token
    encrypted = fernet.encrypt(token.encode()).decode()
    return f"{_TOKEN_PREFIX}{encrypted}"


def decrypt_token(stored: str) -> str:
    """Decrypt a stored LLM API token. Falls back gracefully for legacy plaintext."""
    if not stored or not stored.startswith(_TOKEN_PREFIX):
        return stored  # Legacy plaintext — return as-is

    fernet = _get_fernet()
    if not fernet:
        logger.error("Cannot decrypt token: ENCRYPTION_KEY not configured")
        return ""  # Return empty so the LLM call fails with auth error, not a data leak

    try:
        encrypted_part = stored[len(_TOKEN_PREFIX):]
        return fernet.decrypt(encrypted_part.encode()).decode()
    except InvalidToken:
        logger.error("Failed to decrypt LLM API token — token may be corrupt or key may have changed")
        return ""


class ContentDecryptionError(RuntimeError):
    """Raised when encrypted entry content cannot be decrypted.

    Surfaced loudly (rather than returning empty string) because silent failure
    on journal content would be indistinguishable from a genuinely empty entry.
    """


def encrypt_content(plaintext: str) -> str:
    """Encrypt entry content/title. Returns 'encv1:<ciphertext>', or plaintext
    unchanged when no key is configured (dev) or input is empty/None."""
    if plaintext is None or plaintext == "":
        return plaintext
    fernet = _get_fernet()
    if not fernet:
        return plaintext
    encrypted = fernet.encrypt(plaintext.encode()).decode()
    return f"{_CONTENT_PREFIX}{encrypted}"


def decrypt_content(stored: Optional[str]) -> Optional[str]:
    """Decrypt entry content/title. Passes through None, empty strings, and
    legacy plaintext rows (no prefix) unchanged. Raises on decrypt failure."""
    if stored is None or stored == "":
        return stored
    if not stored.startswith(_CONTENT_PREFIX):
        return stored  # Legacy plaintext row — return as-is

    fernet = _get_fernet()
    if not fernet:
        raise ContentDecryptionError(
            "Encrypted entry content encountered but ENCRYPTION_KEY is not configured"
        )

    try:
        encrypted_part = stored[len(_CONTENT_PREFIX):]
        return fernet.decrypt(encrypted_part.encode()).decode()
    except InvalidToken as exc:
        raise ContentDecryptionError(
            "Failed to decrypt entry content — ciphertext corrupt or ENCRYPTION_KEY changed"
        ) from exc


class EncryptedText(TypeDecorator):
    """Transparent at-rest encryption for TEXT columns.

    Writes go through ``encrypt_content``; reads through ``decrypt_content``.
    Legacy plaintext rows remain readable because ``decrypt_content`` only
    unwraps values carrying the ``encv1:`` prefix.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt_content(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return decrypt_content(value)
