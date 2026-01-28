from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    search_half_life_days = Column(Float, default=30.0)  # Default 30 days
    privacy_hard_delete = Column(Boolean, default=False)
    ollama_url = Column(String, nullable=True, default=None)  # TODO: Remove via migration (unused legacy field)

    # Generation LLM settings (reflections, insights, mood)
    generation_url = Column(String, nullable=True, default=None)
    generation_api_token = Column(String, nullable=True, default=None)
    generation_model = Column(String, nullable=True, default=None)

    # Embedding LLM settings (semantic search)
    embedding_url = Column(String, nullable=True, default=None)
    embedding_api_token = Column(String, nullable=True, default=None)
    embedding_model = Column(String, nullable=True, default=None)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="settings")

