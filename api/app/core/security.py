import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _sha256_hex(password: str) -> str:
    """SHA-256 hex digest of a password (64 ASCII chars, safely under bcrypt's 72-byte limit)."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its bcrypt hash.

    Tries direct verification first (standard path for all new passwords).
    Falls back to SHA-256 preprocessing for passwords hashed before the
    72-byte validator was added (backward compat only).
    """
    if pwd_context.verify(plain_password, hashed_password):
        return True
    # Backward compat: old passwords longer than 72 bytes were pre-hashed with SHA-256
    if pwd_context.verify(_sha256_hex(plain_password), hashed_password):
        return True
    return False


def get_password_hash(password: str) -> str:
    """Hash a password with bcrypt. Passwords are validated to ≤72 bytes at the API layer."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def generate_refresh_token() -> str:
    """Generate a cryptographically secure opaque refresh token."""
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    """SHA-256 hash a token for safe Redis storage (never store raw tokens)."""
    return hashlib.sha256(token.encode()).hexdigest()
