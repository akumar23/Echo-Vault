import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.models.user import User
from app.core.dependencies import get_current_user
from app.core.security import decode_access_token
from app.database import SessionLocal
from app.services.reflection_cache import reflection_cache
from app.jobs.reflection_job import enqueue_reflection_job

router = APIRouter()
logger = logging.getLogger(__name__)


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


def authenticate_from_token(token: Optional[str]) -> Optional[int]:
    """Authenticate user from JWT token (for SSE which can't use headers).

    Returns user_id if valid, None otherwise.
    """
    if not token:
        return None

    payload = decode_access_token(token)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        return None

    # Verify user exists
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if user is None:
            return None
        return user_id
    finally:
        db.close()


@router.get("/stream")
async def stream_reflection(
    token: Optional[str] = Query(default=None)
):
    """
    SSE endpoint for real-time reflection status updates.

    Eliminates client-side polling by streaming updates from the server.
    The server checks Redis every 2 seconds internally (vs client polling every 5s).
    Connection auto-closes when reflection is complete or errored.

    Query Parameters:
        token: JWT authentication token (required, since EventSource doesn't support headers)

    SSE Events:
        data: {"reflection": "...", "status": "generating|complete|error"}
    """
    user_id = authenticate_from_token(token)
    if user_id is None:
        # Return 401 for auth failures
        raise HTTPException(status_code=401, detail="Invalid or missing authentication token")

    async def event_generator():
        last_status = None
        last_reflection = None
        check_count = 0
        max_checks = 150  # 5 minutes max (150 * 2s = 300s)

        while check_count < max_checks:
            check_count += 1

            try:
                cached = reflection_cache.get_reflection(user_id)

                if cached is None:
                    # No reflection exists, trigger generation
                    reflection_cache.set_reflection(user_id, "", status="generating")
                    enqueue_reflection_job(user_id)
                    cached = {"reflection": "", "status": "generating"}

                current_status = cached.get("status")
                current_reflection = cached.get("reflection", "")

                # Only send update if something changed (reduces data transfer)
                if current_status != last_status or current_reflection != last_reflection:
                    data = json.dumps({
                        "reflection": current_reflection,
                        "status": current_status
                    })
                    yield f"data: {data}\n\n"
                    last_status = current_status
                    last_reflection = current_reflection

                # Stop streaming once complete or error
                if current_status in ("complete", "error"):
                    logger.debug(f"SSE stream ending for user {user_id}: status={current_status}")
                    break

                # Check every 2 seconds (server-side interval)
                await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"SSE stream error for user {user_id}: {e}")
                error_data = json.dumps({
                    "reflection": "Error checking reflection status",
                    "status": "error"
                })
                yield f"data: {error_data}\n\n"
                break

        # Send final keepalive before closing
        yield f": stream complete\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx/proxy buffering
            "Access-Control-Allow-Origin": "*",  # CORS for SSE
        }
    )
