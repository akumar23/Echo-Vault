from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.models.user import User
from app.core.dependencies import get_current_user
from app.services.reflection_cache import reflection_cache
from app.jobs.reflection_job import enqueue_reflection_job

router = APIRouter()


class ReflectionResponse(BaseModel):
    reflection: str
    status: str  # "generating", "complete", "error"


@router.get("", response_model=ReflectionResponse)
async def get_reflection(
    current_user: User = Depends(get_current_user)
):
    """Get the cached reflection for the current user"""
    cached = reflection_cache.get_reflection(current_user.id)

    if cached is None:
        # Set status BEFORE enqueuing to prevent duplicate jobs from race condition
        reflection_cache.set_reflection(current_user.id, "", status="generating")
        enqueue_reflection_job(current_user.id)
        return ReflectionResponse(
            reflection="",
            status="generating"
        )

    return ReflectionResponse(
        reflection=cached["reflection"],
        status=cached["status"]
    )


@router.post("/regenerate", response_model=ReflectionResponse)
async def regenerate_reflection(
    current_user: User = Depends(get_current_user)
):
    """Force regeneration of reflection"""
    # Set status BEFORE enqueuing to prevent duplicate jobs
    reflection_cache.set_reflection(current_user.id, "", status="generating")
    enqueue_reflection_job(current_user.id)
    return ReflectionResponse(
        reflection="",
        status="generating"
    )
