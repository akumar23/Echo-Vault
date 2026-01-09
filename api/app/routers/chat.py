"""
WebSocket chat router for streaming conversations about reflections.

Provides a real-time chat interface where users can ask follow-up questions
about their journal reflections. Includes semantic search for related entries
to provide context to the LLM.
"""
import json
import logging
from typing import List, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.services.llm_service import get_generation_service_for_user, get_embedding_service_for_user
from app.services.reflection_cache import reflection_cache

router = APIRouter()
logger = logging.getLogger(__name__)

# WebSocket close codes
WS_NORMAL_CLOSE = 1000
WS_AUTH_FAILED = 4001
WS_USER_NOT_FOUND = 4002
WS_SERVER_ERROR = 1011

CHAT_SYSTEM_PROMPT = """You are a thoughtful journaling assistant helping the user reflect on their journal entries.

Current Reflection:
{reflection}

Related Journal Entries (for context):
{related_entries}

Guidelines:
- Be empathetic and supportive
- Reference specific details from their entries when relevant
- Ask clarifying questions to help them reflect deeper
- Keep responses concise (2-3 paragraphs max)
- Never make assumptions about information not in the entries
"""


async def authenticate_websocket(
    websocket: WebSocket,
    token: Optional[str],
    db: Session
) -> Optional[User]:
    """Authenticate WebSocket connection using JWT token from query parameter."""
    if not token:
        await websocket.close(code=WS_AUTH_FAILED, reason="Missing authentication token")
        return None

    payload = decode_access_token(token)
    if payload is None:
        await websocket.close(code=WS_AUTH_FAILED, reason="Invalid or expired token")
        return None

    user_id = payload.get("sub")
    if user_id is None:
        await websocket.close(code=WS_AUTH_FAILED, reason="Invalid token payload")
        return None

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        await websocket.close(code=WS_AUTH_FAILED, reason="Invalid user ID")
        return None

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        await websocket.close(code=WS_USER_NOT_FOUND, reason="User not found or inactive")
        return None

    return user


async def get_related_entries(
    db: Session,
    user_id: int,
    query: str,
    embedding_service,
    k: int = 3
) -> List[Dict]:
    """Get semantically related entries using pgvector."""
    try:
        # Get query embedding
        query_embedding = await embedding_service.get_embedding(query)

        # Calculate cosine distance and similarity
        distance = EntryEmbedding.embedding.cosine_distance(query_embedding)
        similarity_expr = 1 - (distance / 2)

        results = db.query(
            Entry.title,
            Entry.content,
            Entry.created_at,
            similarity_expr.label("score")
        ).join(
            EntryEmbedding, Entry.id == EntryEmbedding.entry_id
        ).filter(
            Entry.user_id == user_id,
            Entry.is_deleted == False,
            EntryEmbedding.is_active == True
        ).order_by(distance).limit(k).all()

        return [
            {
                "title": r.title,
                "content": r.content[:500] if r.content else "",  # Truncate for context
                "created_at": r.created_at.isoformat(),
                "score": float(r.score)
            }
            for r in results
        ]
    except Exception as e:
        logger.warning(f"Failed to get related entries: {e}")
        return []


def format_related_entries(entries: List[Dict]) -> str:
    """Format related entries for the system prompt."""
    if not entries:
        return "No related entries found."

    formatted = []
    for i, entry in enumerate(entries, 1):
        title = entry.get("title") or "Untitled"
        content = entry.get("content", "")
        formatted.append(f"{i}. [{title}]: {content}")

    return "\n".join(formatted)


@router.websocket("/ws/chat")
async def chat_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None)
):
    """
    WebSocket endpoint for streaming chat about reflections.

    Query Parameters:
        token: JWT authentication token

    Client Messages:
        {"type": "chat_message", "content": "user message"}

    Server Messages:
        {"type": "context", "reflection": "...", "related_entries": [...]}
        {"type": "token", "content": "..."}
        {"type": "complete"}
        {"type": "error", "message": "..."}
    """
    db = next(get_db())
    websocket_accepted = False

    try:
        # Authenticate before accepting
        user = await authenticate_websocket(websocket, token, db)
        if user is None:
            return

        await websocket.accept()
        websocket_accepted = True

        # Get current reflection from cache
        cached = reflection_cache.get_reflection(user.id)
        reflection_text = cached.get("reflection", "") if cached else ""

        # Get LLM services for this user
        generation_service = get_generation_service_for_user(db, user.id)
        embedding_service = get_embedding_service_for_user(db, user.id)

        # Send initial context
        await websocket.send_json({
            "type": "context",
            "reflection": reflection_text,
            "related_entries": []
        })

        # Conversation history for context (kept in memory)
        conversation_history: List[Dict[str, str]] = []

        # Main message loop
        while True:
            try:
                data = await websocket.receive_json()

                if data.get("type") != "chat_message":
                    continue

                user_message = data.get("content", "").strip()
                if not user_message:
                    continue

                # Add user message to history
                conversation_history.append({
                    "role": "user",
                    "content": user_message
                })

                # Get related entries based on user message
                related_entries = await get_related_entries(
                    db, user.id, user_message, embedding_service, k=3
                )

                # Build system prompt
                system_prompt = CHAT_SYSTEM_PROMPT.format(
                    reflection=reflection_text,
                    related_entries=format_related_entries(related_entries)
                )

                # Build messages for LLM (system + last 10 conversation messages)
                messages = [
                    {"role": "system", "content": system_prompt}
                ] + conversation_history[-10:]

                # Stream response
                full_response = ""
                async for token_content in generation_service.chat_completion_stream(
                    messages,
                    temperature=0.7
                ):
                    full_response += token_content
                    await websocket.send_json({
                        "type": "token",
                        "content": token_content
                    })

                # Add assistant response to history
                conversation_history.append({
                    "role": "assistant",
                    "content": full_response
                })

                # Send completion signal
                await websocket.send_json({"type": "complete"})

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for user {user.id}")
                break
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON message"
                })
            except Exception as e:
                logger.error(f"Error processing chat message: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Failed to process message"
                })

    except Exception as e:
        logger.error(f"Chat WebSocket error: {e}")
        if websocket_accepted:
            try:
                await websocket.close(code=WS_SERVER_ERROR, reason="Internal server error")
            except Exception:
                pass
    finally:
        db.close()
