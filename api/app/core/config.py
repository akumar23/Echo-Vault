from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional


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

    # Cookie settings — set COOKIE_SECURE=true and COOKIE_SAME_SITE=none in production (HTTPS + cross-origin)
    cookie_secure: bool = False
    cookie_same_site: str = "lax"

    # Fernet key for encrypting LLM API tokens at rest.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""

    # Default LLM settings (used when user has no custom settings)
    default_generation_url: str = "http://ollama:11434"
    default_generation_model: str = "llama3.1:8b"
    default_embedding_url: str = "http://ollama:11434"
    default_embedding_model: str = "mxbai-embed-large"


settings = Settings()

