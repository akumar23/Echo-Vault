from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.encryption import EncryptedText
from app.database import Base


class Entry(Base):
    __tablename__ = "entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(EncryptedText, nullable=True)
    content = Column(EncryptedText, nullable=False)
    tags = Column(JSON, default=list)
    mood_user = Column(Integer, nullable=True)  # 1-5 from UI
    mood_inferred = Column(Integer, nullable=True)  # 1-5 from LLM
    reflection = Column(EncryptedText, nullable=True)
    reflection_status = Column(String(16), nullable=True)  # pending|generating|complete|error
    reflection_generated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_deleted = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="entries")
    embeddings = relationship("EntryEmbedding", back_populates="entry", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="entry", cascade="all, delete-orphan")

