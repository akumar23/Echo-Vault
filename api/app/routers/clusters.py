"""
Clusters router for semantic clustering of journal entries.

Provides endpoints to:
- View discovered clusters/themes
- Get detailed cluster information with entries
- Trigger manual reclustering
- View cluster evolution over time
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.cluster import (
    SemanticCluster,
    ClusterSnapshot,
    EntryClusterMembership,
    ClusterLabel,
    ClusterTransition
)
from app.schemas.cluster import (
    ClusterResponse,
    ClusterDetailResponse,
    ClusterEvolutionResponse,
    ClusterTransitionResponse,
    TriggerClusteringResponse,
    ClusterStatsResponse,
    ClusterEntryPreview
)
from app.core.dependencies import get_current_user
from app.jobs.clustering_job import full_recluster_task

router = APIRouter(prefix="/clusters", tags=["clusters"])


@router.post("/trigger", response_model=TriggerClusteringResponse)
async def trigger_clustering(
    current_user: User = Depends(get_current_user),
):
    """
    Manually trigger clustering for current user.

    This will run HDBSCAN on all the user's journal entry embeddings
    to discover semantic themes. Results may take a few minutes depending
    on the number of entries.
    """
    full_recluster_task.delay(current_user.id)
    return TriggerClusteringResponse(
        status="queued",
        message="Clustering job started. Themes will be available shortly."
    )


@router.get("/", response_model=List[ClusterResponse])
async def get_user_clusters(
    include_stale: bool = Query(False, description="Include old/stale clusters"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all clusters (themes) for current user.

    Returns a list of discovered semantic themes with entry counts.
    By default, only returns active (non-stale) clusters from the
    most recent clustering run.
    """
    query = db.query(SemanticCluster).filter(
        SemanticCluster.user_id == current_user.id
    )

    if not include_stale:
        query = query.filter(SemanticCluster.is_stale == False)

    clusters = query.order_by(SemanticCluster.created_at.desc()).all()

    results = []
    for cluster in clusters:
        # Get label
        label_record = db.query(ClusterLabel).filter(
            ClusterLabel.cluster_id == cluster.id
        ).first()

        # Count entries
        entry_count = db.query(EntryClusterMembership).filter(
            EntryClusterMembership.cluster_id == cluster.id
        ).count()

        results.append(ClusterResponse(
            cluster_id=cluster.id,
            label=label_record.label if label_record else "Analyzing...",
            description=label_record.description if label_record else "",
            entry_count=entry_count,
            created_at=cluster.created_at,
            is_stale=cluster.is_stale
        ))

    return results


@router.get("/stats", response_model=ClusterStatsResponse)
async def get_cluster_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get clustering statistics for current user.

    Returns summary statistics about the user's semantic clusters
    including total counts and last clustering date.
    """
    # Count active clusters
    total_clusters = db.query(SemanticCluster).filter(
        SemanticCluster.user_id == current_user.id,
        SemanticCluster.is_stale == False
    ).count()

    # Count clustered entries
    total_clustered = db.query(EntryClusterMembership).join(
        SemanticCluster
    ).filter(
        SemanticCluster.user_id == current_user.id,
        SemanticCluster.is_stale == False
    ).distinct(EntryClusterMembership.entry_id).count()

    # Count total entries
    total_entries = db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted == False
    ).count()

    # Get largest cluster size
    largest_cluster_size = 0
    if total_clusters > 0:
        largest = db.query(
            func.count(EntryClusterMembership.id)
        ).join(SemanticCluster).filter(
            SemanticCluster.user_id == current_user.id,
            SemanticCluster.is_stale == False
        ).group_by(EntryClusterMembership.cluster_id).order_by(
            func.count(EntryClusterMembership.id).desc()
        ).first()
        if largest:
            largest_cluster_size = largest[0]

    # Get last clustering date
    last_snapshot = db.query(ClusterSnapshot).filter(
        ClusterSnapshot.user_id == current_user.id
    ).order_by(ClusterSnapshot.snapshot_date.desc()).first()

    return ClusterStatsResponse(
        total_clusters=total_clusters,
        total_clustered_entries=total_clustered,
        total_unclustered_entries=total_entries - total_clustered,
        largest_cluster_size=largest_cluster_size,
        last_clustering_date=last_snapshot.snapshot_date if last_snapshot else None
    )


@router.get("/evolution", response_model=List[ClusterEvolutionResponse])
async def get_cluster_evolution(
    limit: int = Query(10, ge=1, le=50, description="Number of snapshots to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get timeline of how clusters have evolved over time.

    Returns historical snapshots showing how the number and composition
    of clusters has changed with each clustering run.
    """
    snapshots = db.query(ClusterSnapshot).filter(
        ClusterSnapshot.user_id == current_user.id
    ).order_by(ClusterSnapshot.snapshot_date.desc()).limit(limit).all()

    return [
        ClusterEvolutionResponse(
            snapshot_id=s.id,
            snapshot_date=s.snapshot_date,
            total_entries=s.total_entries,
            total_clusters=s.total_clusters,
            noise_count=s.noise_count,
            metadata=s.snapshot_metadata
        )
        for s in snapshots
    ]


