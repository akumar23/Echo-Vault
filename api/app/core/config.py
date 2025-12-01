from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://journal:journal@localhost:5432/journal"
    redis_url: str = "redis://redis:6379/0"
    ollama_url: str = "http://ollama:11434"
    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    upload_dir: str = "/data/uploads"
    reflection_model: str = "llama3.1:8b"
    embed_model: str = "mxbai-embed-large"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

