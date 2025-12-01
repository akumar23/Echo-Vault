from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class ClusterEntryPreview(BaseModel):
    """Preview of an entry within a cluster."""
    entry_id: int
    title: Optional[str]
    content: str  # Truncated content
    created_at: datetime
    tags: List[str] = []

    class Config:
        from_attributes = True


class ClusterResponse(BaseModel):
    """Summary view of a cluster."""
    cluster_id: int
    label: str
    description: str
    entry_count: int
    created_at: datetime
    is_stale: bool

    class Config:
        from_attributes = True


class ClusterDetailResponse(BaseModel):
    """Detailed view of a cluster with its entries."""
    cluster_id: int
    label: str
    description: str
    entries: List[ClusterEntryPreview]
    representative_entry_ids: List[int]
    created_at: datetime
    confidence: Optional[float] = None

    class Config:
        from_attributes = True


class ClusterEvolutionResponse(BaseModel):
    """Snapshot of cluster state at a point in time."""
    snapshot_id: int
    snapshot_date: datetime
    total_entries: int
    total_clusters: int
    noise_count: Optional[int]
    metadata: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class ClusterTransitionResponse(BaseModel):
    """Record of how a cluster changed."""
    transition_id: int
    old_cluster_id: Optional[int]
    new_cluster_id: Optional[int]
    transition_type: str
    transition_date: datetime
    affected_entry_count: Optional[int]
    metadata: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class TriggerClusteringResponse(BaseModel):
    """Response when triggering clustering job."""
    status: str
    message: str


class ClusteringResultResponse(BaseModel):
    """Result of a completed clustering job."""
    status: str
    snapshot_id: Optional[int] = None
    clusters_created: Optional[int] = None
    noise_entries: Optional[int] = None
    error: Optional[str] = None
    reason: Optional[str] = None


class ClusterStatsResponse(BaseModel):
    """Statistics about a user's clusters."""
    total_clusters: int
    total_clustered_entries: int
    total_unclustered_entries: int
    largest_cluster_size: int
    last_clustering_date: Optional[datetime]
