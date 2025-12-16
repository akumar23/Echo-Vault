from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://journal:journal@localhost:5432/journal"
    redis_url: str = "redis://redis:6379/0"
    ollama_url: str = "http://ollama:11434"  # Deprecated, use generation/embedding URLs
    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    upload_dir: str = "/data/uploads"
    reflection_model: str = "llama3.1:8b"  # Deprecated, use default_generation_model
    embed_model: str = "mxbai-embed-large"  # Deprecated, use default_embedding_model

    # Default LLM settings (used when user has no custom settings)
    default_generation_url: str = "http://ollama:11434"
    default_generation_model: str = "llama3.1:8b"
    default_embedding_url: str = "http://ollama:11434"
    default_embedding_model: str = "mxbai-embed-large"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

