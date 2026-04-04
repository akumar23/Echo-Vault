"""
WebSocket chat router for streaming conversations about reflections.

Auth: client must first call GET /auth/ws-ticket (cookie-authenticated) to obtain
a short-lived one-time ticket, then connect with ?ticket=<ticket> in the URL.
This avoids exposing long-lived JWTs in server logs.
"""
import json
import logging
import time
from collections import deque
from contextlib import contextmanager
from typing import Deque, Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import func

from app.database import SessionLocal
from app.models.embedding import EntryEmbedding
from app.models.entry import Entry
from app.models.user import User
from app.services.llm_service import get_embedding_service_for_user, get_generation_service_for_user
from app.services.reflection_cache import reflection_cache
from app.services.token_store import token_store

router = APIRouter()
logger = logging.getLogger(__name__)

WS_NORMAL_CLOSE = 1000
WS_AUTH_FAILED = 4001
WS_USER_NOT_FOUND = 4002
WS_SERVER_ERROR = 1011

# Per-connection rate limiting
_MAX_MESSAGE_LENGTH = 2000      # chars — reject longer messages
_MAX_MESSAGES_PER_MINUTE = 10  # sliding window per connection


def _check_rate_limit(timestamps: Deque[float]) -> bool:
    """
    Sliding-window rate limiter for WebSocket messages.

    Returns True if the message should be allowed, False if rate limited.
    Mutates `timestamps` in place.
    """
    now = time.monotonic()
    # Evict entries older than 60 seconds
    while timestamps and timestamps[0] < now - 60:
        timestamps.popleft()
    if len(timestamps) >= _MAX_MESSAGES_PER_MINUTE:
        return False
    timestamps.append(now)
    return True

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


@contextmanager
def get_db_session():
    """Short-lived DB session for WebSocket handlers (avoids pool exhaustion)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def authenticate_websocket(websocket: WebSocket, ticket: Optional[str]) -> Optional[int]:
    """
    Authenticate a WebSocket connection using a one-time ticket.

    The ticket must be obtained first via GET /auth/ws-ticket (cookie-authenticated).
    Tickets are consumed immediately on use (one-time only, 60s TTL).
    """
    if not ticket:
        await websocket.close(code=WS_AUTH_FAILED, reason="Missing authentication ticket")
        return None

    user_id = token_store.consume_ws_ticket(ticket)
    if user_id is None:
        await websocket.close(code=WS_AUTH_FAILED, reason="Invalid or expired ticket")
        return None

    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if user is None:
            await websocket.close(code=WS_USER_NOT_FOUND, reason="User not found or inactive")
            return None

    return user_id


async def get_related_entries(user_id: int, query: str, embedding_service, k: int = 3) -> List[Dict]:
    """Get semantically related entries using pgvector (short-lived session)."""
    try:
        query_embedding = await embedding_service.get_embedding(query)

        with get_db_session() as db:
            distance = EntryEmbedding.embedding.cosine_distance(query_embedding)
            similarity_expr = 1 - (distance / 2)

            results = db.query(
                Entry.title,
                Entry.content,
                Entry.created_at,
                similarity_expr.label("score"),
            ).join(
                EntryEmbedding, Entry.id == EntryEmbedding.entry_id
            ).filter(
                Entry.user_id == user_id,
                Entry.is_deleted == False,
                EntryEmbedding.is_active == True,
            ).order_by(distance).limit(k).all()

            return [
                {
                    "title": r.title,
                    "content": r.content[:500] if r.content else "",
                    "created_at": r.created_at.isoformat(),
                    "score": float(r.score),
                }
                for r in results
            ]
    except Exception as e:
        logger.warning(f"Failed to get related entries: {e}")
        return []


def format_related_entries(entries: List[Dict]) -> str:
    if not entries:
        return "No related entries found."
    return "\n".join(
        f"{i}. [{e.get('title') or 'Untitled'}]: {e.get('content', '')}"
        for i, e in enumerate(entries, 1)
    )


@router.websocket("/ws/chat")
async def chat_websocket(
    websocket: WebSocket,
    ticket: Optional[str] = Query(default=None),
):
    """
    WebSocket endpoint for streaming chat about reflections.

    Query Parameters:
        ticket: One-time auth ticket obtained from GET /auth/ws-ticket

    Client Messages:
        {"type": "chat_message", "content": "user message"}

    Server Messages:
        {"type": "context", "reflection": "...", "related_entries": [...]}
        {"type": "token", "content": "..."}
        {"type": "complete"}
        {"type": "error", "message": "..."}
    """
    websocket_accepted = False

    try:
        user_id = await authenticate_websocket(websocket, ticket)
        if user_id is None:
            return

        await websocket.accept()
        websocket_accepted = True

        cached = reflection_cache.get_reflection(user_id)
        reflection_text = cached.get("reflection", "") if cached else ""

        with get_db_session() as db:
            generation_service = get_generation_service_for_user(db, user_id)
            embedding_service = get_embedding_service_for_user(db, user_id)

        await websocket.send_json({
            "type": "context",
            "reflection": reflection_text,
            "related_entries": [],
        })

        conversation_history: List[Dict[str, str]] = []
        message_timestamps: Deque[float] = deque()

        while True:
            try:
                data = await websocket.receive_json()

                if data.get("type") != "chat_message":
                    continue

                user_message = data.get("content", "").strip()
                if not user_message:
                    continue

                # Enforce message length limit
                if len(user_message) > _MAX_MESSAGE_LENGTH:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Message too long (max {_MAX_MESSAGE_LENGTH} characters)"
                    })
                    continue

                # Enforce per-connection rate limit
                if not _check_rate_limit(message_timestamps):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Too many messages. Please wait before sending another."
                    })
                    continue

                conversation_history.append({"role": "user", "content": user_message})

                related_entries = await get_related_entries(user_id, user_message, embedding_service, k=3)

                system_prompt = CHAT_SYSTEM_PROMPT.format(
                    reflection=reflection_text,
                    related_entries=format_related_entries(related_entries),
                )

                messages = [{"role": "system", "content": system_prompt}] + conversation_history[-10:]

                full_response = ""
                async for token_content in generation_service.chat_completion_stream(messages, temperature=0.7):
                    full_response += token_content
                    await websocket.send_json({"type": "token", "content": token_content})

                conversation_history.append({"role": "assistant", "content": full_response})
                await websocket.send_json({"type": "complete"})

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for user {user_id}")
                break
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON message"})
            except Exception as e:
                logger.error(f"Error processing chat message: {e}")
                await websocket.send_json({"type": "error", "message": "Failed to process message"})

    except Exception as e:
        logger.error(f"Chat WebSocket error: {e}")
        if websocket_accepted:
            try:
                await websocket.close(code=WS_SERVER_ERROR, reason="Internal server error")
            except Exception:
                pass
