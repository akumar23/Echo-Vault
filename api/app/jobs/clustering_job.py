"""
Clustering jobs for semantic analysis of journal entries.

Uses HDBSCAN to automatically discover recurring themes in user's journal
entries based on their embedding vectors.
"""
import logging
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional

import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.models.cluster import (
    SemanticCluster,
    ClusterSnapshot,
    EntryClusterMembership,
    ClusterLabel
)
from app.models.user import User
from app.celery_app import celery_app
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)


def should_recluster(user_id: int, db: Session) -> bool:
    """
    Determine if a user's entries should be reclustered.

    Triggers reclustering if:
    - No previous clustering exists
    - >10% of entries are new or modified since last clustering
    - >30 days since last clustering
    """
    last_snapshot = db.query(ClusterSnapshot).filter(
        ClusterSnapshot.user_id == user_id
    ).order_by(ClusterSnapshot.snapshot_date.desc()).first()

    if not last_snapshot:
        return True  # First clustering

    # Count entries that haven't been clustered yet
    unclustered_count = db.query(Entry).join(EntryEmbedding).filter(
        Entry.user_id == user_id,
        Entry.is_deleted == False,
        EntryEmbedding.is_active == True,
        EntryEmbedding.last_clustered_at == None
    ).count()

    # Count entries modified after last snapshot
    modified_count = db.query(Entry).join(EntryEmbedding).filter(
        Entry.user_id == user_id,
        Entry.is_deleted == False,
        EntryEmbedding.is_active == True,
        EntryEmbedding.cluster_version < last_snapshot.id
    ).count()

    total_entries = last_snapshot.total_entries
    if total_entries == 0:
        return True

    change_ratio = (unclustered_count + modified_count) / max(total_entries, 1)

    # Recluster if >10% changes or >30 days since last
    days_since = (datetime.now(last_snapshot.snapshot_date.tzinfo) - last_snapshot.snapshot_date).days
    return change_ratio > 0.10 or days_since > 30


