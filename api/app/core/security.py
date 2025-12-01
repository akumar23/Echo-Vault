from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings
import hashlib

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _prepare_password_for_bcrypt(password: str) -> str:
    """
    Bcrypt has a 72-byte limit. For passwords >= 70 bytes, we hash them first with SHA-256
    to get a fixed 64-byte hexdigest, then bcrypt that. This allows passwords of any length.
    Using 70 bytes as threshold to provide a safety margin.
    """
    password_bytes = password.encode('utf-8')
    if len(password_bytes) >= 70:
        # Hash long passwords with SHA-256 first (produces 64-byte hexdigest)
        # This ensures we never exceed bcrypt's 72-byte limit
        return hashlib.sha256(password_bytes).hexdigest()
    return password


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password, handling both short passwords (direct bcrypt) and long passwords
    (SHA-256 hashed then bcrypted). Tries both methods for backward compatibility.
    """
    # Try with preprocessing first (for new passwords, especially long ones)
    prepared = _prepare_password_for_bcrypt(plain_password)
    if pwd_context.verify(prepared, hashed_password):
        return True
    
    # Try direct verification for backward compatibility (old passwords stored without preprocessing)
    if pwd_context.verify(plain_password, hashed_password):
        return True
    
    return False


def get_password_hash(password: str) -> str:
    """
    Hash password with bcrypt. For passwords >= 72 bytes, hash with SHA-256 first.
    This removes the 72-byte restriction completely by preprocessing long passwords.
    """
    prepared = _prepare_password_for_bcrypt(password)
    try:
        return pwd_context.hash(prepared)
    except ValueError as e:
        # If passlib still complains about length (shouldn't happen, but handle it)
        if "72 bytes" in str(e) or "truncate" in str(e).lower():
            # Force SHA-256 preprocessing and retry
            password_bytes = password.encode('utf-8')
            if len(password_bytes) < 72:
                # This shouldn't happen, but if it does, hash it anyway
                prepared = hashlib.sha256(password_bytes).hexdigest()
            return pwd_context.hash(prepared)
        raise


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None

