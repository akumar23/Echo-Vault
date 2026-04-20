import uuid
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.prompt_interaction import PromptInteraction
from app.schemas.prompt import (
    PromptInteractionCreate,
    PromptInteractionResponse,
    ReversePromptResponse,
    SuggestionsResponse,
    WelcomeBackResponse,
    WritingSuggestion,
    PromptStats,
    PromptStatsResponse,
)
from app.core.dependencies import get_current_user
from app.services.llm_service import LLMProviderError, get_generation_service_for_user
from app.services.reflection_cache import (
    get_cached_reverse_prompt,
    set_cached_reverse_prompt,
)

router = APIRouter()


@router.post("/interaction", response_model=PromptInteractionResponse)
async def log_prompt_interaction(
    interaction: PromptInteractionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log a prompt interaction (displayed, clicked, cycled, dismissed, completed)."""
    db_interaction = PromptInteraction(
        user_id=current_user.id,
        prompt_text=interaction.prompt_text,
        prompt_type=interaction.prompt_type,
        action=interaction.action,
        entry_id=interaction.entry_id,
        source_entry_id=interaction.source_entry_id,
    )
    db.add(db_interaction)
    db.commit()
    db.refresh(db_interaction)
    return db_interaction


@router.get("/stats", response_model=PromptStatsResponse)
async def get_prompt_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get prompt engagement statistics for the current user."""
    # Query interaction counts grouped by prompt_type and action
    interactions = (
        db.query(
            PromptInteraction.prompt_type,
            PromptInteraction.action,
            func.count(PromptInteraction.id).label("count"),
        )
        .filter(PromptInteraction.user_id == current_user.id)
        .group_by(PromptInteraction.prompt_type, PromptInteraction.action)
        .all()
    )

    # Aggregate stats by prompt_type
    stats_dict = {}
    total_interactions = 0

    for row in interactions:
        prompt_type = row.prompt_type
        action = row.action
        count = row.count
        total_interactions += count

        if prompt_type not in stats_dict:
            stats_dict[prompt_type] = {
                "displayed_count": 0,
                "clicked_count": 0,
                "completed_count": 0,
            }

        if action == "displayed":
            stats_dict[prompt_type]["displayed_count"] += count
        elif action == "clicked":
            stats_dict[prompt_type]["clicked_count"] += count
        elif action == "completed":
            stats_dict[prompt_type]["completed_count"] += count

    # Calculate completion rates and build response
    stats = []
    for prompt_type, counts in stats_dict.items():
        displayed = counts["displayed_count"]
        completed = counts["completed_count"]
        completion_rate = completed / displayed if displayed > 0 else 0.0

        stats.append(
            PromptStats(
                prompt_type=prompt_type,
                displayed_count=displayed,
                clicked_count=counts["clicked_count"],
                completed_count=completed,
                completion_rate=round(completion_rate, 3),
            )
        )

    return PromptStatsResponse(stats=stats, total_interactions=total_interactions)


@router.get("/suggestions", response_model=SuggestionsResponse)
@limiter.limit("10/minute")
async def get_writing_suggestions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get AI-generated writing suggestions based on recent entries and engagement patterns.

    Returns 3 suggestions:
    1. Question style - introspective question based on themes
    2. Prompt style - direct writing prompt based on mood
    3. Continuation style - references a specific past entry (last 7 days)
    """
    # Get recent entries (last 7 days for continuations)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_entries = (
        db.query(Entry)
        .filter(
            Entry.user_id == current_user.id,
            Entry.is_deleted.is_not(True),
            Entry.created_at >= seven_days_ago,
        )
        .order_by(Entry.created_at.desc())
        .limit(10)
        .all()
    )

    # Check for sufficient data
    if len(recent_entries) < 2:
        return SuggestionsResponse(
            suggestions=_get_fallback_suggestions(),
            preferred_type=None,
            has_sufficient_data=False,
        )

    # Get user's preferred prompt type from engagement stats
    preferred_type = await _get_preferred_type(current_user.id, db)

    # Get LLM service for this user
    llm_service = get_generation_service_for_user(db, current_user.id)

    # Calculate average mood
    moods = [e.mood_user or e.mood_inferred for e in recent_entries if (e.mood_user or e.mood_inferred)]
    avg_mood = sum(moods) / len(moods) if moods else 3.0

    # Generate suggestions
    suggestions = await _generate_suggestions(
        entries=recent_entries,
        avg_mood=avg_mood,
        llm_service=llm_service,
        user_id=current_user.id,
    )

    return SuggestionsResponse(
        suggestions=suggestions,
        preferred_type=preferred_type,
        has_sufficient_data=True,
    )


async def _get_preferred_type(user_id: int, db: Session) -> Optional[str]:
    """Get the user's preferred prompt type based on completion rates."""
    # Query completion rates by prompt type
    stats = (
        db.query(
            PromptInteraction.prompt_type,
            func.sum(
                case(
                    (PromptInteraction.action == "completed", 1),
                    else_=0,
                )
            ).label("completed"),
            func.sum(
                case(
                    (PromptInteraction.action == "displayed", 1),
                    else_=0,
                )
            ).label("displayed"),
        )
        .filter(PromptInteraction.user_id == user_id)
        .group_by(PromptInteraction.prompt_type)
        .all()
    )

    if not stats:
        return None

    # Calculate completion rate for each type
    best_type = None
    best_rate = 0.0

    for row in stats:
        if row.displayed and row.displayed > 0:
            rate = row.completed / row.displayed
            if rate > best_rate:
                best_rate = rate
                best_type = row.prompt_type

    return best_type if best_rate > 0 else None


async def _generate_suggestions(
    entries: List[Entry],
    avg_mood: float,
    llm_service,
    user_id: Optional[int] = None,
) -> List[WritingSuggestion]:
    """Generate AI-powered writing suggestions with a single LLM call."""
    # Prepare context for LLM
    entry_summaries = []
    for e in entries[:5]:
        title = e.title or "Untitled"
        content_preview = e.content[:200] if len(e.content) > 200 else e.content
        entry_summaries.append(f"- {title}: {content_preview}")
    entries_text = "\n".join(entry_summaries)

    # Pick source entry for continuation
    source_entry = next((e for e in entries if len(e.content) > 100), entries[0])
    entry_date = source_entry.created_at
    if entry_date.date() == datetime.now(timezone.utc).date():
        date_str = "earlier today"
    elif (datetime.now(timezone.utc) - entry_date).days == 1:
        date_str = "yesterday"
    else:
        date_str = entry_date.strftime("%A")

    mood_desc = "low" if avg_mood <= 2 else "positive" if avg_mood >= 4 else "neutral"

    messages = [
        {
            "role": "system",
            "content": (
                "You are a journaling coach. Generate 3 writing suggestions based on recent journal entries.\n\n"
                "OUTPUT FORMAT (JSON only):\n"
                "{\n"
                '  "theme": "2-4 word theme from entries (e.g., creative projects, work stress)",\n'
                '  "question": "Open-ended introspective question about the theme (under 20 words)",\n'
                '  "prompt": "Writing prompt starting with action verb (under 15 words)",\n'
                '  "continuation": "Follow-up referencing past entry, ending with question (under 25 words)"\n'
                "}\n\n"
                "RULES:\n"
                "- question: Deep reflection on identified theme\n"
                "- prompt: Mood-appropriate (supportive if low, celebratory if positive)\n"
                "- continuation: Reference specific detail from the most recent entry\n"
                "- Output ONLY valid JSON, no explanations"
            ),
        },
        {
            "role": "user",
            "content": f"Recent entries:\n{entries_text}\n\nMood: {mood_desc}\n\nGenerate suggestions (JSON):",
        },
    ]

    try:
        response = await llm_service.chat_completion(messages, temperature=0.7)
        parsed = _parse_suggestions_response(response)

        return [
            WritingSuggestion(
                id=str(uuid.uuid4()),
                text=parsed["question"],
                type="question",
                context=f"Based on your recent entries about {parsed['theme']}",
            ),
            WritingSuggestion(
                id=str(uuid.uuid4()),
                text=parsed["prompt"],
                type="prompt",
                context="Your mood has been lower lately" if avg_mood < 3 else "Reflecting on recent feelings",
            ),
            WritingSuggestion(
                id=str(uuid.uuid4()),
                text=parsed["continuation"],
                type="continuation",
                context=f"From your entry {date_str}",
                source_entry_id=source_entry.id,
            ),
        ]
    except (httpx.HTTPError, json.JSONDecodeError, ValueError, KeyError):
        logger.warning(
            "Suggestion generation failed, using fallback",
            extra={"user_id": user_id},
            exc_info=True,
        )
        return _get_fallback_suggestions()


def _parse_suggestions_response(response_text: str) -> dict:
    """Parse suggestions from LLM response."""
    # Try to extract JSON from response
    json_match = re.search(r'\{[\s\S]*\}', response_text)
    if json_match:
        parsed = json.loads(json_match.group())
        return {
            "theme": parsed.get("theme", "recent thoughts"),
            "question": parsed.get("question", "What patterns have you noticed in your thoughts lately?"),
            "prompt": parsed.get("prompt", "Write about something you're curious about right now."),
            "continuation": parsed.get("continuation", "Looking back at your recent entries, what stands out?"),
        }
    raise ValueError("Could not parse suggestions JSON")


def _get_fallback_suggestions() -> List[WritingSuggestion]:
    """Return fallback suggestions when there's insufficient data."""
    return [
        WritingSuggestion(
            id=str(uuid.uuid4()),
            text="What's one thing on your mind that you haven't written about yet?",
            type="question",
            context="Getting started",
        ),
        WritingSuggestion(
            id=str(uuid.uuid4()),
            text="Write about a moment today when you felt present.",
            type="prompt",
            context="Daily reflection",
        ),
        WritingSuggestion(
            id=str(uuid.uuid4()),
            text="Describe something you're looking forward to this week.",
            type="prompt",
            context="Future focus",
        ),
    ]


@router.get("/reverse", response_model=ReversePromptResponse)
@limiter.limit("10/minute")
async def get_reverse_prompt(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a single 'reverse prompt' that invites the user to write about
    something they have REFERENCED in their corpus but not EXPLORED.

    Cached in Redis for 24h per user and invalidated when a new entry is created.
    Requires at least 5 entries in the last 30 days; otherwise returns a
    fallback prompt with ``has_sufficient_data=False``.
    """
    cached = get_cached_reverse_prompt(current_user.id)
    if cached:
        return ReversePromptResponse(**cached)

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_entries = (
        db.query(Entry)
        .filter(
            Entry.user_id == current_user.id,
            Entry.is_deleted.is_not(True),
            Entry.created_at >= thirty_days_ago,
        )
        .order_by(Entry.created_at.desc())
        .limit(50)
        .all()
    )

    if len(recent_entries) < 5:
        # Don't cache the fallback — we want to retry once the user has written enough.
        return ReversePromptResponse(
            prompt_text="What's something you've been circling around but haven't quite written down yet?",
            gap_subject="the unspoken",
            rationale="Not enough recent entries to mine a specific gap yet.",
            has_sufficient_data=False,
        )

    entries_text = "\n\n---\n\n".join(
        f"[{e.created_at.strftime('%b %d')}] {(e.title or 'Untitled')}\n{e.content[:600]}"
        for e in recent_entries[:20]
    )

    llm_service = get_generation_service_for_user(db, current_user.id)
    try:
        parsed = await llm_service.generate_reverse_prompt(entries_text)
    except (LLMProviderError, httpx.HTTPError, httpx.TimeoutException, json.JSONDecodeError, ValueError):
        logger.warning(
            "Reverse prompt generation failed, returning fallback",
            extra={"user_id": current_user.id},
            exc_info=True,
        )
        # Soft fallback — still useful, just not personalized. Don't cache so we retry next request.
        return ReversePromptResponse(
            prompt_text="What's one thing you keep mentioning but haven't really sat with?",
            gap_subject="the unexplored",
            rationale="",
            has_sufficient_data=True,
        )

    payload = {
        "prompt_text": parsed["prompt_text"] or "What's one thing you keep mentioning but haven't really sat with?",
        "gap_subject": parsed["gap_subject"] or "the unexplored",
        "rationale": parsed["rationale"],
        "has_sufficient_data": True,
    }
    set_cached_reverse_prompt(current_user.id, payload)
    return ReversePromptResponse(**payload)


@router.get("/welcome-back", response_model=WelcomeBackResponse)
@limiter.limit("10/minute")
async def get_welcome_back(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a short, personalized greeting based on the user's past week.

    Intentionally not cached — meant to be called once per actual login
    (triggered by the frontend on login form submission) so the message is
    always fresh. Falls back to a generic line when there's not enough data
    or the LLM is unreachable.
    """
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_entries = (
        db.query(Entry)
        .filter(
            Entry.user_id == current_user.id,
            Entry.is_deleted.is_not(True),
            Entry.created_at >= seven_days_ago,
        )
        .order_by(Entry.created_at.desc())
        .limit(15)
        .all()
    )

    if len(recent_entries) < 2:
        return WelcomeBackResponse(
            message="Welcome back. A blank page is a good place to start.",
            has_sufficient_data=False,
        )

    entries_text = "\n\n---\n\n".join(
        f"[{e.created_at.strftime('%a')}] {e.content[:500]}"
        for e in recent_entries[:10]
    )

    llm_service = get_generation_service_for_user(db, current_user.id)
    try:
        message = await llm_service.generate_welcome_back(entries_text)
    except (LLMProviderError, httpx.HTTPError, httpx.TimeoutException):
        logger.warning(
            "Welcome-back generation failed, using fallback",
            extra={"user_id": current_user.id},
            exc_info=True,
        )
        return WelcomeBackResponse(
            message="Welcome back. Ready when you are.",
            has_sufficient_data=True,
        )

    if not message:
        message = "Welcome back. Ready when you are."

    return WelcomeBackResponse(message=message, has_sufficient_data=True)


def _get_fallback_question() -> WritingSuggestion:
    """Return a fallback question suggestion."""
    return WritingSuggestion(
        id=str(uuid.uuid4()),
        text="What patterns have you noticed in your thoughts lately?",
        type="question",
        context="Self-reflection",
    )


def _get_fallback_prompt(avg_mood: float) -> WritingSuggestion:
    """Return a fallback prompt suggestion based on mood."""
    if avg_mood <= 2:
        text = "Write about one small thing that brought you comfort recently."
    elif avg_mood >= 4:
        text = "Describe a recent moment that made you smile."
    else:
        text = "Write about something you're curious about right now."

    return WritingSuggestion(
        id=str(uuid.uuid4()),
        text=text,
        type="prompt",
        context="Mood-based suggestion",
    )


def _get_fallback_continuation(entries: List[Entry]) -> WritingSuggestion:
    """Return a fallback continuation suggestion."""
    if entries:
        entry = entries[0]
        entry_date = entry.created_at
        if entry_date.date() == datetime.now(timezone.utc).date():
            date_str = "earlier today"
        elif (datetime.now(timezone.utc) - entry_date).days == 1:
            date_str = "yesterday"
        else:
            date_str = entry_date.strftime("%A")

        return WritingSuggestion(
            id=str(uuid.uuid4()),
            text=f"How are you feeling about what you wrote {date_str}?",
            type="continuation",
            context=f"From your entry {date_str}",
            source_entry_id=entry.id,
        )

    return WritingSuggestion(
        id=str(uuid.uuid4()),
        text="Looking back at your recent entries, what stands out?",
        type="continuation",
        context="Reflection on recent writing",
    )
