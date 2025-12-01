from sqlalchemy import Column, Integer, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.database import Base


class EntryEmbedding(Base):
    __tablename__ = "entry_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("entries.id"), nullable=False)
    embedding = Column(Vector(1024), nullable=False)  # mxbai-embed-large produces 1024-dim vectors
    is_active = Column(Boolean, default=True)
    last_clustered_at = Column(DateTime(timezone=True), nullable=True)  # Tracks when entry was last clustered
    cluster_version = Column(Integer, default=0)  # Matches snapshot_id for staleness check

    entry = relationship("Entry", back_populates="embeddings")

