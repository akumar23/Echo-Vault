# Import all tasks so Celery can discover them
from app.jobs.mood_job import infer_mood_task  # noqa: F401
from app.jobs.insights_job import (  # noqa: F401
    generate_insights_task,
    nightly_insights_task,
)
from app.jobs.reflection_job import generate_reflection_task  # noqa: F401