@celery_app.task(name="clustering.full_recluster")
def full_recluster_task(user_id: int) -> Dict[str, Any]:
    """
    Complete reclustering of all user entries using HDBSCAN.

    This is the main clustering job that:
    1. Fetches all active embeddings for a user
    2. Runs HDBSCAN clustering
    3. Creates new cluster records
    4. Assigns entries to clusters
    5. Triggers label generation for each cluster
    """
    db = SessionLocal()
    try:
        logger.info(f"Starting full reclustering for user {user_id}")

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
            logger.info(f"User {user_id} has fewer than 10 entries, skipping clustering")
            return {"status": "skipped", "reason": "insufficient_entries", "count": len(embeddings_data)}

        # 2. Convert to numpy array
        entry_ids = [e.entry_id for e in embeddings_data]

        # Handle pgvector's array format - convert to list if needed
        embeddings_list = []
        for e in embeddings_data:
            emb = e.embedding
            if hasattr(emb, 'tolist'):
                embeddings_list.append(emb.tolist())
            elif isinstance(emb, (list, tuple)):
                embeddings_list.append(list(emb))
            else:
                embeddings_list.append(list(emb))

        embeddings_matrix = np.array(embeddings_list, dtype=np.float32)

        logger.info(f"Clustering {len(entry_ids)} entries with shape {embeddings_matrix.shape}")

        # 3. Run HDBSCAN
        clusterer = HDBSCAN(
            min_cluster_size=5,  # Minimum 5 entries per theme
            min_samples=3,  # More lenient for smaller datasets
            metric='euclidean',  # Use euclidean with normalized vectors
            cluster_selection_epsilon=0.1,
        )

        # Normalize embeddings for better clustering
        norms = np.linalg.norm(embeddings_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1  # Avoid division by zero
        normalized_embeddings = embeddings_matrix / norms

        cluster_labels = clusterer.fit_predict(normalized_embeddings)

        # 4. Create snapshot
        unique_clusters = set(cluster_labels) - {-1}  # Exclude noise (-1)
        noise_count = int(np.sum(cluster_labels == -1))

        snapshot = ClusterSnapshot(
            user_id=user_id,
            total_entries=len(entry_ids),
            total_clusters=len(unique_clusters),
            noise_count=noise_count,
            snapshot_metadata={
                "algorithm": "hdbscan",
                "min_cluster_size": 5,
                "min_samples": 3,
                "embedding_dim": int(embeddings_matrix.shape[1])
            }
        )
        db.add(snapshot)
        db.flush()  # Get snapshot.id

        logger.info(f"Created snapshot {snapshot.id} with {len(unique_clusters)} clusters, {noise_count} noise entries")

        # 5. Mark old clusters as stale
        db.query(SemanticCluster).filter(
            SemanticCluster.user_id == user_id,
            SemanticCluster.is_stale == False
        ).update({"is_stale": True})

        # 6. Create new cluster records and compute centroids
        cluster_id_map = {}  # HDBSCAN label -> DB cluster ID

        for hdbscan_label in unique_clusters:
            # Get indices of entries in this cluster
            cluster_mask = cluster_labels == hdbscan_label
            cluster_embeddings = normalized_embeddings[cluster_mask]

            # Compute centroid
            centroid = np.mean(cluster_embeddings, axis=0).tolist()

            cluster = SemanticCluster(
                user_id=user_id,
                cluster_algorithm='hdbscan',
                min_cluster_size=5,
                centroid=centroid
            )
            db.add(cluster)
            db.flush()
            cluster_id_map[hdbscan_label] = cluster.id

        # 7. Create entry-cluster assignments
        for idx, (entry_id, hdbscan_label) in enumerate(zip(entry_ids, cluster_labels)):
            if hdbscan_label == -1:
                continue  # Skip noise

            # Compute membership score as similarity to centroid
            entry_embedding = normalized_embeddings[idx:idx+1]
            cluster = db.query(SemanticCluster).filter(
                SemanticCluster.id == cluster_id_map[hdbscan_label]
            ).first()

            if cluster and cluster.centroid:
                centroid_array = np.array(cluster.centroid).reshape(1, -1)
                similarity = cosine_similarity(entry_embedding, centroid_array)[0][0]
            else:
                similarity = 1.0

            assignment = EntryClusterMembership(
                entry_id=entry_id,
                cluster_id=cluster_id_map[hdbscan_label],
                membership_score=float(similarity),
                snapshot_id=snapshot.id
            )
            db.add(assignment)

        # 8. Update embeddings clustering metadata
        now = datetime.utcnow()
        for entry_id in entry_ids:
            db.query(EntryEmbedding).filter(
                EntryEmbedding.entry_id == entry_id
            ).update({
                "last_clustered_at": now,
                "cluster_version": snapshot.id
            })

        db.commit()

        logger.info(f"Clustering complete for user {user_id}, triggering label generation")

        # 9. Enqueue label generation for each cluster
        for db_cluster_id in cluster_id_map.values():
            generate_cluster_label_task.delay(db_cluster_id)

        return {
            "status": "success",
            "snapshot_id": snapshot.id,
            "clusters_created": len(unique_clusters),
            "noise_entries": noise_count
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Clustering failed for user {user_id}: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="clustering.generate_label")
def generate_cluster_label_task(cluster_id: int) -> Dict[str, Any]:
    """
    Generate a human-readable label for a cluster using Ollama.

    Selects representative entries from the cluster and asks the LLM
    to generate a concise theme label and description.
    """
    db = SessionLocal()
    try:
        logger.info(f"Generating label for cluster {cluster_id}")

        # 1. Get cluster and find representative entries
        cluster = db.query(SemanticCluster).filter(SemanticCluster.id == cluster_id).first()
        if not cluster:
            return {"status": "error", "reason": "cluster_not_found"}

        # 2. Get entries with highest membership scores
        assignments = db.query(EntryClusterMembership).filter(
            EntryClusterMembership.cluster_id == cluster_id
        ).order_by(EntryClusterMembership.membership_score.desc()).limit(10).all()

        entry_ids = [a.entry_id for a in assignments]
        entries = db.query(Entry).filter(Entry.id.in_(entry_ids)).all()

        if not entries:
            return {"status": "error", "reason": "no_entries"}

        # 3. Build context for LLM (top 5 most representative entries)
        context_entries = entries[:5]
        context_text = "\n\n---\n\n".join([
            f"Entry from {e.created_at.strftime('%Y-%m-%d')}:\n{e.content[:500]}"
            for e in context_entries
        ])

        # 4. Generate label via Ollama
        prompt = f"""You are analyzing a cluster of journal entries that share a common theme.
Based on these representative entries, generate a short, descriptive label (2-5 words) and a brief description.

Representative entries:
{context_text}

Respond in JSON format only, no other text:
{{"label": "Brief theme label (2-5 words)", "description": "One sentence describing this theme", "confidence": "high" or "medium" or "low"}}"""

        # Call Ollama synchronously (we're in a Celery task)
        response = asyncio.run(_generate_label_async(prompt))

        # 5. Parse and save label
        try:
            # Try to extract JSON from response
            response_text = response.strip()
            # Handle potential markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            parsed = json.loads(response_text)

            confidence_map = {"high": 0.9, "medium": 0.7, "low": 0.5}
            confidence_score = confidence_map.get(parsed.get("confidence", "medium"), 0.7)

            label = ClusterLabel(
                cluster_id=cluster_id,
                label=parsed.get("label", "Unlabeled Theme")[:100],
                description=parsed.get("description", ""),
                representative_entry_ids=[e.id for e in context_entries],
                confidence=confidence_score
            )
            db.add(label)
            db.commit()

            logger.info(f"Generated label for cluster {cluster_id}: {label.label}")
            return {
                "status": "success",
                "label": label.label,
                "description": label.description
            }
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON response for cluster {cluster_id}: {response[:100]}")
            # Fallback: use first part of response as label
            fallback_label = response.strip()[:50].split('\n')[0]
            if not fallback_label or fallback_label.startswith('{'):
                fallback_label = "Unlabeled Theme"

            label = ClusterLabel(
                cluster_id=cluster_id,
                label=fallback_label,
                description="",
                representative_entry_ids=[e.id for e in context_entries],
                confidence=0.3
            )
            db.add(label)
            db.commit()
            return {"status": "success", "label": fallback_label, "fallback": True}

    except Exception as e:
        db.rollback()
        logger.error(f"Label generation failed for cluster {cluster_id}: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


async def _generate_label_async(prompt: str) -> str:
    """Helper to call Ollama for label generation."""
    client = ollama_service._get_client()
    response = await client.post(
        f"{ollama_service.base_url}/api/generate",
        json={
            "model": ollama_service.reflection_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3  # Lower temperature for more consistent labels
            }
        },
        timeout=60.0
    )
    response.raise_for_status()
    data = response.json()
    return data.get("response", "")


@celery_app.task(name="clustering.incremental_assign")
def incremental_cluster_assignment_task(entry_id: int) -> Dict[str, Any]:
    """
    Assign a single new entry to existing clusters based on similarity.

    Used for new entries to avoid full reclustering. If the entry doesn't
    fit well into existing clusters, it remains unassigned until the next
    full reclustering.
    """
    db = SessionLocal()
    try:
        entry = db.query(Entry).filter(Entry.id == entry_id).first()
        if not entry:
            return {"status": "error", "reason": "entry_not_found"}

        embedding_record = db.query(EntryEmbedding).filter(
            EntryEmbedding.entry_id == entry_id,
            EntryEmbedding.is_active == True
        ).first()

        if not embedding_record or not embedding_record.embedding:
            return {"status": "error", "reason": "no_embedding"}

        # Get user's active clusters
        clusters = db.query(SemanticCluster).filter(
            SemanticCluster.user_id == entry.user_id,
            SemanticCluster.is_stale == False
        ).all()

        if not clusters:
            return {"status": "skipped", "reason": "no_clusters"}

        # Convert entry embedding
        entry_emb = embedding_record.embedding
        if hasattr(entry_emb, 'tolist'):
            entry_vector = np.array(entry_emb.tolist(), dtype=np.float32)
        else:
            entry_vector = np.array(list(entry_emb), dtype=np.float32)

        # Normalize
        norm = np.linalg.norm(entry_vector)
        if norm > 0:
            entry_vector = entry_vector / norm
        entry_vector = entry_vector.reshape(1, -1)

        # Find best matching cluster
        best_cluster = None
        best_similarity = 0.0
        similarity_threshold = 0.7

        for cluster in clusters:
            if not cluster.centroid:
                continue

            centroid_vector = np.array(cluster.centroid, dtype=np.float32).reshape(1, -1)
            similarity = cosine_similarity(entry_vector, centroid_vector)[0][0]

            if similarity > best_similarity:
                best_similarity = similarity
                best_cluster = cluster

        if best_cluster and best_similarity >= similarity_threshold:
            # Get latest snapshot
            latest_snapshot = db.query(ClusterSnapshot).filter(
                ClusterSnapshot.user_id == entry.user_id
            ).order_by(ClusterSnapshot.snapshot_date.desc()).first()

            assignment = EntryClusterMembership(
                entry_id=entry_id,
                cluster_id=best_cluster.id,
                membership_score=float(best_similarity),
                snapshot_id=latest_snapshot.id if latest_snapshot else None
            )
            db.add(assignment)

            # Mark embedding as clustered
            embedding_record.last_clustered_at = datetime.utcnow()
            if latest_snapshot:
                embedding_record.cluster_version = latest_snapshot.id

            db.commit()

            return {
                "status": "assigned",
                "cluster_id": best_cluster.id,
                "similarity": float(best_similarity)
            }
        else:
            return {
                "status": "unassigned",
                "reason": "no_matching_cluster",
                "best_similarity": float(best_similarity) if best_similarity else 0
            }

    except Exception as e:
        db.rollback()
        logger.error(f"Incremental assignment failed for entry {entry_id}: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="clustering.nightly_clustering")
def nightly_clustering_task() -> Dict[str, Any]:
    """
    Nightly job to recluster users who need it.

    Checks each active user and triggers reclustering if their
    entries have changed significantly since the last clustering.
    """
    db = SessionLocal()
    users_processed = 0
    users_clustered = 0

    try:
        # Get all active users
        users = db.query(User).filter(User.is_active == True).all()

        for user in users:
            users_processed += 1
            if should_recluster(user.id, db):
                full_recluster_task.delay(user.id)
                users_clustered += 1
                logger.info(f"Triggered clustering for user {user.id}")

        return {
            "status": "success",
            "users_processed": users_processed,
            "users_clustered": users_clustered
        }

    except Exception as e:
        logger.error(f"Nightly clustering job failed: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


def enqueue_clustering_job(user_id: int) -> None:
    """Enqueue a full reclustering job for a user."""
    full_recluster_task.delay(user_id)


def enqueue_incremental_assignment(entry_id: int) -> None:
    """Enqueue incremental cluster assignment for a new entry."""
    incremental_cluster_assignment_task.delay(entry_id)
