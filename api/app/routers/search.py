from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, cast, Float
from typing import List
from datetime import datetime, timedelta
from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.models.settings import Settings
from app.schemas.search import SearchRequest, SearchResult
from app.core.dependencies import get_current_user
from app.services.llm_service import get_embedding_service_for_user
from pgvector.sqlalchemy import Vector

router = APIRouter()


@router.post("/semantic", response_model=List[SearchResult])
async def semantic_search(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get user settings for half-life
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    half_life_days = settings.search_half_life_days if settings else 30.0

    # Get query embedding using user's configured embedding service
    embedding_service = get_embedding_service_for_user(db, current_user.id)
    query_embedding = await embedding_service.get_embedding(search_request.query)

    # Calculate age in days using SQL (EXTRACT returns epoch in seconds)
    # age_days = (NOW() - created_at) / 86400
    age_days_expr = (
        func.extract('epoch', func.now() - Entry.created_at) / 86400.0
    )

    # Time decay formula: 1.0 / (1.0 + (age_days / half_life_days))
    # Using GREATEST to ensure age_days is never negative
    decay_expr = 1.0 / (1.0 + (func.greatest(age_days_expr, 0.0) / half_life_days))

    # Cosine similarity: 1 - cosine_distance
    # pgvector's <=> operator returns cosine distance (0 = identical, 2 = opposite)
    # cosine similarity = 1 - (cosine_distance / 2)
    # Simplified: similarity = 1 - (distance / 2) = (2 - distance) / 2
    distance = EntryEmbedding.embedding.cosine_distance(query_embedding)
    similarity_expr = 1 - (distance / 2)

    # Combined score: similarity * decay
    score_expr = similarity_expr * decay_expr

    # Build optimized query with score calculation in SQL
    query = db.query(
        Entry.id.label("entry_id"),
        Entry.title,
        Entry.content,
        Entry.created_at,
        score_expr.label("score")
    ).join(
        EntryEmbedding, Entry.id == EntryEmbedding.entry_id
    ).filter(
        Entry.user_id == current_user.id,
        Entry.is_deleted == False,
        EntryEmbedding.is_active == True
    )

    # Apply date range filter
    if search_request.date_range:
        if search_request.date_range.start:
            query = query.filter(Entry.created_at >= search_request.date_range.start)
        if search_request.date_range.end:
            query = query.filter(Entry.created_at <= search_request.date_range.end)

    # Apply tags filter
    if search_request.tags:
        query = query.filter(Entry.tags.contains(search_request.tags))

    # Order by score descending and limit to top k - all in database
    query = query.order_by(score_expr.desc()).limit(search_request.k)

    # Execute query and return results
    results = query.all()

    # Convert to response format
    return [
        {
            "entry_id": row.entry_id,
            "title": row.title,
            "content": row.content,
            "created_at": row.created_at,
            "score": float(row.score)
        }
        for row in results
    ]

