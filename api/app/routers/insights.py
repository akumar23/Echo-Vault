from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.insight import Insight
from app.schemas.insight import InsightResponse
from app.core.dependencies import get_current_user
from app.jobs.insights_job import generate_insights_task

router = APIRouter()


@router.post("/generate")
async def generate_insights(
    days: int = 7,
    current_user: User = Depends(get_current_user),
):
    """Manually trigger insight generation for the current user."""
    generate_insights_task.delay(current_user.id, days)
    return {"status": "queued", "message": f"Generating insights for the past {days} days"}


@router.get("/recent", response_model=List[InsightResponse])
async def get_recent_insights(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    insights = db.query(Insight).filter(
        Insight.user_id == current_user.id
    ).order_by(Insight.created_at.desc()).limit(limit).all()
    return insights

