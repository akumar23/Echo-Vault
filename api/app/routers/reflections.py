import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.core.security import decode_access_token
from app.core.rate_limit import limiter
from app.database import SessionLocal
from app.jobs.reflection_job import enqueue_reflection_job
from app.models.user import User
from app.services.reflection_cache import reflection_cache

router = APIRouter()
logger = logging.getLogger(__name__)


class ReflectionResponse(BaseModel):
    reflection: str
    status: str  # "generating", "complete", "error"


@router.get("", response_model=ReflectionResponse)
async def get_reflection(current_user: User = Depends(get_current_user)):
    """Get the cached reflection for the current user."""
    cached = reflection_cache.get_reflection(current_user.id)

    if cached is None:
        reflection_cache.set_reflection(current_user.id, "", status="generating")
        enqueue_reflection_job(current_user.id)
        return ReflectionResponse(reflection="", status="generating")

    return ReflectionResponse(reflection=cached["reflection"], status=cached["status"])


@router.post("/regenerate", response_model=ReflectionResponse)
@limiter.limit("5/minute")
async def regenerate_reflection(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Force regeneration of reflection."""
    reflection_cache.set_reflection(current_user.id, "", status="generating")
    enqueue_reflection_job(current_user.id)
    return ReflectionResponse(reflection="", status="generating")


def _authenticate_from_cookie(request: Request) -> Optional[int]:
    """Authenticate from the access_token cookie (used by SSE which can't set headers)."""
    token = request.cookies.get("access_token")
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

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        return user_id if user is not None else None
    finally:
        db.close()


@router.get("/stream")
async def stream_reflection(request: Request):
    """
    SSE endpoint for real-time reflection status updates.

    Authenticated via the access_token cookie (sent automatically by the browser).
    The client must use { withCredentials: true } when creating the EventSource.

    SSE Events:
        data: {"reflection": "...", "status": "generating|complete|error"}
    """
    user_id = _authenticate_from_cookie(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing authentication token")

    async def event_generator():
        last_status = None
        last_reflection = None
        check_count = 0
        max_checks = 60  # 5 minutes max (60 * 5s = 300s)

        while check_count < max_checks:
            check_count += 1
            try:
                cached = reflection_cache.get_reflection(user_id)

                if cached is None:
                    reflection_cache.set_reflection(user_id, "", status="generating")
                    enqueue_reflection_job(user_id)
                    cached = {"reflection": "", "status": "generating"}

                current_status = cached.get("status")
                current_reflection = cached.get("reflection", "")

                if current_status != last_status or current_reflection != last_reflection:
                    data = json.dumps({"reflection": current_reflection, "status": current_status})
                    yield f"data: {data}\n\n"
                    last_status = current_status
                    last_reflection = current_reflection

                if current_status in ("complete", "error"):
                    logger.debug(f"SSE stream ending for user {user_id}: status={current_status}")
                    break

                await asyncio.sleep(5)

            except Exception as e:
                logger.error(f"SSE stream error for user {user_id}: {e}")
                error_data = json.dumps({"reflection": "Error checking reflection status", "status": "error"})
                yield f"data: {error_data}\n\n"
                break

        yield ": stream complete\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
