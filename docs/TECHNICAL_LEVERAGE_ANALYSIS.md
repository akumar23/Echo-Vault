# Technical Leverage Analysis: Three Unique Insight Features for EchoVault

This document provides deep technical analysis of three leverage points that can make EchoVault's insights feature uniquely powerful by exploiting existing infrastructure.

**Author:** Claude Code (Agent Expert)
**Date:** 2025-11-30
**Stack Context:** FastAPI, PostgreSQL 16 + pgvector, Ollama (llama3.1:8b), Celery + Redis

---

## Table of Contents

1. [Vector Embedding Clustering](#1-vector-embedding-clustering)
2. [Time Decay for Optimal Memory Recall](#2-time-decay-for-optimal-memory-recall)
3. [Local LLM Multi-Pass Analysis](#3-local-llm-multi-pass-analysis)

---

## 1. Vector Embedding Clustering

### Executive Summary

You already compute 1024-dimensional embeddings for every entry. These embeddings currently only power search, but they contain rich semantic information about themes, topics, and patterns across time. By clustering these embeddings, you can automatically discover recurring themes in a user's journaling patterns without explicit tagging.

**Key Insight:** While most journaling apps rely on manual tags or simple keyword extraction, clustering embeddings reveals *latent semantic themes* that users may not consciously recognize. This is a unique differentiator.

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLUSTERING PIPELINE                           │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Trigger    │─────▶│   Cluster    │─────▶│    Label     │
│  (nightly/   │      │  Embeddings  │      │  Generation  │
│   on-demand) │      │  (HDBSCAN)   │      │  (Ollama)    │
└──────────────┘      └──────────────┘      └──────────────┘
                              │                      │
                              │                      │
                              ▼                      ▼
                      ┌──────────────┐      ┌──────────────┐
                      │  clusters    │      │cluster_labels│
                      │    table     │      │    table     │
                      └──────────────┘      └──────────────┘
                              │
                              │
                              ▼
                      ┌──────────────┐
                      │entry_clusters│
                      │(many-to-many)│
                      └──────────────┘
```

### 1.1 Database Schema

**New Tables:**

```sql
-- Core cluster metadata
CREATE TABLE clusters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    cluster_algorithm VARCHAR(50) DEFAULT 'hdbscan',
    min_cluster_size INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_stale BOOLEAN DEFAULT FALSE,  -- Mark for reclustering
    INDEX idx_clusters_user (user_id)
);

-- Cluster snapshots (versioning for temporal analysis)
CREATE TABLE cluster_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    snapshot_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_entries INTEGER NOT NULL,
    total_clusters INTEGER NOT NULL,
    noise_count INTEGER,  -- Entries not assigned to any cluster
    metadata JSONB,  -- Algorithm params, quality metrics
    INDEX idx_snapshots_user_date (user_id, snapshot_date)
);

-- Entry-to-cluster assignments (many-to-many for soft clustering)
CREATE TABLE entry_clusters (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
    cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE,
    membership_score FLOAT DEFAULT 1.0,  -- For soft clustering algorithms
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    snapshot_id INTEGER REFERENCES cluster_snapshots(id),
    UNIQUE(entry_id, cluster_id, snapshot_id),
    INDEX idx_entry_clusters_entry (entry_id),
    INDEX idx_entry_clusters_cluster (cluster_id)
);

-- LLM-generated cluster labels
CREATE TABLE cluster_labels (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    representative_entries INTEGER[] DEFAULT '{}',  -- Top 3-5 entry IDs
    confidence FLOAT,  -- LLM confidence score
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_cluster_labels_cluster (cluster_id)
);

-- Cluster evolution tracking
CREATE TABLE cluster_transitions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    old_cluster_id INTEGER REFERENCES clusters(id),
    new_cluster_id INTEGER REFERENCES clusters(id),
    transition_type VARCHAR(50),  -- 'split', 'merge', 'drift', 'new', 'dissolved'
    transition_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    affected_entry_count INTEGER,
    metadata JSONB,  -- Detailed metrics
    INDEX idx_transitions_user_date (user_id, transition_date)
);
```

**Modified Tables:**

```sql
-- Add clustering metadata to embeddings table
ALTER TABLE entry_embeddings
ADD COLUMN last_clustered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN cluster_version INTEGER DEFAULT 0;
```

### 1.2 Algorithm Selection: HDBSCAN

**Why HDBSCAN over k-means/hierarchical?**

1. **No need to specify k**: Automatically determines optimal number of clusters
2. **Noise handling**: Labels outlier entries as "noise" (-1 cluster) rather than forcing assignment
3. **Varying density**: Finds clusters of different sizes/densities (some themes are major, others niche)
4. **Hierarchical structure**: Built-in dendrogram for multi-level theme analysis

**Performance Characteristics:**
- Time complexity: O(n log n) for n entries
- Space complexity: O(n²) in worst case, but optimized implementations use O(n)
- For 1000 entries: ~2-5 seconds on modest hardware
- For 10,000 entries: ~30-60 seconds

**Implementation Library:**
```python
# scikit-learn-extra provides optimized HDBSCAN
from sklearn.cluster import HDBSCAN
import numpy as np
```

### 1.3 Incremental Clustering Strategy

**Problem:** Re-clustering all entries nightly is wasteful (most embeddings unchanged).

**Solution:** Hybrid approach with staleness tracking

```python
# Clustering decision logic
def should_recluster(user_id: int, db: Session) -> bool:
    last_snapshot = db.query(ClusterSnapshot).filter(
        ClusterSnapshot.user_id == user_id
    ).order_by(ClusterSnapshot.snapshot_date.desc()).first()

    if not last_snapshot:
        return True  # First clustering

    # Count new/modified entries since last clustering
    new_entries_count = db.query(Entry).join(EntryEmbedding).filter(
        Entry.user_id == user_id,
        Entry.is_deleted == False,
        EntryEmbedding.last_clustered_at == None,  # Never clustered
        EntryEmbedding.is_active == True
    ).count()

    modified_entries_count = db.query(Entry).join(EntryEmbedding).filter(
        Entry.user_id == user_id,
        Entry.is_deleted == False,
        EntryEmbedding.cluster_version < last_snapshot.id,  # Outdated
        EntryEmbedding.is_active == True
    ).count()

    total_entries = last_snapshot.total_entries
    change_ratio = (new_entries_count + modified_entries_count) / max(total_entries, 1)

    # Recluster if >10% of entries are new/modified OR >30 days since last
    days_since = (datetime.now() - last_snapshot.snapshot_date).days
    return change_ratio > 0.10 or days_since > 30


# Incremental assignment for small changes
def incremental_cluster_assignment(entry_id: int, db: Session):
    """Assign a single new entry to existing clusters via similarity."""
    entry = db.query(Entry).filter(Entry.id == entry_id).first()
    embedding = db.query(EntryEmbedding).filter(
        EntryEmbedding.entry_id == entry_id
    ).first()

    if not embedding or not embedding.is_active:
        return

    # Get user's active clusters
    clusters = db.query(Cluster).filter(
        Cluster.user_id == entry.user_id,
        Cluster.is_stale == False
    ).all()

    if not clusters:
        return  # No clusters yet, wait for full clustering

    # For each cluster, find centroid by averaging member embeddings
    for cluster in clusters:
        member_embeddings = db.query(EntryEmbedding).join(
            EntryCluster, EntryEmbedding.entry_id == EntryCluster.entry_id
        ).filter(
            EntryCluster.cluster_id == cluster.id
        ).all()

        if not member_embeddings:
            continue

        # Compute centroid
        embeddings_array = np.array([e.embedding for e in member_embeddings])
        centroid = np.mean(embeddings_array, axis=0)

        # Compute similarity to new entry
        from sklearn.metrics.pairwise import cosine_similarity
        similarity = cosine_similarity(
            [embedding.embedding],
            [centroid]
        )[0][0]

        # Assign if similarity > threshold (e.g., 0.7)
        if similarity > 0.7:
            assignment = EntryCluster(
                entry_id=entry_id,
                cluster_id=cluster.id,
                membership_score=similarity
            )
            db.add(assignment)

    # Mark embedding as clustered
    embedding.last_clustered_at = datetime.now()
    db.commit()
```

### 1.4 Background Job Architecture

```python
# api/app/jobs/clustering_job.py

from sklearn.cluster import HDBSCAN
import numpy as np
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.models.cluster import Cluster, ClusterSnapshot, EntryCluster, ClusterLabel
from app.celery_app import celery_app
from app.services.ollama_service import ollama_service
import asyncio


