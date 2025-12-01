# Import all tasks so Celery can discover them
from app.jobs.embedding_job import create_embedding_task
from app.jobs.mood_job import infer_mood_task
from app.jobs.insights_job import generate_insights_task, nightly_insights_task
from app.jobs.reflection_job import generate_reflection_task
from app.jobs.clustering_job import (
    full_recluster_task,
    generate_cluster_label_task,
    incremental_cluster_assignment_task,
    nightly_clustering_task
)
