from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSON, ARRAY
from pgvector.sqlalchemy import Vector
from app.database import Base


class SemanticCluster(Base):
    """
    Represents a cluster of semantically related journal entries.
    Clusters are discovered via HDBSCAN on entry embeddings.
    """
    __tablename__ = "semantic_clusters"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cluster_algorithm = Column(String(50), default="hdbscan")
    min_cluster_size = Column(Integer, default=5)
    centroid = Column(Vector(1024), nullable=True)  # Average of member embeddings
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_stale = Column(Boolean, default=False, index=True)  # Mark for reclustering

    # Relationships
    user = relationship("User", back_populates="clusters")
    memberships = relationship("EntryClusterMembership", back_populates="cluster", cascade="all, delete-orphan")
    label = relationship("ClusterLabel", back_populates="cluster", uselist=False, cascade="all, delete-orphan")


class ClusterSnapshot(Base):
    """
    Stores metadata about a clustering run for temporal analysis.
    Each snapshot represents the state of clusters at a point in time.
    """
    __tablename__ = "cluster_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    snapshot_date = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    total_entries = Column(Integer, nullable=False)
    total_clusters = Column(Integer, nullable=False)
    noise_count = Column(Integer, nullable=True)  # Entries not assigned to any cluster
    snapshot_metadata = Column(JSON, nullable=True)  # Algorithm params, quality metrics

    # Relationships
    user = relationship("User", back_populates="cluster_snapshots")
    memberships = relationship("EntryClusterMembership", back_populates="snapshot")


class EntryClusterMembership(Base):
    """
    Many-to-many relationship between entries and clusters.
    Supports soft clustering with membership scores.
    """
    __tablename__ = "entry_cluster_memberships"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("entries.id", ondelete="CASCADE"), nullable=False, index=True)
    cluster_id = Column(Integer, ForeignKey("semantic_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    membership_score = Column(Float, default=1.0)  # For soft clustering algorithms
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    snapshot_id = Column(Integer, ForeignKey("cluster_snapshots.id"), nullable=True, index=True)

    # Relationships
    entry = relationship("Entry", back_populates="cluster_memberships")
    cluster = relationship("SemanticCluster", back_populates="memberships")
    snapshot = relationship("ClusterSnapshot", back_populates="memberships")


class ClusterLabel(Base):
    """
    LLM-generated human-readable labels for clusters.
    """
    __tablename__ = "cluster_labels"

    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(Integer, ForeignKey("semantic_clusters.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    label = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    representative_entry_ids = Column(ARRAY(Integer), default=[])  # Top 3-5 entry IDs
    confidence = Column(Float, nullable=True)  # LLM confidence score
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    cluster = relationship("SemanticCluster", back_populates="label")


class ClusterTransition(Base):
    """
    Tracks how clusters evolve over time (splits, merges, drifts).
    """
    __tablename__ = "cluster_transitions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    old_cluster_id = Column(Integer, ForeignKey("semantic_clusters.id", ondelete="SET NULL"), nullable=True)
    new_cluster_id = Column(Integer, ForeignKey("semantic_clusters.id", ondelete="SET NULL"), nullable=True)
    transition_type = Column(String(50), nullable=False)  # 'split', 'merge', 'drift', 'new', 'dissolved'
    transition_date = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    affected_entry_count = Column(Integer, nullable=True)
    transition_metadata = Column(JSON, nullable=True)  # Detailed metrics

    # Relationships
    user = relationship("User", back_populates="cluster_transitions")