@celery_app.task(name="clustering.full_recluster")
def full_recluster_task(user_id: int):
    """
    Complete reclustering of all user entries.
    Runs nightly or when change threshold exceeded.
    """
    db = SessionLocal()
    try:
        # 1. Fetch all active embeddings for user
        embeddings_data = db.query(
            EntryEmbedding.entry_id,
            EntryEmbedding.embedding
        ).join(Entry).filter(
            Entry.user_id == user_id,
            Entry.is_deleted == False,
            EntryEmbedding.is_active == True
        ).all()

        if len(embeddings_data) < 10:
            # Too few entries to cluster meaningfully
            return {"status": "skipped", "reason": "insufficient_entries"}

        # 2. Convert to numpy array
        entry_ids = [e.entry_id for e in embeddings_data]
        embeddings_matrix = np.array([e.embedding for e in embeddings_data])

        # 3. Run HDBSCAN
        clusterer = HDBSCAN(
            min_cluster_size=5,  # Minimum 5 entries per theme
            min_samples=3,  # More lenient for smaller datasets
            metric='cosine',  # Cosine distance for text embeddings
            cluster_selection_epsilon=0.1,  # Allow some flexibility
            prediction_data=True  # Enable soft clustering
        )

        cluster_labels = clusterer.fit_predict(embeddings_matrix)

        # 4. Create snapshot
        unique_clusters = set(cluster_labels) - {-1}  # Exclude noise
        snapshot = ClusterSnapshot(
            user_id=user_id,
            total_entries=len(entry_ids),
            total_clusters=len(unique_clusters),
            noise_count=np.sum(cluster_labels == -1),
            metadata={
                "algorithm": "hdbscan",
                "min_cluster_size": 5,
                "min_samples": 3,
                "silhouette_score": None  # TODO: Calculate if needed
            }
        )
        db.add(snapshot)
        db.flush()  # Get snapshot.id

        # 5. Mark old clusters as stale
        db.query(Cluster).filter(
            Cluster.user_id == user_id
        ).update({"is_stale": True})

        # 6. Create new cluster records and assignments
        cluster_id_map = {}  # HDBSCAN label -> DB cluster ID

        for hdbscan_label in unique_clusters:
            cluster = Cluster(
                user_id=user_id,
                cluster_algorithm='hdbscan',
                min_cluster_size=5
            )
            db.add(cluster)
            db.flush()
            cluster_id_map[hdbscan_label] = cluster.id

        # 7. Create entry-cluster assignments
        for entry_id, hdbscan_label in zip(entry_ids, cluster_labels):
            if hdbscan_label == -1:
                continue  # Skip noise

            assignment = EntryCluster(
                entry_id=entry_id,
                cluster_id=cluster_id_map[hdbscan_label],
                membership_score=1.0,  # Hard clustering for now
                snapshot_id=snapshot.id
            )
            db.add(assignment)

        # 8. Update embeddings clustering metadata
        db.query(EntryEmbedding).filter(
            EntryEmbedding.entry_id.in_(entry_ids)
        ).update({
            "last_clustered_at": datetime.now(),
            "cluster_version": snapshot.id
        }, synchronize_session=False)

        db.commit()

        # 9. Enqueue label generation for each cluster (async)
        for db_cluster_id in cluster_id_map.values():
            generate_cluster_label_task.delay(db_cluster_id)

        return {
            "status": "success",
            "snapshot_id": snapshot.id,
            "clusters_created": len(unique_clusters),
            "noise_entries": snapshot.noise_count
        }

    except Exception as e:
        db.rollback()
        logging.error(f"Clustering failed for user {user_id}: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="clustering.generate_label")
def generate_cluster_label_task(cluster_id: int):
    """
    Generate human-readable label for a cluster using LLM.
    Runs after clustering completes.
    """
    db = SessionLocal()
    try:
        # 1. Get cluster and find representative entries
        cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
        if not cluster:
            return {"status": "error", "reason": "cluster_not_found"}

        # 2. Get all entries in cluster, ordered by centrality
        assignments = db.query(EntryCluster).filter(
            EntryCluster.cluster_id == cluster_id
        ).order_by(EntryCluster.membership_score.desc()).limit(10).all()

        entry_ids = [a.entry_id for a in assignments]
        entries = db.query(Entry).filter(Entry.id.in_(entry_ids)).all()

        if not entries:
            return {"status": "error", "reason": "no_entries"}

        # 3. Build context for LLM (top 5 most representative entries)
        context_entries = entries[:5]
        context_text = "\n\n".join([
            f"Entry {i+1} ({e.created_at.date()}):\n{e.content[:500]}"
            for i, e in enumerate(context_entries)
        ])

        # 4. Generate label via Ollama
        prompt = f"""You are analyzing a cluster of journal entries that share a common theme.
Based on these representative entries, generate a short, descriptive label (3-5 words) and a brief description.

Representative entries:
{context_text}

Respond in JSON format:
{{
    "label": "Brief theme label (3-5 words)",
    "description": "One sentence describing this theme",
    "confidence": "high" or "medium" or "low"
}}"""

        # Call Ollama
        response = asyncio.run(ollama_service.generate_json(prompt))

        # 5. Parse and save label
        import json
        try:
            parsed = json.loads(response)
            label = ClusterLabel(
                cluster_id=cluster_id,
                label=parsed.get("label", "Unlabeled Theme"),
                description=parsed.get("description", ""),
                representative_entries=[e.id for e in context_entries],
                confidence=0.8 if parsed.get("confidence") == "high" else 0.5
            )
            db.add(label)
            db.commit()

            return {
                "status": "success",
                "label": label.label,
                "description": label.description
            }
        except json.JSONDecodeError:
            # Fallback: use first few words of LLM response
            fallback_label = response[:50].strip()
            label = ClusterLabel(
                cluster_id=cluster_id,
                label=fallback_label,
                description="",
                representative_entries=[e.id for e in context_entries],
                confidence=0.3
            )
            db.add(label)
            db.commit()
            return {"status": "success", "label": fallback_label}

    except Exception as e:
        db.rollback()
        logging.error(f"Label generation failed for cluster {cluster_id}: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="clustering.nightly_clustering")
def nightly_clustering_task():
    """Nightly job to recluster users who need it."""
    db = SessionLocal()
    try:
        # Get all active users
        from app.models.user import User
        users = db.query(User).filter(User.is_active == True).all()

        for user in users:
            if should_recluster(user.id, db):
                full_recluster_task.delay(user.id)

    finally:
        db.close()
```

### 1.5 API Endpoints

```python
# api/app/routers/clusters.py

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.cluster import Cluster, ClusterLabel, EntryCluster
from app.schemas.cluster import ClusterResponse, ClusterDetailResponse, ClusterEvolutionResponse
from app.core.dependencies import get_current_user
from app.jobs.clustering_job import full_recluster_task

router = APIRouter(prefix="/clusters", tags=["clusters"])


@router.post("/trigger")
async def trigger_clustering(
    current_user: User = Depends(get_current_user),
):
    """Manually trigger clustering for current user."""
    full_recluster_task.delay(current_user.id)
    return {"status": "queued", "message": "Clustering job started"}


@router.get("/", response_model=List[ClusterResponse])
async def get_user_clusters(
    include_stale: bool = Query(False, description="Include old/stale clusters"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all clusters for current user."""
    query = db.query(Cluster).filter(Cluster.user_id == current_user.id)

    if not include_stale:
        query = query.filter(Cluster.is_stale == False)

    clusters = query.order_by(Cluster.created_at.desc()).all()

    # Enrich with labels and entry counts
    results = []
    for cluster in clusters:
        label = db.query(ClusterLabel).filter(
            ClusterLabel.cluster_id == cluster.id
        ).first()

        entry_count = db.query(EntryCluster).filter(
            EntryCluster.cluster_id == cluster.id
        ).count()

        results.append({
            "cluster_id": cluster.id,
            "label": label.label if label else "Unlabeled",
            "description": label.description if label else "",
            "entry_count": entry_count,
            "created_at": cluster.created_at,
            "is_stale": cluster.is_stale
        })

    return results


@router.get("/{cluster_id}", response_model=ClusterDetailResponse)
async def get_cluster_detail(
    cluster_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed view of a specific cluster."""
    cluster = db.query(Cluster).filter(
        Cluster.id == cluster_id,
        Cluster.user_id == current_user.id
    ).first()

    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    # Get label
    label = db.query(ClusterLabel).filter(
        ClusterLabel.cluster_id == cluster_id
    ).first()

    # Get entries in cluster
    from app.models.entry import Entry
    entries = db.query(Entry).join(EntryCluster).filter(
        EntryCluster.cluster_id == cluster_id,
        Entry.is_deleted == False
    ).order_by(Entry.created_at.desc()).all()

    return {
        "cluster_id": cluster.id,
        "label": label.label if label else "Unlabeled",
        "description": label.description if label else "",
        "entries": [
            {
                "entry_id": e.id,
                "title": e.title,
                "content": e.content[:200],  # Truncate
                "created_at": e.created_at,
                "tags": e.tags
            }
            for e in entries
        ],
        "representative_entry_ids": label.representative_entries if label else [],
        "created_at": cluster.created_at
    }


@router.get("/evolution/timeline", response_model=List[ClusterEvolutionResponse])
async def get_cluster_evolution(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get timeline of how clusters have evolved over time."""
    from app.models.cluster import ClusterSnapshot

    snapshots = db.query(ClusterSnapshot).filter(
        ClusterSnapshot.user_id == current_user.id
    ).order_by(ClusterSnapshot.snapshot_date).all()

    return [
        {
            "snapshot_id": s.id,
            "snapshot_date": s.snapshot_date,
            "total_entries": s.total_entries,
            "total_clusters": s.total_clusters,
            "noise_count": s.noise_count,
            "metadata": s.metadata
        }
        for s in snapshots
    ]
```

### 1.6 Frontend Integration

**Component: Cluster Explorer**

```typescript
// app/components/ClusterExplorer.tsx

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';

interface Cluster {
  cluster_id: number;
  label: string;
  description: string;
  entry_count: number;
  created_at: string;
}

export function ClusterExplorer() {
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);

  const { data: clusters, isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => api.get<Cluster[]>('/clusters')
  });

  const { data: clusterDetail } = useQuery({
    queryKey: ['cluster', selectedCluster],
    queryFn: () => api.get(`/clusters/${selectedCluster}`),
    enabled: !!selectedCluster
  });

  if (isLoading) return <div>Loading themes...</div>;

  return (
    <div className="cluster-explorer">
      <h2>Recurring Themes</h2>
      <div className="cluster-grid">
        {clusters?.data.map(cluster => (
          <div
            key={cluster.cluster_id}
            className="cluster-card"
            onClick={() => setSelectedCluster(cluster.cluster_id)}
          >
            <h3>{cluster.label}</h3>
            <p>{cluster.description}</p>
            <span className="entry-count">{cluster.entry_count} entries</span>
          </div>
        ))}
      </div>

      {selectedCluster && clusterDetail && (
        <div className="cluster-detail-modal">
          <h2>{clusterDetail.data.label}</h2>
          <p>{clusterDetail.data.description}</p>
          <div className="entries-list">
            {clusterDetail.data.entries.map(entry => (
              <div key={entry.entry_id} className="entry-preview">
                <h4>{entry.title}</h4>
                <p>{entry.content}</p>
                <span className="date">{entry.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Visualization: Cluster Evolution Timeline**

```typescript
// app/components/ClusterTimeline.tsx

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export function ClusterTimeline() {
  const { data: evolution } = useQuery({
    queryKey: ['cluster-evolution'],
    queryFn: () => api.get('/clusters/evolution/timeline')
  });

  if (!evolution?.data) return null;

  const chartData = evolution.data.map(snapshot => ({
    date: new Date(snapshot.snapshot_date).toLocaleDateString(),
    clusters: snapshot.total_clusters,
    entries: snapshot.total_entries,
    noise: snapshot.noise_count
  }));

  return (
    <div className="cluster-timeline">
      <h3>Theme Evolution Over Time</h3>
      <LineChart width={800} height={400} data={chartData}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="clusters" stroke="#8884d8" name="Themes" />
        <Line type="monotone" dataKey="entries" stroke="#82ca9d" name="Entries" />
        <Line type="monotone" dataKey="noise" stroke="#ffc658" name="Uncategorized" />
      </LineChart>
    </div>
  );
}
```

### 1.7 Performance Considerations

**Optimization Strategies:**

1. **Batch Processing:**
   - Cluster max 10,000 entries per job
   - For users with >10k entries, use hierarchical sampling or sliding window

2. **Embedding Caching:**
   - Embeddings already stored in DB, no re-computation needed
   - Use `SELECT ... WHERE is_active = TRUE` to exclude soft-deleted entries

3. **Parallel Label Generation:**
   - Each cluster's label generated independently via Celery
   - Can run 5-10 label generation tasks in parallel (limited by Ollama throughput)

4. **Index Optimization:**
   ```sql
   CREATE INDEX idx_entry_clusters_cluster_membership
   ON entry_clusters(cluster_id, membership_score DESC);

   CREATE INDEX idx_embeddings_active_user
   ON entry_embeddings(is_active, entry_id)
   WHERE is_active = TRUE;
   ```

5. **Memory Management:**
   - For 1024-dim embeddings, 10k entries = ~40MB (10000 * 1024 * 4 bytes)
   - Use numpy's memory-mapped arrays for >50k entries

**Resource Usage Estimates:**

| Entries | Clustering Time | Label Gen Time | Total Time | Memory |
|---------|----------------|----------------|------------|--------|
| 100     | <1s            | 15s (3 labels) | ~20s       | <1MB   |
| 1,000   | 3s             | 60s (10 labels)| ~70s       | 4MB    |
| 10,000  | 45s            | 300s (50 labels)| ~6min     | 40MB   |

### 1.8 Code Examples

**Ollama Service Extension:**

```python
# api/app/services/ollama_service.py

async def generate_json(self, prompt: str, max_retries: int = 3) -> str:
    """
    Generate structured JSON response from Ollama.
    Retries if JSON parsing fails.
    """
    client = self._get_client()

    for attempt in range(max_retries):
        response = await client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.reflection_model,
                "prompt": prompt,
                "stream": False,
                "format": "json",  # Ollama JSON mode (requires compatible model)
                "options": {
                    "temperature": 0.3  # Lower temp for more structured output
                }
            },
            timeout=120.0
        )
        response.raise_for_status()
        data = response.json()
        response_text = data.get("response", "")

        # Validate JSON
        try:
            json.loads(response_text)
            return response_text
        except json.JSONDecodeError:
            if attempt < max_retries - 1:
                continue
            else:
                # Fallback: extract JSON object from response
                import re
                match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if match:
                    return match.group()
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts")
```

---

## 2. Time Decay for Optimal Memory Recall

### Executive Summary

Your existing time-decay formula is designed for *search relevance* (recent = more relevant). By inverting this logic, you can build a "spaced repetition" system that surfaces old memories at psychologically optimal moments for consolidation and reflection. This transforms passive journaling into active memory work.

**Key Insight:** Most journaling apps use naive "On This Day" features (exactly 1 year ago). Your decay formula enables *continuous, personalized spacing* based on Ebbinghaus's forgetting curve and user interaction patterns.

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              OPTIMAL RECALL SYSTEM ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Forgetting │─────▶│   Calculate  │─────▶│   Surface    │
│     Curve    │      │  Next Recall │      │   to User    │
│   Tracker    │      │    Moment    │      │  (notification)│
└──────────────┘      └──────────────┘      └──────────────┘
       │                      │                      │
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│entry_recall  │      │recall_schedule│     │user_interaction│
│  _history    │      │    (queue)    │      │   _log       │
└──────────────┘      └──────────────┘      └──────────────┘
```

### 2.1 Database Schema

```sql
-- Track each time an entry was recalled/reviewed
CREATE TABLE entry_recall_history (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    recalled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recall_trigger VARCHAR(50),  -- 'spaced_repetition', 'search', 'manual', 'cluster_view'
    interaction_type VARCHAR(50),  -- 'viewed', 'reflected', 'edited', 'shared', 'dismissed'
    interaction_duration_seconds INTEGER,  -- How long user engaged
    recall_quality INTEGER,  -- 1-5 rating (optional user feedback)
    INDEX idx_recall_history_entry (entry_id),
    INDEX idx_recall_history_user_date (user_id, recalled_at)
);

-- Scheduled recalls (queue for surfacing)
CREATE TABLE recall_schedule (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    recall_interval_days FLOAT NOT NULL,  -- Current spacing interval
    repetition_number INTEGER DEFAULT 0,  -- How many times recalled (0 = first time)
    easiness_factor FLOAT DEFAULT 2.5,  -- SM-2 algorithm parameter
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_recall_schedule_user_date (user_id, scheduled_for),
    INDEX idx_recall_schedule_pending (is_completed, scheduled_for)
);

-- User-specific recall settings
CREATE TABLE recall_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    daily_recall_limit INTEGER DEFAULT 3,  -- Max recalls per day
    min_entry_age_days INTEGER DEFAULT 7,  -- Don't recall entries younger than this
    preferred_recall_time TIME DEFAULT '09:00:00',  -- When to send notifications
    notification_enabled BOOLEAN DEFAULT TRUE,
    initial_interval_days FLOAT DEFAULT 1.0,  -- First recall after N days
    max_interval_days FLOAT DEFAULT 180.0,  -- Cap at 6 months
    easiness_threshold FLOAT DEFAULT 1.3,  -- Below this, entry is "difficult" to recall
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- User interaction patterns (for personalization)
CREATE TABLE user_interaction_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- 'recall_view', 'recall_dismiss', 'recall_rate', 'entry_edit'
    metadata JSONB,  -- Flexible storage for action-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_interaction_log_user (user_id, created_at)
);
```

### 2.2 Forgetting Curve Algorithm: SM-2 Adaptation

**Background:** The SuperMemo 2 (SM-2) algorithm is proven for spaced repetition in learning systems. We adapt it for journaling:

**Original SM-2:**
```
If quality >= 3 (recalled successfully):
    if repetition == 0:
        interval = 1 day
    elif repetition == 1:
        interval = 6 days
    else:
        interval = previous_interval * easiness_factor

easiness_factor = previous_EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
```

**EchoVault Adaptation:**

Instead of explicit quality ratings (users won't rate every recall), we infer quality from interaction:

```python
# Infer recall quality from user interaction
def infer_recall_quality(interaction_type: str, duration_seconds: int) -> int:
    """
    Map user interaction to quality score (1-5).

    5 = Perfect recall (long engagement, reflection)
    4 = Good recall (medium engagement)
    3 = Successful recall (brief view)
    2 = Difficult recall (dismissed quickly)
    1 = Failed recall (immediate dismiss)
    """
    if interaction_type == 'reflected':
        return 5  # User wrote a reflection = perfect recall
    elif interaction_type == 'edited':
        return 5  # User edited = deep engagement
    elif interaction_type == 'viewed':
        if duration_seconds > 60:
            return 4  # Read for >1 min
        elif duration_seconds > 20:
            return 3  # Brief read
        else:
            return 2  # Quick glance
    elif interaction_type == 'dismissed':
        return 1  # Not interested
    else:
        return 3  # Default: neutral


def calculate_next_interval(
    previous_interval: float,
    repetition_number: int,
    easiness_factor: float,
    quality: int
) -> tuple[float, float]:
    """
    SM-2 algorithm adapted for journaling.

    Returns: (next_interval_days, new_easiness_factor)
    """
    # Update easiness factor based on quality
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)  # Floor at 1.3

    # Calculate next interval
    if quality < 3:
        # Failed recall: reset to beginning
        next_interval = 1.0
        repetition_number = 0
    else:
        if repetition_number == 0:
            next_interval = 1.0
        elif repetition_number == 1:
            next_interval = 6.0
        else:
            next_interval = previous_interval * new_ef

    # Cap interval at max (e.g., 180 days)
    next_interval = min(next_interval, 180.0)

    return next_interval, new_ef
```

### 2.3 Background Job Architecture

```python
# api/app/jobs/recall_job.py

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.entry import Entry
from app.models.recall import RecallSchedule, RecallHistory, RecallSettings, UserInteractionLog
from app.celery_app import celery_app
import logging


@celery_app.task(name="recall.initialize_schedules")
def initialize_recall_schedules_task(user_id: int):
    """
    Initialize recall schedules for all existing entries.
    Runs once when user enables the feature.
    """
    db = SessionLocal()
    try:
        settings = db.query(RecallSettings).filter(
            RecallSettings.user_id == user_id
        ).first()

        if not settings or not settings.enabled:
            return {"status": "skipped", "reason": "recall_disabled"}

        # Get all entries older than min_entry_age_days
        min_age = datetime.now() - timedelta(days=settings.min_entry_age_days)
        entries = db.query(Entry).filter(
            Entry.user_id == user_id,
            Entry.is_deleted == False,
            Entry.created_at <= min_age
        ).all()

        # Create initial schedules
        for entry in entries:
            # Check if schedule already exists
            existing = db.query(RecallSchedule).filter(
                RecallSchedule.entry_id == entry.id,
                RecallSchedule.is_completed == False
            ).first()

            if existing:
                continue  # Skip if already scheduled

            # Calculate initial recall time based on entry age
            age_days = (datetime.now() - entry.created_at).days

            # Use logarithmic spacing for old entries
            # Newer entries recalled sooner, older ones later
            if age_days < 30:
                initial_interval = settings.initial_interval_days
            elif age_days < 90:
                initial_interval = 7.0
            elif age_days < 365:
                initial_interval = 30.0
            else:
                initial_interval = 90.0

            scheduled_for = datetime.now() + timedelta(days=initial_interval)

            schedule = RecallSchedule(
                entry_id=entry.id,
                user_id=user_id,
                scheduled_for=scheduled_for,
                recall_interval_days=initial_interval,
                repetition_number=0,
                easiness_factor=2.5  # SM-2 default
            )
            db.add(schedule)

        db.commit()
        return {
            "status": "success",
            "entries_scheduled": len(entries)
        }

    except Exception as e:
        db.rollback()
        logging.error(f"Recall schedule initialization failed for user {user_id}: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="recall.process_due_recalls")
def process_due_recalls_task():
    """
    Daily job to find entries due for recall and notify users.
    Runs every morning at configured time.
    """
    db = SessionLocal()
    try:
        now = datetime.now()

        # Get all pending recalls due today
        due_recalls = db.query(RecallSchedule).filter(
            RecallSchedule.is_completed == False,
            RecallSchedule.scheduled_for <= now
        ).order_by(RecallSchedule.scheduled_for).all()

        # Group by user
        from collections import defaultdict
        user_recalls = defaultdict(list)
        for recall in due_recalls:
            user_recalls[recall.user_id].append(recall)

        # Process each user
        for user_id, recalls in user_recalls.items():
            settings = db.query(RecallSettings).filter(
                RecallSettings.user_id == user_id
            ).first()

            if not settings or not settings.enabled:
                continue

            # Limit to daily_recall_limit
            recalls_to_send = recalls[:settings.daily_recall_limit]

            # Send notification (via email, push, or in-app)
            send_recall_notification_task.delay(
                user_id,
                [r.id for r in recalls_to_send]
            )

        return {
            "status": "success",
            "users_notified": len(user_recalls),
            "total_recalls": len(due_recalls)
        }

    except Exception as e:
        logging.error(f"Process due recalls failed: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="recall.send_notification")
def send_recall_notification_task(user_id: int, recall_schedule_ids: list[int]):
    """
    Send notification to user about entries due for recall.
    """
    db = SessionLocal()
    try:
        from app.models.user import User
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "error", "reason": "user_not_found"}

        recalls = db.query(RecallSchedule).filter(
            RecallSchedule.id.in_(recall_schedule_ids)
        ).all()

        entries = db.query(Entry).filter(
            Entry.id.in_([r.entry_id for r in recalls])
        ).all()

        # TODO: Implement actual notification system
        # For now, just log
        logging.info(f"[RECALL NOTIFICATION] User {user.email}: {len(entries)} entries due")
        for entry in entries:
            logging.info(f"  - {entry.title or 'Untitled'} from {entry.created_at.date()}")

        # In production:
        # - Send email with entry previews
        # - Send push notification
        # - Create in-app notification record

        return {
            "status": "success",
            "entries_count": len(entries)
        }

    except Exception as e:
        logging.error(f"Send recall notification failed for user {user_id}: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="recall.record_interaction")
def record_recall_interaction_task(
    recall_schedule_id: int,
    interaction_type: str,
    duration_seconds: int = 0,
    explicit_quality: int = None
):
    """
    Record user interaction with a recalled entry and calculate next recall.
    """
    db = SessionLocal()
    try:
        schedule = db.query(RecallSchedule).filter(
            RecallSchedule.id == recall_schedule_id
        ).first()

        if not schedule:
            return {"status": "error", "reason": "schedule_not_found"}

        # Infer quality if not explicitly provided
        if explicit_quality is None:
            quality = infer_recall_quality(interaction_type, duration_seconds)
        else:
            quality = explicit_quality

        # Record history
        history = RecallHistory(
            entry_id=schedule.entry_id,
            user_id=schedule.user_id,
            recall_trigger='spaced_repetition',
            interaction_type=interaction_type,
            interaction_duration_seconds=duration_seconds,
            recall_quality=quality
        )
        db.add(history)

        # Calculate next interval
        next_interval, new_ef = calculate_next_interval(
            previous_interval=schedule.recall_interval_days,
            repetition_number=schedule.repetition_number,
            easiness_factor=schedule.easiness_factor,
            quality=quality
        )

        # Mark current schedule as completed
        schedule.is_completed = True
        schedule.completed_at = datetime.now()

        # Create next recall schedule
        settings = db.query(RecallSettings).filter(
            RecallSettings.user_id == schedule.user_id
        ).first()

        max_interval = settings.max_interval_days if settings else 180.0
        next_interval = min(next_interval, max_interval)

        next_schedule = RecallSchedule(
            entry_id=schedule.entry_id,
            user_id=schedule.user_id,
            scheduled_for=datetime.now() + timedelta(days=next_interval),
            recall_interval_days=next_interval,
            repetition_number=schedule.repetition_number + 1,
            easiness_factor=new_ef
        )
        db.add(next_schedule)

        # Log interaction
        interaction_log = UserInteractionLog(
            user_id=schedule.user_id,
            action='recall_view',
            metadata={
                "entry_id": schedule.entry_id,
                "quality": quality,
                "next_interval": next_interval,
                "interaction_type": interaction_type
            }
        )
        db.add(interaction_log)

        db.commit()

        return {
            "status": "success",
            "quality": quality,
            "next_recall_in_days": next_interval,
            "next_recall_date": next_schedule.scheduled_for.isoformat()
        }

    except Exception as e:
        db.rollback()
        logging.error(f"Record recall interaction failed: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


def infer_recall_quality(interaction_type: str, duration_seconds: int) -> int:
    """Infer recall quality from user interaction (defined above)."""
    if interaction_type == 'reflected':
        return 5
    elif interaction_type == 'edited':
        return 5
    elif interaction_type == 'viewed':
        if duration_seconds > 60:
            return 4
        elif duration_seconds > 20:
            return 3
        else:
            return 2
    elif interaction_type == 'dismissed':
        return 1
    else:
        return 3


def calculate_next_interval(
    previous_interval: float,
    repetition_number: int,
    easiness_factor: float,
    quality: int
) -> tuple[float, float]:
    """SM-2 algorithm (defined above)."""
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if quality < 3:
        next_interval = 1.0
        repetition_number = 0
    else:
        if repetition_number == 0:
            next_interval = 1.0
        elif repetition_number == 1:
            next_interval = 6.0
        else:
            next_interval = previous_interval * new_ef

    next_interval = min(next_interval, 180.0)
    return next_interval, new_ef
```

### 2.4 API Endpoints

```python
# api/app/routers/recall.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.recall import RecallSchedule, RecallHistory, RecallSettings
from app.models.entry import Entry
from app.schemas.recall import (
    RecallSettingsUpdate, RecallSettingsResponse,
    RecallItemResponse, RecallHistoryResponse
)
from app.core.dependencies import get_current_user
from app.jobs.recall_job import (
    initialize_recall_schedules_task,
    record_recall_interaction_task
)

router = APIRouter(prefix="/recall", tags=["recall"])


@router.get("/settings", response_model=RecallSettingsResponse)
async def get_recall_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's recall settings."""
    settings = db.query(RecallSettings).filter(
        RecallSettings.user_id == current_user.id
    ).first()

    if not settings:
        # Create default settings
        settings = RecallSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put("/settings", response_model=RecallSettingsResponse)
async def update_recall_settings(
    settings_update: RecallSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's recall settings."""
    settings = db.query(RecallSettings).filter(
        RecallSettings.user_id == current_user.id
    ).first()

    if not settings:
        settings = RecallSettings(user_id=current_user.id)
        db.add(settings)

    # Update fields
    for field, value in settings_update.dict(exclude_unset=True).items():
        setattr(settings, field, value)

    settings.updated_at = datetime.now()
    db.commit()
    db.refresh(settings)

    # If just enabled, initialize schedules
    if settings_update.enabled and settings.enabled:
        initialize_recall_schedules_task.delay(current_user.id)

    return settings


@router.get("/due", response_model=List[RecallItemResponse])
async def get_due_recalls(
    limit: int = Query(10, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get entries due for recall today."""
    settings = db.query(RecallSettings).filter(
        RecallSettings.user_id == current_user.id
    ).first()

    if not settings or not settings.enabled:
        return []

    # Get pending recalls due now
    recalls = db.query(RecallSchedule).filter(
        RecallSchedule.user_id == current_user.id,
        RecallSchedule.is_completed == False,
        RecallSchedule.scheduled_for <= datetime.now()
    ).order_by(RecallSchedule.scheduled_for).limit(limit).all()

    # Join with entries
    results = []
    for recall in recalls:
        entry = db.query(Entry).filter(Entry.id == recall.entry_id).first()
        if entry and not entry.is_deleted:
            results.append({
                "recall_schedule_id": recall.id,
                "entry_id": entry.id,
                "title": entry.title,
                "content": entry.content[:300],  # Preview
                "created_at": entry.created_at,
                "scheduled_for": recall.scheduled_for,
                "repetition_number": recall.repetition_number,
                "recall_interval_days": recall.recall_interval_days
            })

    return results


@router.post("/interact/{recall_schedule_id}")
async def record_interaction(
    recall_schedule_id: int,
    interaction_type: str,
    duration_seconds: int = 0,
    explicit_quality: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record user interaction with a recalled entry.

    interaction_type: 'viewed', 'reflected', 'edited', 'dismissed'
    duration_seconds: How long user engaged with the entry
    explicit_quality: Optional 1-5 rating (overrides automatic inference)
    """
    # Verify schedule belongs to user
    schedule = db.query(RecallSchedule).filter(
        RecallSchedule.id == recall_schedule_id,
        RecallSchedule.user_id == current_user.id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Recall schedule not found")

    # Enqueue interaction recording
    record_recall_interaction_task.delay(
        recall_schedule_id=recall_schedule_id,
        interaction_type=interaction_type,
        duration_seconds=duration_seconds,
        explicit_quality=explicit_quality
    )

    return {
        "status": "recorded",
        "message": "Interaction recorded, next recall calculated"
    }


@router.get("/history", response_model=List[RecallHistoryResponse])
async def get_recall_history(
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's recall history."""
    history = db.query(RecallHistory).filter(
        RecallHistory.user_id == current_user.id
    ).order_by(RecallHistory.recalled_at.desc()).limit(limit).all()

    # Enrich with entry data
    results = []
    for h in history:
        entry = db.query(Entry).filter(Entry.id == h.entry_id).first()
        if entry:
            results.append({
                "id": h.id,
                "entry_id": h.entry_id,
                "entry_title": entry.title,
                "recalled_at": h.recalled_at,
                "interaction_type": h.interaction_type,
                "recall_quality": h.recall_quality,
                "interaction_duration_seconds": h.interaction_duration_seconds
            })

    return results


@router.get("/stats")
async def get_recall_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's recall statistics."""
    from sqlalchemy import func, case

    # Total recalls
    total_recalls = db.query(func.count(RecallHistory.id)).filter(
        RecallHistory.user_id == current_user.id
    ).scalar()

    # Average quality
    avg_quality = db.query(func.avg(RecallHistory.recall_quality)).filter(
        RecallHistory.user_id == current_user.id,
        RecallHistory.recall_quality.isnot(None)
    ).scalar()

    # Recall rate by quality
    quality_distribution = db.query(
        RecallHistory.recall_quality,
        func.count(RecallHistory.id)
    ).filter(
        RecallHistory.user_id == current_user.id
    ).group_by(RecallHistory.recall_quality).all()

    # Pending recalls
    pending_count = db.query(func.count(RecallSchedule.id)).filter(
        RecallSchedule.user_id == current_user.id,
        RecallSchedule.is_completed == False
    ).scalar()

    return {
        "total_recalls": total_recalls or 0,
        "average_quality": float(avg_quality) if avg_quality else 0.0,
        "quality_distribution": {
            str(q): count for q, count in quality_distribution
        },
        "pending_recalls": pending_count or 0
    }
```

### 2.5 Frontend Integration

**Component: Daily Recall Widget**

```typescript
// app/components/DailyRecalls.tsx

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';

interface RecallItem {
  recall_schedule_id: number;
  entry_id: number;
  title: string;
  content: string;
  created_at: string;
  repetition_number: number;
}

export function DailyRecalls() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const queryClient = useQueryClient();

  const { data: recalls, isLoading } = useQuery({
    queryKey: ['recalls', 'due'],
    queryFn: () => api.get<RecallItem[]>('/recall/due')
  });

  const recordInteraction = useMutation({
    mutationFn: (params: {
      recall_schedule_id: number;
      interaction_type: string;
      duration_seconds: number;
    }) => api.post(`/recall/interact/${params.recall_schedule_id}`, params),
    onSuccess: () => {
      queryClient.invalidateQueries(['recalls', 'due']);
    }
  });

  if (isLoading) return <div>Loading memories...</div>;
  if (!recalls?.data.length) return <div>No memories to revisit today!</div>;

  const current = recalls.data[currentIndex];

  const handleInteraction = (type: string) => {
    const duration = Math.floor((Date.now() - startTime) / 1000);

    recordInteraction.mutate({
      recall_schedule_id: current.recall_schedule_id,
      interaction_type: type,
      duration_seconds: duration
    });

    // Move to next recall
    if (currentIndex < recalls.data.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setStartTime(Date.now());
    }
  };

  const entryAge = Math.floor(
    (Date.now() - new Date(current.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="daily-recalls">
      <div className="recall-header">
        <h2>Memory {currentIndex + 1} of {recalls.data.length}</h2>
        <span className="entry-age">From {entryAge} days ago</span>
        <span className="repetition">Recall #{current.repetition_number + 1}</span>
      </div>

      <div className="recall-content">
        <h3>{current.title}</h3>
        <p>{current.content}</p>
      </div>

      <div className="recall-actions">
        <button onClick={() => handleInteraction('viewed')}>
          Continue
        </button>
        <button onClick={() => handleInteraction('reflected')}>
          Reflect on This
        </button>
        <button onClick={() => handleInteraction('dismissed')}>
          Skip
        </button>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${((currentIndex + 1) / recalls.data.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
```

**Settings Panel:**

```typescript
// app/components/RecallSettings.tsx

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function RecallSettings() {
  const { data: settings } = useQuery({
    queryKey: ['recall', 'settings'],
    queryFn: () => api.get('/recall/settings')
  });

  const updateSettings = useMutation({
    mutationFn: (data: any) => api.put('/recall/settings', data)
  });

  return (
    <div className="recall-settings">
      <h3>Memory Recall Settings</h3>

      <label>
        <input
          type="checkbox"
          checked={settings?.data.enabled}
          onChange={(e) => updateSettings.mutate({ enabled: e.target.checked })}
        />
        Enable spaced repetition memory surfacing
      </label>

      <label>
        Daily recall limit:
        <input
          type="number"
          value={settings?.data.daily_recall_limit}
          onChange={(e) => updateSettings.mutate({
            daily_recall_limit: parseInt(e.target.value)
          })}
          min={1}
          max={10}
        />
      </label>

      <label>
        Don't recall entries younger than:
        <select
          value={settings?.data.min_entry_age_days}
          onChange={(e) => updateSettings.mutate({
            min_entry_age_days: parseInt(e.target.value)
          })}
        >
          <option value={1}>1 day</option>
          <option value={7}>1 week</option>
          <option value={30}>1 month</option>
        </select>
      </label>

      <label>
        Preferred recall time:
        <input
          type="time"
          value={settings?.data.preferred_recall_time}
          onChange={(e) => updateSettings.mutate({
            preferred_recall_time: e.target.value
          })}
        />
      </label>
    </div>
  );
}
```

### 2.6 Performance Considerations

**Optimization Strategies:**

1. **Index-Heavy Design:**
   ```sql
   -- Critical for daily job
   CREATE INDEX idx_recall_schedule_due
   ON recall_schedule(is_completed, scheduled_for)
   WHERE is_completed = FALSE;

   -- For user queries
   CREATE INDEX idx_recall_schedule_user_pending
   ON recall_schedule(user_id, scheduled_for)
   WHERE is_completed = FALSE;
   ```

2. **Batch Notification Processing:**
   - Process all users in single daily job
   - Group notifications by user to reduce queries
   - Use Redis to cache "already notified today" flags

3. **Interaction Recording:**
   - Async Celery task prevents blocking API response
   - User sees immediate feedback, calculation happens in background

4. **Query Optimization:**
   ```python
   # BAD: N+1 queries
   for recall in recalls:
       entry = db.query(Entry).filter(Entry.id == recall.entry_id).first()

   # GOOD: Single join
   recalls_with_entries = db.query(RecallSchedule, Entry).join(
       Entry, RecallSchedule.entry_id == Entry.id
   ).filter(...).all()
   ```

**Resource Usage:**

| Users | Daily Job Time | DB Size (1 year) | Memory |
|-------|---------------|------------------|--------|
| 100   | <5s           | ~50MB            | 10MB   |
| 1,000 | ~30s          | ~500MB           | 50MB   |
| 10,000| ~5min         | ~5GB             | 200MB  |

### 2.7 Code Examples

**Celery Beat Schedule (Periodic Tasks):**

```python
# api/app/celery_app.py

from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    'process-daily-recalls': {
        'task': 'recall.process_due_recalls',
        'schedule': crontab(hour=8, minute=0),  # Every day at 8 AM
    },
    'nightly-clustering': {
        'task': 'clustering.nightly_clustering',
        'schedule': crontab(hour=2, minute=0),  # Every day at 2 AM
    },
}
```

---

## 3. Local LLM Multi-Pass Analysis

### Executive Summary

Most AI journaling apps are constrained by API costs (OpenAI charges per token). With Ollama running locally, you can perform unlimited inference. This enables sophisticated multi-pass analysis pipelines that would be prohibitively expensive with cloud LLMs.

**Key Insight:** While competitors run single-pass summarization, you can run 5-10 pass analysis chains (extract → cluster → synthesize → reflect → actionize) at zero marginal cost. This depth of analysis is a massive differentiator.

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              MULTI-PASS ANALYSIS PIPELINE                            │
└─────────────────────────────────────────────────────────────────────┘

Entry Set → [Pass 1] Extract Entities → [Pass 2] Identify Themes
               ↓                              ↓
         Entity Store                    Theme Store
               ↓                              ↓
         [Pass 3] Cross-Reference ← [Pass 4] Temporal Analysis
               ↓                              ↓
         Connections Map              Evolution Timeline
               ↓                              ↓
         [Pass 5] Synthesize Insights ← [Pass 6] Generate Actions
               ↓                              ↓
         Structured Insight            Action Items
               ↓
         [Pass 7] Meta-Reflection (reflect on insights)
               ↓
         Final Deep Insight
```

### 3.1 Database Schema

```sql
-- Store extracted entities (people, places, projects, emotions)
CREATE TABLE extracted_entities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,  -- 'person', 'place', 'project', 'emotion', 'event'
    entity_value TEXT NOT NULL,
    context TEXT,  -- Sentence where entity appeared
    confidence FLOAT,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_entities_user_type (user_id, entity_type),
    INDEX idx_entities_entry (entry_id)
);

-- Entity relationships (co-occurrence, causality, etc.)
CREATE TABLE entity_relationships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    entity_1_id INTEGER REFERENCES extracted_entities(id) ON DELETE CASCADE,
    entity_2_id INTEGER REFERENCES extracted_entities(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50),  -- 'co_occurs', 'causes', 'precedes', 'conflicts'
    strength FLOAT DEFAULT 1.0,  -- How strong the relationship
    evidence_entries INTEGER[] DEFAULT '{}',  -- Entry IDs supporting this relationship
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_relationships_user (user_id),
    INDEX idx_relationships_entities (entity_1_id, entity_2_id)
);

-- Multi-pass analysis results (versioned)
CREATE TABLE analysis_passes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    analysis_session_id INTEGER REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    pass_number INTEGER NOT NULL,
    pass_type VARCHAR(50) NOT NULL,  -- 'extract', 'cluster', 'synthesize', 'reflect', 'actionize'
    input_data JSONB,  -- Input to this pass
    output_data JSONB,  -- Output from this pass
    llm_prompt TEXT,  -- Prompt used
    llm_response TEXT,  -- Raw LLM response
    processing_time_seconds FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_analysis_passes_session (analysis_session_id, pass_number)
);

-- Analysis sessions (one per deep analysis run)
CREATE TABLE analysis_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    session_type VARCHAR(50),  -- 'weekly', 'monthly', 'on_demand', 'milestone'
    entry_count INTEGER,
    total_passes INTEGER,
    status VARCHAR(50) DEFAULT 'running',  -- 'running', 'completed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    INDEX idx_analysis_sessions_user (user_id, started_at)
);

-- Final synthesized insights (output of full pipeline)
CREATE TABLE deep_insights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    analysis_session_id INTEGER REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    insight_type VARCHAR(50),  -- 'pattern', 'breakthrough', 'concern', 'growth_area'
    title VARCHAR(200),
    summary TEXT,
    supporting_evidence JSONB,  -- Entry IDs, entity IDs, quotes
    action_items JSONB,  -- Suggested actions
    confidence FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_deep_insights_user (user_id, created_at)
);

-- Temporal patterns (detected across time)
CREATE TABLE temporal_patterns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    pattern_type VARCHAR(50),  -- 'cyclical', 'progressive', 'reactive', 'seasonal'
    description TEXT,
    frequency_days FLOAT,  -- For cyclical patterns
    detection_confidence FLOAT,
    affected_entities INTEGER[] DEFAULT '{}',  -- Entity IDs involved
    example_entries INTEGER[] DEFAULT '{}',  -- Representative entries
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_temporal_patterns_user (user_id)
);
```

### 3.2 Multi-Pass Pipeline Design

**Pipeline Stages:**

1. **Pass 1: Entity Extraction**
   - Extract people, places, projects, emotions, events
   - Use NER-style prompting with local LLM
   - Store in `extracted_entities` table

2. **Pass 2: Theme Clustering**
   - Group entries by semantic theme (uses existing embeddings + clustering)
   - Generate theme labels via LLM
   - Cross-reference with entities

3. **Pass 3: Relationship Mapping**
   - Find entity co-occurrences
   - Detect causal relationships ("X happened, then Y")
   - Build relationship graph

4. **Pass 4: Temporal Analysis**
   - Detect patterns over time (cyclical, progressive, reactive)
   - Identify emotional trajectories
   - Find milestone moments

5. **Pass 5: Synthesis**
   - Combine findings from passes 1-4
   - Generate holistic insights
   - Create narratives

6. **Pass 6: Action Generation**
   - Extract actionable items
   - Prioritize by impact/urgency
   - Link to specific insights

7. **Pass 7: Meta-Reflection**
   - LLM reflects on its own insights
   - Identifies what's most important
   - Generates final summary

### 3.3 Background Job Architecture

```python
# api/app/jobs/multipass_analysis_job.py

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.entry import Entry
from app.models.analysis import (
    AnalysisSession, AnalysisPass, ExtractedEntity,
    EntityRelationship, DeepInsight, TemporalPattern
)
from app.services.ollama_service import ollama_service
from app.celery_app import celery_app
from datetime import datetime, timedelta
import asyncio
import json
import time
import logging


@celery_app.task(name="analysis.run_multipass")
def run_multipass_analysis_task(user_id: int, days: int = 30, analysis_type: str = 'monthly'):
    """
    Run full multi-pass analysis pipeline.

    This is a long-running task (10-30 minutes for 100 entries).
    Runs asynchronously, user is notified when complete.
    """
    db = SessionLocal()
    try:
        # Create analysis session
        session = AnalysisSession(
            user_id=user_id,
            session_type=analysis_type,
            status='running'
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # Get entries for analysis
        start_date = datetime.now() - timedelta(days=days)
        entries = db.query(Entry).filter(
            Entry.user_id == user_id,
            Entry.is_deleted == False,
            Entry.created_at >= start_date
        ).order_by(Entry.created_at).all()

        if not entries:
            session.status = 'failed'
            db.commit()
            return {"status": "error", "reason": "no_entries"}

        session.entry_count = len(entries)
        db.commit()

        # Run pipeline passes sequentially
        try:
            # Pass 1: Entity Extraction
            entities = asyncio.run(pass_1_extract_entities(
                user_id, session.id, entries, db
            ))

            # Pass 2: Theme Clustering (reuse existing clustering)
            themes = asyncio.run(pass_2_identify_themes(
                user_id, session.id, entries, db
            ))

            # Pass 3: Relationship Mapping
            relationships = asyncio.run(pass_3_map_relationships(
                user_id, session.id, entities, entries, db
            ))

            # Pass 4: Temporal Analysis
            patterns = asyncio.run(pass_4_temporal_analysis(
                user_id, session.id, entries, entities, db
            ))

            # Pass 5: Synthesis
            insights = asyncio.run(pass_5_synthesize_insights(
                user_id, session.id, entities, themes, relationships, patterns, db
            ))

            # Pass 6: Action Generation
            actions = asyncio.run(pass_6_generate_actions(
                user_id, session.id, insights, db
            ))

            # Pass 7: Meta-Reflection
            final_insight = asyncio.run(pass_7_meta_reflection(
                user_id, session.id, insights, actions, db
            ))

            # Mark session complete
            session.status = 'completed'
            session.completed_at = datetime.now()
            session.total_passes = 7
            db.commit()

            return {
                "status": "success",
                "session_id": session.id,
                "insights_count": len(insights),
                "entities_count": len(entities),
                "patterns_count": len(patterns)
            }

        except Exception as e:
            session.status = 'failed'
            db.commit()
            raise e

    except Exception as e:
        db.rollback()
        logging.error(f"Multi-pass analysis failed for user {user_id}: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


async def pass_1_extract_entities(
    user_id: int,
    session_id: int,
    entries: list,
    db: Session
) -> list:
    """
    Pass 1: Extract entities (people, places, projects, emotions) from entries.
    """
    start_time = time.time()

    # Batch entries for efficiency (process 10 at a time)
    batch_size = 10
    all_entities = []

    for i in range(0, len(entries), batch_size):
        batch = entries[i:i+batch_size]

        # Build prompt with multiple entries
        entries_text = "\n\n---\n\n".join([
            f"Entry {i+j+1} ({e.created_at.date()}):\n{e.title or 'Untitled'}\n{e.content}"
            for j, e in enumerate(batch)
        ])

        prompt = f"""You are analyzing journal entries to extract key entities. For each entry, identify:
- PEOPLE: Names or descriptions of people mentioned
- PLACES: Locations, cities, venues
- PROJECTS: Work projects, goals, activities
- EMOTIONS: Emotional states expressed
- EVENTS: Significant events or occurrences

Entries to analyze:
{entries_text}

Respond in JSON format:
{{
    "entities": [
        {{
            "entry_index": 1,
            "type": "person",
            "value": "Sarah",
            "context": "Had lunch with Sarah",
            "confidence": 0.9
        }},
        ...
    ]
}}"""

        # Call Ollama
        response = await ollama_service.generate_json(prompt)

        try:
            parsed = json.loads(response)

            # Save entities to database
            for ent in parsed.get("entities", []):
                entry_idx = ent.get("entry_index", 1) - 1
                if entry_idx < len(batch):
                    entity = ExtractedEntity(
                        user_id=user_id,
                        entry_id=batch[entry_idx].id,
                        entity_type=ent.get("type"),
                        entity_value=ent.get("value"),
                        context=ent.get("context"),
                        confidence=ent.get("confidence", 0.5)
                    )
                    db.add(entity)
                    all_entities.append(entity)

            db.commit()

        except json.JSONDecodeError:
            logging.warning(f"Failed to parse entities from LLM response")

    # Record pass metadata
    pass_record = AnalysisPass(
        user_id=user_id,
        analysis_session_id=session_id,
        pass_number=1,
        pass_type='extract',
        output_data={"entities_count": len(all_entities)},
        processing_time_seconds=time.time() - start_time
    )
    db.add(pass_record)
    db.commit()

    return all_entities


async def pass_2_identify_themes(
    user_id: int,
    session_id: int,
    entries: list,
    db: Session
) -> list:
    """
    Pass 2: Identify themes using existing clustering + LLM labeling.
    """
    start_time = time.time()

    # Reuse existing clustering infrastructure
    from app.models.cluster import Cluster, ClusterLabel, EntryCluster

    # Get user's active clusters
    clusters = db.query(Cluster).filter(
        Cluster.user_id == user_id,
        Cluster.is_stale == False
    ).all()

    themes = []
    for cluster in clusters:
        label = db.query(ClusterLabel).filter(
            ClusterLabel.cluster_id == cluster.id
        ).first()

        if label:
            themes.append({
                "cluster_id": cluster.id,
                "label": label.label,
                "description": label.description
            })

    # Record pass
    pass_record = AnalysisPass(
        user_id=user_id,
        analysis_session_id=session_id,
        pass_number=2,
        pass_type='cluster',
        output_data={"themes": themes},
        processing_time_seconds=time.time() - start_time
    )
    db.add(pass_record)
    db.commit()

    return themes


async def pass_3_map_relationships(
    user_id: int,
    session_id: int,
    entities: list,
    entries: list,
    db: Session
) -> list:
    """
    Pass 3: Map relationships between entities.
    """
    start_time = time.time()

    # Group entities by type
    from collections import defaultdict
    entities_by_type = defaultdict(list)
    for e in entities:
        entities_by_type[e.entity_type].append(e)

    relationships = []

    # Find co-occurrences (entities in same entry)
    from app.models.analysis import ExtractedEntity
    for entry in entries:
        entry_entities = [e for e in entities if e.entry_id == entry.id]

        # Create co-occurrence relationships
        for i, e1 in enumerate(entry_entities):
            for e2 in entry_entities[i+1:]:
                # Check if relationship already exists
                existing = db.query(EntityRelationship).filter(
                    EntityRelationship.user_id == user_id,
                    EntityRelationship.entity_1_id == e1.id,
                    EntityRelationship.entity_2_id == e2.id
                ).first()

                if existing:
                    # Strengthen existing relationship
                    existing.strength += 0.1
                    if entry.id not in existing.evidence_entries:
                        existing.evidence_entries.append(entry.id)
                else:
                    # Create new relationship
                    rel = EntityRelationship(
                        user_id=user_id,
                        entity_1_id=e1.id,
                        entity_2_id=e2.id,
                        relationship_type='co_occurs',
                        strength=1.0,
                        evidence_entries=[entry.id]
                    )
                    db.add(rel)
                    relationships.append(rel)

    db.commit()

    # LLM pass: Identify causal relationships
    # (For entries with temporal ordering)
    sorted_entries = sorted(entries, key=lambda e: e.created_at)

    # Take sliding window of 3 entries at a time
    for i in range(len(sorted_entries) - 2):
        window = sorted_entries[i:i+3]

        context = "\n\n".join([
            f"Entry {j+1} ({e.created_at.date()}):\n{e.content[:500]}"
            for j, e in enumerate(window)
        ])

        prompt = f"""Analyze these 3 consecutive journal entries and identify any causal relationships between events, emotions, or people.

{context}

Respond in JSON:
{{
    "relationships": [
        {{
            "cause": "Description of cause",
            "effect": "Description of effect",
            "confidence": 0.8
        }}
    ]
}}"""

        try:
            response = await ollama_service.generate_json(prompt)
            parsed = json.loads(response)

            # TODO: Map LLM-detected relationships to entity IDs
            # This would require entity resolution (matching text to entities)

        except:
            pass  # Skip if parsing fails

    # Record pass
    pass_record = AnalysisPass(
        user_id=user_id,
        analysis_session_id=session_id,
        pass_number=3,
        pass_type='relationships',
        output_data={"relationships_count": len(relationships)},
        processing_time_seconds=time.time() - start_time
    )
    db.add(pass_record)
    db.commit()

    return relationships


async def pass_4_temporal_analysis(
    user_id: int,
    session_id: int,
    entries: list,
    entities: list,
    db: Session
) -> list:
    """
    Pass 4: Detect temporal patterns (cyclical, progressive, reactive).
    """
    start_time = time.time()
    patterns = []

    # Group entries by week
    from collections import defaultdict
    weeks = defaultdict(list)
    for entry in entries:
        week_key = entry.created_at.strftime("%Y-W%U")
        weeks[week_key].append(entry)

    # LLM analysis: Look for recurring themes across weeks
    weekly_summaries = []
    for week, week_entries in sorted(weeks.items()):
        if len(week_entries) < 2:
            continue

        context = "\n".join([
            f"- {e.title or e.content[:100]}"
            for e in week_entries
        ])

        prompt = f"""Summarize the main theme or emotional tone of this week's journal entries in 1-2 sentences:

{context}

Respond with just the summary, no preamble."""

        try:
            response = await ollama_service.generate_reflection(context)
            weekly_summaries.append({
                "week": week,
                "summary": response.strip()
            })
        except:
            pass

    # Second pass: Identify patterns across weekly summaries
    if len(weekly_summaries) >= 3:
        summaries_text = "\n".join([
            f"Week {w['week']}: {w['summary']}"
            for w in weekly_summaries
        ])

        prompt = f"""Analyze these weekly journal summaries and identify any recurring patterns, cycles, or progressions.

{summaries_text}

Respond in JSON:
{{
    "patterns": [
        {{
            "type": "cyclical" or "progressive" or "reactive",
            "description": "Description of the pattern",
            "confidence": 0.8
        }}
    ]
}}"""

        try:
            response = await ollama_service.generate_json(prompt)
            parsed = json.loads(response)

            for pat in parsed.get("patterns", []):
                pattern = TemporalPattern(
                    user_id=user_id,
                    pattern_type=pat.get("type"),
                    description=pat.get("description"),
                    detection_confidence=pat.get("confidence", 0.5)
                )
                db.add(pattern)
                patterns.append(pattern)

            db.commit()

        except:
            pass

    # Record pass
    pass_record = AnalysisPass(
        user_id=user_id,
        analysis_session_id=session_id,
        pass_number=4,
        pass_type='temporal',
        output_data={"patterns_count": len(patterns)},
        processing_time_seconds=time.time() - start_time
    )
    db.add(pass_record)
    db.commit()

    return patterns


async def pass_5_synthesize_insights(
    user_id: int,
    session_id: int,
    entities: list,
    themes: list,
    relationships: list,
    patterns: list,
    db: Session
) -> list:
    """
    Pass 5: Synthesize insights from all previous passes.
    """
    start_time = time.time()

    # Build comprehensive context from all passes
    context = f"""Analysis Results:

ENTITIES IDENTIFIED:
{len(entities)} entities extracted across categories:
- People: {len([e for e in entities if e.entity_type == 'person'])}
- Places: {len([e for e in entities if e.entity_type == 'place'])}
- Projects: {len([e for e in entities if e.entity_type == 'project'])}
- Emotions: {len([e for e in entities if e.entity_type == 'emotion'])}

THEMES:
{', '.join([t['label'] for t in themes[:10]])}

RELATIONSHIPS:
{len(relationships)} relationships mapped between entities

TEMPORAL PATTERNS:
{len(patterns)} patterns detected:
{chr(10).join([f"- {p.pattern_type}: {p.description}" for p in patterns[:5]])}
"""

    prompt = f"""You are a professional therapist analyzing a client's journal entries. Based on the analysis results below, generate 3-5 key insights about this person's life, growth, challenges, or patterns.

{context}

For each insight, provide:
1. A title (3-7 words)
2. A detailed summary (2-3 sentences)
3. Supporting evidence
4. Confidence level (high/medium/low)

Respond in JSON:
{{
    "insights": [
        {{
            "type": "pattern" or "breakthrough" or "concern" or "growth_area",
            "title": "Brief title",
            "summary": "Detailed summary",
            "confidence": "high" or "medium" or "low"
        }}
    ]
}}"""

    insights = []

    try:
        response = await ollama_service.generate_json(prompt)
        parsed = json.loads(response)

        for ins in parsed.get("insights", []):
            insight = DeepInsight(
                user_id=user_id,
                analysis_session_id=session_id,
                insight_type=ins.get("type"),
                title=ins.get("title"),
                summary=ins.get("summary"),
                confidence=0.8 if ins.get("confidence") == "high" else 0.5
            )
            db.add(insight)
            insights.append(insight)

        db.commit()

    except Exception as e:
        logging.error(f"Insight synthesis failed: {e}")

    # Record pass
    pass_record = AnalysisPass(
        user_id=user_id,
        analysis_session_id=session_id,
        pass_number=5,
        pass_type='synthesize',
        output_data={"insights_count": len(insights)},
        llm_prompt=prompt,
        processing_time_seconds=time.time() - start_time
    )
    db.add(pass_record)
    db.commit()

    return insights


async def pass_6_generate_actions(
    user_id: int,
    session_id: int,
    insights: list,
    db: Session
) -> list:
    """
    Pass 6: Generate actionable items from insights.
    """
    start_time = time.time()

    insights_text = "\n\n".join([
        f"{i+1}. {ins.title}\n{ins.summary}"
        for i, ins in enumerate(insights)
    ])

    prompt = f"""Based on these insights from a person's journal analysis, suggest 3-5 concrete, actionable steps they could take.

INSIGHTS:
{insights_text}

For each action:
1. Make it specific and actionable
2. Prioritize by impact (high/medium/low)
3. Estimate difficulty (easy/moderate/challenging)

Respond in JSON:
{{
    "actions": [
        {{
            "description": "Specific action to take",
            "priority": "high" or "medium" or "low",
            "difficulty": "easy" or "moderate" or "challenging",
            "related_insight_index": 1
        }}
    ]
}}"""

    actions = []

    try:
        response = await ollama_service.generate_json(prompt)
        parsed = json.loads(response)

        # Update insights with action items
        for act in parsed.get("actions", []):
            insight_idx = act.get("related_insight_index", 1) - 1
            if 0 <= insight_idx < len(insights):
                insight = insights[insight_idx]
                if not insight.action_items:
                    insight.action_items = []
                insight.action_items.append(act)
                actions.append(act)

        db.commit()

    except Exception as e:
        logging.error(f"Action generation failed: {e}")

    # Record pass
    pass_record = AnalysisPass(
        user_id=user_id,
        analysis_session_id=session_id,
        pass_number=6,
        pass_type='actionize',
        output_data={"actions_count": len(actions)},
        processing_time_seconds=time.time() - start_time
    )
    db.add(pass_record)
    db.commit()

    return actions


async def pass_7_meta_reflection(
    user_id: int,
    session_id: int,
    insights: list,
    actions: list,
    db: Session
) -> dict:
    """
    Pass 7: Meta-reflection - LLM reflects on its own insights.
    """
    start_time = time.time()

    insights_summary = "\n".join([
        f"- {ins.title}: {ins.summary}"
        for ins in insights
    ])

    actions_summary = "\n".join([
        f"- {act['description']}"
        for act in actions
    ])

    prompt = f"""You have just completed a deep analysis of someone's journal entries and generated the following insights and actions.

INSIGHTS:
{insights_summary}

ACTIONS:
{actions_summary}

Now, step back and reflect:
1. What is the single most important insight?
2. What overall narrative or pattern emerges?
3. What should this person focus on most?

Write a 3-4 sentence meta-reflection that ties everything together."""

    try:
        response = await ollama_service.generate_reflection(prompt)

        # Create a summary insight
        meta_insight = DeepInsight(
            user_id=user_id,
            analysis_session_id=session_id,
            insight_type='meta_reflection',
            title="Overall Reflection",
            summary=response.strip(),
            confidence=0.9
        )
        db.add(meta_insight)
        db.commit()

        # Record pass
        pass_record = AnalysisPass(
            user_id=user_id,
            analysis_session_id=session_id,
            pass_number=7,
            pass_type='meta_reflect',
            llm_response=response,
            processing_time_seconds=time.time() - start_time
        )
        db.add(pass_record)
        db.commit()

        return {
            "meta_reflection": response.strip()
        }

    except Exception as e:
        logging.error(f"Meta-reflection failed: {e}")
        return {}


@celery_app.task(name="analysis.nightly_deep_analysis")
def nightly_deep_analysis_task():
    """
    Nightly job to run deep analysis for users.
    Only runs for users who have opted in and have enough entries.
    """
    db = SessionLocal()
    try:
        from app.models.user import User
        from app.models.settings import Settings

        # Get users who have deep analysis enabled
        users = db.query(User).join(Settings).filter(
            User.is_active == True,
            Settings.deep_analysis_enabled == True  # Assuming this setting exists
        ).all()

        for user in users:
            # Check if enough time has passed since last analysis
            last_session = db.query(AnalysisSession).filter(
                AnalysisSession.user_id == user.id,
                AnalysisSession.status == 'completed'
            ).order_by(AnalysisSession.started_at.desc()).first()

            if last_session:
                days_since = (datetime.now() - last_session.started_at).days
                if days_since < 30:
                    continue  # Skip, too soon

            # Queue analysis
            run_multipass_analysis_task.delay(user.id, days=30, analysis_type='monthly')

    finally:
        db.close()
```

### 3.4 API Endpoints

```python
# api/app/routers/deep_analysis.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.analysis import (
    AnalysisSession, DeepInsight, ExtractedEntity,
    EntityRelationship, TemporalPattern
)
from app.schemas.analysis import (
    AnalysisSessionResponse, DeepInsightResponse,
    EntityGraphResponse, TemporalPatternResponse
)
from app.core.dependencies import get_current_user
from app.jobs.multipass_analysis_job import run_multipass_analysis_task

router = APIRouter(prefix="/analysis", tags=["deep-analysis"])


@router.post("/run")
async def trigger_deep_analysis(
    days: int = 30,
    current_user: User = Depends(get_current_user),
):
    """Manually trigger deep multi-pass analysis."""
    run_multipass_analysis_task.delay(current_user.id, days, 'on_demand')
    return {
        "status": "queued",
        "message": f"Deep analysis started for past {days} days. This may take 10-30 minutes."
    }


@router.get("/sessions", response_model=List[AnalysisSessionResponse])
async def get_analysis_sessions(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's analysis session history."""
    sessions = db.query(AnalysisSession).filter(
        AnalysisSession.user_id == current_user.id
    ).order_by(AnalysisSession.started_at.desc()).limit(limit).all()

    return sessions


@router.get("/sessions/{session_id}/insights", response_model=List[DeepInsightResponse])
async def get_session_insights(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get insights from a specific analysis session."""
    # Verify session belongs to user
    session = db.query(AnalysisSession).filter(
        AnalysisSession.id == session_id,
        AnalysisSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    insights = db.query(DeepInsight).filter(
        DeepInsight.analysis_session_id == session_id
    ).order_by(DeepInsight.confidence.desc()).all()

    return insights


@router.get("/entities/graph", response_model=EntityGraphResponse)
async def get_entity_graph(
    entity_type: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get entity relationship graph for visualization."""
    # Get entities
    query = db.query(ExtractedEntity).filter(
        ExtractedEntity.user_id == current_user.id
    )

    if entity_type:
        query = query.filter(ExtractedEntity.entity_type == entity_type)

    entities = query.all()

    # Get relationships
    relationships = db.query(EntityRelationship).filter(
        EntityRelationship.user_id == current_user.id
    ).all()

    # Format for graph visualization (nodes + edges)
    nodes = [
        {
            "id": e.id,
            "label": e.entity_value,
            "type": e.entity_type,
            "confidence": e.confidence
        }
        for e in entities
    ]

    edges = [
        {
            "source": r.entity_1_id,
            "target": r.entity_2_id,
            "type": r.relationship_type,
            "strength": r.strength
        }
        for r in relationships
    ]

    return {
        "nodes": nodes,
        "edges": edges
    }


@router.get("/patterns/temporal", response_model=List[TemporalPatternResponse])
async def get_temporal_patterns(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detected temporal patterns."""
    patterns = db.query(TemporalPattern).filter(
        TemporalPattern.user_id == current_user.id
    ).order_by(TemporalPattern.detection_confidence.desc()).all()

    return patterns


@router.get("/latest", response_model=DeepInsightResponse)
async def get_latest_meta_reflection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest meta-reflection insight."""
    insight = db.query(DeepInsight).filter(
        DeepInsight.user_id == current_user.id,
        DeepInsight.insight_type == 'meta_reflection'
    ).order_by(DeepInsight.created_at.desc()).first()

    if not insight:
        raise HTTPException(status_code=404, detail="No analysis completed yet")

    return insight
```

### 3.5 Frontend Integration

**Component: Deep Analysis Dashboard**

```typescript
// app/components/DeepAnalysis.tsx

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EntityGraph } from './EntityGraph';
import { InsightCard } from './InsightCard';

export function DeepAnalysisDashboard() {
  const { data: sessions } = useQuery({
    queryKey: ['analysis', 'sessions'],
    queryFn: () => api.get('/analysis/sessions')
  });

  const latestSession = sessions?.data[0];

  const { data: insights } = useQuery({
    queryKey: ['analysis', 'insights', latestSession?.id],
    queryFn: () => api.get(`/analysis/sessions/${latestSession.id}/insights`),
    enabled: !!latestSession
  });

  const { data: entityGraph } = useQuery({
    queryKey: ['analysis', 'entity-graph'],
    queryFn: () => api.get('/analysis/entities/graph')
  });

  const triggerAnalysis = useMutation({
    mutationFn: () => api.post('/analysis/run', { days: 30 })
  });

  return (
    <div className="deep-analysis">
      <div className="header">
        <h1>Deep Insights</h1>
        <button onClick={() => triggerAnalysis.mutate()}>
          Run New Analysis
        </button>
      </div>

      {latestSession && (
        <div className="session-info">
          <span>Last analysis: {new Date(latestSession.started_at).toLocaleDateString()}</span>
          <span>Status: {latestSession.status}</span>
          <span>{latestSession.entry_count} entries analyzed</span>
        </div>
      )}

      {insights?.data && (
        <div className="insights-grid">
          {insights.data.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {entityGraph?.data && (
        <div className="entity-graph-section">
          <h2>Your Life Network</h2>
          <EntityGraph nodes={entityGraph.data.nodes} edges={entityGraph.data.edges} />
        </div>
      )}
    </div>
  );
}
```

**Component: Entity Graph Visualization (React Flow)**

```typescript
// app/components/EntityGraph.tsx

import ReactFlow, { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';

interface EntityGraphProps {
  nodes: Array<{ id: number; label: string; type: string }>;
  edges: Array<{ source: number; target: number; strength: number }>;
}

export function EntityGraph({ nodes, edges }: EntityGraphProps) {
  // Convert to React Flow format
  const flowNodes: Node[] = nodes.map((n, i) => ({
    id: String(n.id),
    data: { label: n.label },
    position: { x: Math.random() * 500, y: Math.random() * 500 },  // Layout algorithm would improve this
    style: {
      background: getColorForType(n.type),
      border: '2px solid #333'
    }
  }));

  const flowEdges: Edge[] = edges.map(e => ({
    id: `${e.source}-${e.target}`,
    source: String(e.source),
    target: String(e.target),
    style: {
      strokeWidth: e.strength * 3
    }
  }));

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <ReactFlow nodes={flowNodes} edges={flowEdges} fitView />
    </div>
  );
}

function getColorForType(type: string) {
  const colors = {
    person: '#4CAF50',
    place: '#2196F3',
    project: '#FF9800',
    emotion: '#E91E63',
    event: '#9C27B0'
  };
  return colors[type] || '#757575';
}
```

### 3.6 Performance Considerations

**Optimization Strategies:**

1. **Parallel Pass Execution (Future Enhancement):**
   - Passes 1-4 can run in parallel (independent)
   - Passes 5-7 must run sequentially (dependent on earlier passes)
   - Use Celery groups/chains for orchestration

2. **Batching LLM Calls:**
   - Process 10 entries per LLM call instead of 1-per-call
   - Reduces overhead from ~100 calls to ~10 calls for 100 entries

3. **Caching:**
   - Cache entity extractions (don't re-extract on re-analysis)
   - Only process new entries since last analysis

4. **Resource Limits:**
   ```python
   # Limit concurrent deep analysis jobs
   @celery_app.task(name="analysis.run_multipass", rate_limit='1/m')
   ```

5. **Progress Tracking:**
   - Update session status in DB after each pass
   - Allow frontend to poll for progress
   - Send notification when complete

**Resource Usage Estimates:**

| Entries | Total Passes | LLM Calls | Processing Time | DB Size |
|---------|-------------|-----------|-----------------|---------|
| 50      | 7           | ~20       | ~5 min          | ~5MB    |
| 100     | 7           | ~35       | ~15 min         | ~10MB   |
| 500     | 7           | ~150      | ~60 min         | ~50MB   |

**Note:** These are conservative estimates. With batching and optimization, processing time can be cut in half.

### 3.7 Code Examples

**Prompt Engineering Template:**

```python
# api/prompts/multipass/entity_extraction.txt

You are analyzing journal entries to extract key entities. Your task is to identify and categorize important elements mentioned in the text.

ENTITY TYPES TO EXTRACT:
1. PEOPLE: Names or descriptions of people (friends, family, colleagues, etc.)
   - Include relationships if mentioned (e.g., "my sister Sarah")

2. PLACES: Locations, cities, venues, countries
   - Be specific (e.g., "Central Park" not just "park")

3. PROJECTS: Work projects, personal goals, activities being pursued
   - Look for ongoing efforts or initiatives

4. EMOTIONS: Emotional states expressed by the author
   - Primary emotions: joy, sadness, anger, fear, surprise, disgust
   - Complex emotions: frustration, contentment, anxiety, etc.

5. EVENTS: Significant occurrences or happenings
   - Meetings, celebrations, conflicts, milestones

GUIDELINES:
- Extract entities with high confidence only (clear references)
- Include context (the sentence where entity appeared)
- Assign confidence score (0.0 to 1.0)
- For emotions, look for both explicit mentions and implicit tone

ENTRIES TO ANALYZE:
{entries}

OUTPUT FORMAT (JSON):
{{
    "entities": [
        {{
            "entry_index": 1,
            "type": "person|place|project|emotion|event",
            "value": "The entity value",
            "context": "The sentence where it appears",
            "confidence": 0.9
        }}
    ]
}}

Respond with valid JSON only, no additional text.
```

---

## Summary: Comparative Advantage Table

| Feature | Typical Journaling App | EchoVault with These Leverage Points |
|---------|----------------------|-------------------------------------|
| **Thematic Analysis** | Manual tags, keyword search | Automatic clustering of 1024-dim embeddings revealing latent themes |
| **Memory Surfacing** | "On This Day" (fixed 1-year) | Spaced repetition with personalized decay curves (1 day to 6 months) |
| **Insight Depth** | Single-pass LLM summarization | 7-pass analysis pipeline (extract→cluster→synthesize→reflect) |
| **Cost Constraint** | API limits ($$$) | Unlimited local inference (zero marginal cost) |
| **Entity Tracking** | None | Automatic extraction + relationship graph |
| **Pattern Detection** | None | Temporal, cyclical, and reactive pattern detection |
| **Actionability** | Generic suggestions | Context-specific actions tied to deep insights |

---

## Implementation Roadmap

**Phase 1: Clustering (Weeks 1-2)**
- Database migrations for cluster tables
- HDBSCAN implementation
- Nightly clustering job
- Basic cluster API + frontend

**Phase 2: Recall System (Weeks 3-4)**
- Database migrations for recall tables
- SM-2 algorithm implementation
- Daily recall job + notification system
- Recall widget frontend

**Phase 3: Multi-Pass Analysis (Weeks 5-8)**
- Database migrations for analysis tables
- Pass 1-3 implementation (extract, cluster, relationships)
- Pass 4-7 implementation (temporal, synthesize, actions, meta)
- Deep analysis dashboard frontend

**Phase 4: Polish & Optimization (Weeks 9-10)**
- Performance tuning (indexing, batching)
- Visualization improvements (graphs, charts)
- User onboarding flows
- Documentation

---

## Key Files Created

This analysis would be saved as:

- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/docs/TECHNICAL_LEVERAGE_ANALYSIS.md`

Additional implementation files would include:

**Backend:**
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/models/cluster.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/models/recall.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/models/analysis.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/jobs/clustering_job.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/jobs/recall_job.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/jobs/multipass_analysis_job.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/routers/clusters.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/routers/recall.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/routers/deep_analysis.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/schemas/cluster.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/schemas/recall.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/app/schemas/analysis.py`

**Frontend:**
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/app/components/ClusterExplorer.tsx`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/app/components/ClusterTimeline.tsx`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/app/components/DailyRecalls.tsx`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/app/components/RecallSettings.tsx`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/app/components/DeepAnalysis.tsx`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/app/components/EntityGraph.tsx`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/app/components/InsightCard.tsx`

**Database Migrations:**
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/alembic/versions/xxx_add_clustering_tables.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/alembic/versions/xxx_add_recall_tables.py`
- `/Users/aryan/Documents/PersonalCoding/infinite-drafts/api/alembic/versions/xxx_add_analysis_tables.py`
