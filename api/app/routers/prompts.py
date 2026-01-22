import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models.user import User
from app.models.entry import Entry
from app.models.prompt_interaction import PromptInteraction
from app.schemas.prompt import (
    PromptInteractionCreate,
    PromptInteractionResponse,
    SuggestionsResponse,
    WritingSuggestion,
    PromptStats,
    PromptStatsResponse,
)
from app.core.dependencies import get_current_user
from app.services.llm_service import get_generation_service_for_user

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
async def get_writing_suggestions(
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
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
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
) -> List[WritingSuggestion]:
    """Generate AI-powered writing suggestions."""
    suggestions = []

    # Prepare entries text for theme extraction
    entry_texts = [f"{e.title or ''}\n{e.content}" for e in entries[:5]]

    # Generate Question style suggestion
    try:
        theme = await llm_service.extract_common_theme(entry_texts)
        question_prompt = await _generate_question_suggestion(theme, llm_service)
        suggestions.append(
            WritingSuggestion(
                id=str(uuid.uuid4()),
                text=question_prompt,
                type="question",
                context=f"Based on your recent entries about {theme}",
            )
        )
    except Exception:
        suggestions.append(_get_fallback_question())

    # Generate Prompt style suggestion (mood-based)
    try:
        prompt_text = await _generate_prompt_suggestion(avg_mood, llm_service)
        mood_context = "Your mood has been lower lately" if avg_mood < 3 else "Reflecting on recent feelings"
        suggestions.append(
            WritingSuggestion(
                id=str(uuid.uuid4()),
                text=prompt_text,
                type="prompt",
                context=mood_context,
            )
        )
    except Exception:
        suggestions.append(_get_fallback_prompt(avg_mood))

    # Generate Continuation style suggestion
    try:
        continuation = await _generate_continuation_suggestion(entries, llm_service)
        if continuation:
            suggestions.append(continuation)
        else:
            suggestions.append(_get_fallback_continuation(entries))
    except Exception:
        suggestions.append(_get_fallback_continuation(entries))

    return suggestions


async def _generate_question_suggestion(theme: str, llm_service) -> str:
    """Generate an introspective question based on a theme."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a thoughtful journaling coach. Generate a single introspective question "
                "that encourages deep reflection on the given theme.\n\n"
                "RULES:\n"
                "- Output ONLY the question, no explanations\n"
                "- Question should be open-ended (not yes/no)\n"
                "- Be specific to the theme\n"
                "- Keep it under 20 words"
            ),
        },
        {
            "role": "user",
            "content": f"Generate an introspective question about: {theme}",
        },
    ]

    response = await llm_service.chat_completion(messages, temperature=0.7)
    return response.strip().strip('"')


async def _generate_prompt_suggestion(avg_mood: float, llm_service) -> str:
    """Generate a writing prompt based on current mood."""
    mood_context = ""
    if avg_mood <= 2:
        mood_context = "The user has been feeling down. Generate a gentle, supportive prompt."
    elif avg_mood >= 4:
        mood_context = "The user has been feeling good. Generate a prompt to explore or celebrate that."
    else:
        mood_context = "The user has neutral mood. Generate a reflective prompt."

    messages = [
        {
            "role": "system",
            "content": (
                "You are a journaling prompt generator. Create a single writing prompt.\n\n"
                "RULES:\n"
                "- Output ONLY the prompt, no explanations\n"
                "- Start with an action verb (Write about, Describe, Explore, etc.)\n"
                "- Be specific and evocative\n"
                "- Keep it under 15 words"
            ),
        },
        {
            "role": "user",
            "content": mood_context,
        },
    ]

    response = await llm_service.chat_completion(messages, temperature=0.7)
    return response.strip().strip('"')


async def _generate_continuation_suggestion(
    entries: List[Entry], llm_service
) -> Optional[WritingSuggestion]:
    """Generate a continuation suggestion referencing a specific past entry."""
    if not entries:
        return None

    # Pick a recent entry with substantial content
    source_entry = None
    for entry in entries:
        if len(entry.content) > 100:
            source_entry = entry
            break

    if not source_entry:
        source_entry = entries[0]

    # Extract a key topic from the entry
    content_preview = source_entry.content[:300]

    messages = [
        {
            "role": "system",
            "content": (
                "You are a journaling assistant. Based on a past journal entry, "
                "generate a follow-up prompt that references what the user wrote.\n\n"
                "RULES:\n"
                "- Start with a time reference like 'Earlier you mentioned...' or 'You wrote about...'\n"
                "- Reference a specific detail from the entry\n"
                "- End with a question about how things have changed or progressed\n"
                "- Keep it under 25 words\n"
                "- Output ONLY the prompt"
            ),
        },
        {
            "role": "user",
            "content": f"Past entry:\n{content_preview}\n\nGenerate follow-up prompt:",
        },
    ]

    response = await llm_service.chat_completion(messages, temperature=0.7)

    # Format the date nicely
    entry_date = source_entry.created_at
    if entry_date.date() == datetime.utcnow().date():
        date_str = "earlier today"
    elif (datetime.utcnow() - entry_date).days == 1:
        date_str = "yesterday"
    else:
        date_str = entry_date.strftime("%A")  # Day name like "Tuesday"

    return WritingSuggestion(
        id=str(uuid.uuid4()),
        text=response.strip().strip('"'),
        type="continuation",
        context=f"From your entry {date_str}",
        source_entry_id=source_entry.id,
    )


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
        if entry_date.date() == datetime.utcnow().date():
            date_str = "earlier today"
        elif (datetime.utcnow() - entry_date).days == 1:
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