@router.get("/transitions", response_model=List[ClusterTransitionResponse])
async def get_cluster_transitions(
    limit: int = Query(20, ge=1, le=100, description="Number of transitions to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get history of cluster transitions (splits, merges, etc.).

    Shows how themes have evolved, including when clusters split into
    multiple themes, merge together, or dissolve.
    """
    transitions = db.query(ClusterTransition).filter(
        ClusterTransition.user_id == current_user.id
    ).order_by(ClusterTransition.transition_date.desc()).limit(limit).all()

    return [
        ClusterTransitionResponse(
            transition_id=t.id,
            old_cluster_id=t.old_cluster_id,
            new_cluster_id=t.new_cluster_id,
            transition_type=t.transition_type,
            transition_date=t.transition_date,
            affected_entry_count=t.affected_entry_count,
            metadata=t.transition_metadata
        )
        for t in transitions
    ]


@router.get("/{cluster_id}", response_model=ClusterDetailResponse)
async def get_cluster_detail(
    cluster_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed view of a specific cluster including its entries.

    Returns the cluster's theme label, description, and a list of
    all journal entries belonging to this cluster.
    """
    cluster = db.query(SemanticCluster).filter(
        SemanticCluster.id == cluster_id,
        SemanticCluster.user_id == current_user.id
    ).first()

    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    # Get label
    label_record = db.query(ClusterLabel).filter(
        ClusterLabel.cluster_id == cluster_id
    ).first()

    # Get entries in cluster, ordered by membership score
    memberships = db.query(EntryClusterMembership).filter(
        EntryClusterMembership.cluster_id == cluster_id
    ).order_by(EntryClusterMembership.membership_score.desc()).all()

    entry_ids = [m.entry_id for m in memberships]
    entries = db.query(Entry).filter(
        Entry.id.in_(entry_ids),
        Entry.is_deleted == False
    ).all()

    # Create a map for ordering
    entry_map = {e.id: e for e in entries}
    ordered_entries = [entry_map[eid] for eid in entry_ids if eid in entry_map]

    entry_previews = [
        ClusterEntryPreview(
            entry_id=e.id,
            title=e.title,
            content=e.content[:200] + ("..." if len(e.content) > 200 else ""),
            created_at=e.created_at,
            tags=e.tags or []
        )
        for e in ordered_entries
    ]

    return ClusterDetailResponse(
        cluster_id=cluster.id,
        label=label_record.label if label_record else "Analyzing...",
        description=label_record.description if label_record else "",
        entries=entry_previews,
        representative_entry_ids=label_record.representative_entry_ids if label_record else [],
        created_at=cluster.created_at,
        confidence=label_record.confidence if label_record else None
    )


@router.get("/{cluster_id}/related")
async def get_related_clusters(
    cluster_id: int,
    limit: int = Query(5, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get clusters that are semantically related to a given cluster.

    Uses centroid similarity to find themes that are conceptually
    close to the specified cluster.
    """
    cluster = db.query(SemanticCluster).filter(
        SemanticCluster.id == cluster_id,
        SemanticCluster.user_id == current_user.id
    ).first()

    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    if not cluster.centroid:
        return []

    # Get all other active clusters for user
    other_clusters = db.query(SemanticCluster).filter(
        SemanticCluster.user_id == current_user.id,
        SemanticCluster.is_stale == False,
        SemanticCluster.id != cluster_id,
        SemanticCluster.centroid != None
    ).all()

    if not other_clusters:
        return []

    # Compute similarities using numpy
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity

    target_centroid = np.array(cluster.centroid).reshape(1, -1)

    similarities = []
    for other in other_clusters:
        other_centroid = np.array(other.centroid).reshape(1, -1)
        sim = cosine_similarity(target_centroid, other_centroid)[0][0]
        similarities.append((other, sim))

    # Sort by similarity and take top N
    similarities.sort(key=lambda x: x[1], reverse=True)
    top_related = similarities[:limit]

    results = []
    for related_cluster, similarity in top_related:
        label_record = db.query(ClusterLabel).filter(
            ClusterLabel.cluster_id == related_cluster.id
        ).first()

        entry_count = db.query(EntryClusterMembership).filter(
            EntryClusterMembership.cluster_id == related_cluster.id
        ).count()

        results.append({
            "cluster_id": related_cluster.id,
            "label": label_record.label if label_record else "Analyzing...",
            "description": label_record.description if label_record else "",
            "similarity": float(similarity),
            "entry_count": entry_count
        })

    return results
