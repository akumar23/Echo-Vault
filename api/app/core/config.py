import os

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional


def _is_production() -> bool:
    return os.getenv("ENV", "").lower() == "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    database_url: str = "postgresql+psycopg://echovault:echovault@db:5432/echovault"

    @field_validator("database_url", mode="after")
    @classmethod
    def fix_postgres_scheme(cls, v: str) -> str:
        """Convert postgresql:// to postgresql+psycopg:// for psycopg driver compatibility."""
        if v.startswith("postgresql://") and "+psycopg" not in v:
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    redis_url: str = "redis://redis:6379/0"
    jwt_secret: str = "change_me"  # MUST be changed in production!
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15  # Short-lived; refreshed automatically
    jwt_refresh_token_expire_days: int = 7
    upload_dir: str = "/data/uploads"

    @field_validator("jwt_secret", mode="after")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """Refuse to start in production with a placeholder or short JWT secret."""
        if _is_production():
            if v == "change_me":
                raise ValueError(
                    "jwt_secret is set to the default 'change_me' in production. "
                    "Set JWT_SECRET to a strong random value."
                )
            if len(v) < 32:
                raise ValueError(
                    "jwt_secret must be at least 32 characters in production "
                    f"(got {len(v)})."
                )
        return v

    # Cookie settings — set COOKIE_SECURE=true and COOKIE_SAME_SITE=none in production (HTTPS + cross-origin)
    cookie_secure: bool = False
    cookie_same_site: str = "lax"

    # Fernet key for encrypting LLM API tokens at rest.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""

    @field_validator("encryption_key", mode="after")
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        """Refuse to start in production without an encryption_key set."""
        if _is_production() and not v:
            raise ValueError(
                "encryption_key must be set in production. Generate with: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        return v

    # Default LLM settings (used when user has no custom settings)
    default_generation_url: str = "http://ollama:11434"
    default_generation_model: str = "llama3.1:8b"
    default_embedding_url: str = "http://ollama:11434"
    default_embedding_model: str = "mxbai-embed-large"

    # Dimension of embedding vectors produced by default_embedding_model.
    # Must match the pgvector column width — changing this requires a migration.
    embedding_dim: int = 1024


settings = Settings()

