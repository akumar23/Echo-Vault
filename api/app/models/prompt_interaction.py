from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class PromptType(str, enum.Enum):
    QUESTION = "question"
    PROMPT = "prompt"
    CONTINUATION = "continuation"


class PromptAction(str, enum.Enum):
    DISPLAYED = "displayed"
    CLICKED = "clicked"
    CYCLED = "cycled"
    DISMISSED = "dismissed"
    COMPLETED = "completed"


class PromptInteraction(Base):
    __tablename__ = "prompt_interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    prompt_text = Column(Text, nullable=False)
    prompt_type = Column(String, nullable=False)  # question, prompt, continuation
    action = Column(String, nullable=False)  # displayed, clicked, cycled, dismissed, completed
    entry_id = Column(Integer, ForeignKey("entries.id", ondelete="CASCADE"), nullable=True)
    source_entry_id = Column(Integer, ForeignKey("entries.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="prompt_interactions")
    entry = relationship("Entry", foreign_keys=[entry_id])
    source_entry = relationship("Entry", foreign_keys=[source_entry_id])
