"""Centralized, recency-based context provider for AI features."""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import List, Optional, Sequence
from urllib.parse import urlparse

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entry import Entry
from app.models.settings import Settings as UserSettings
from app.services.reflection_cache import get_cached_context, set_cached_context

logger = logging.getLogger(__name__)

COLD_START_THRESHOLD = 5
LOCAL_LLM_BUNDLE_CAP = 50
MOOD_EXAMPLE_MIN_LABELS = 5
MOOD_EXAMPLE_PER_LEVEL = 1
_LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "::1", "ollama", "host.docker.internal"}
_LOCAL_HOSTNAME_SUFFIXES = (".local", ".internal", ".lan")


class Intent(str, Enum):
    MOOD = "mood"
    REFLECTION = "reflection"
    INSIGHTS = "insights"
    CHAT = "chat"


@dataclass
class EntrySummary:
    id: int
    title: Optional[str]
    content: str
    created_at: datetime
    mood_user: Optional[int]
    mood_inferred: Optional[int]
    tags: List[str]
    score: float


@dataclass
class MoodExample:
    entry_id: int
    content: str
    mood: int
    similarity: float


@dataclass
class UserBaseline:
    entry_count: int
    labeled_mood_count: int
    mood_user_mean: Optional[float]
    last_entry_at: Optional[datetime]


@dataclass
class ContextBundle:
    cold_start: bool
    intent: Intent
    anchor_entry: Optional[EntrySummary]
    related_entries: List[EntrySummary]
    recent_window: List[EntrySummary]
    mood_examples: List[MoodExample]
    user_baseline: UserBaseline
    cache_hit: bool
    is_local_llm: bool
    bundle_cap_applied: bool
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def is_local_llm_url(url: Optional[str]) -> bool:
    if not url:
        return True
    try:
        hostname = (urlparse(url).hostname or "").lower()
    except (ValueError, AttributeError):
        return True
    return (
        not hostname
        or hostname in _LOCAL_HOSTNAMES
        or any(hostname.endswith(suffix) for suffix in _LOCAL_HOSTNAME_SUFFIXES)
    )


def _params_hash(*parts: object) -> str:
    canon = json.dumps(parts, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(canon).hexdigest()[:16]


def _row_to_summary(entry: Entry, score: float = 1.0) -> EntrySummary:
    return EntrySummary(
        id=entry.id,
        title=entry.title,
        content=entry.content or "",
        created_at=entry.created_at,
        mood_user=entry.mood_user,
        mood_inferred=entry.mood_inferred,
        tags=list(entry.tags or []),
        score=float(score),
    )


class ContextService:
    """Selects bounded chronological context without embeddings."""

    async def get_context(
        self,
        db: Session,
        user_id: int,
        intent: Intent,
        *,
        anchor_text: Optional[str] = None,
        anchor_entry_id: Optional[int] = None,
        time_window_days: Optional[int] = None,
        k: int = 8,
        mmr_lambda: float = 0.65,
        generation_url: Optional[str] = None,
    ) -> ContextBundle:
        # Keep legacy arguments in the public signature while callers migrate;
        # anchor_text and mmr_lambda no longer affect chronological selection.
        del anchor_text, mmr_lambda

        baseline = self._compute_baseline(db, user_id)
        is_local = is_local_llm_url(
            generation_url or self._resolve_generation_url(db, user_id)
        )
        if baseline.entry_count < COLD_START_THRESHOLD:
            return self._cold_start_bundle(intent, baseline, is_local)

        params_hash = _params_hash(anchor_entry_id, time_window_days, k)
        cached = get_cached_context(user_id, intent.value, params_hash)
        if cached:
            bundle = self._materialize_from_cache(db, user_id, intent, cached, baseline, is_local)
            if bundle is not None:
                bundle.cache_hit = True
                return bundle

        anchor_entry = (
            self._load_entry(db, user_id, anchor_entry_id)
            if anchor_entry_id is not None
            else None
        )

        recent: List[EntrySummary] = []
        if intent in (Intent.REFLECTION, Intent.INSIGHTS) or time_window_days:
            recent = self._retrieve_recent_window(
                db,
                user_id,
                window_days=time_window_days or self._default_window_for_intent(intent),
                limit=self._default_recent_limit_for_intent(intent, k),
            )

        related: List[EntrySummary] = []
        if intent in (Intent.CHAT, Intent.MOOD) or anchor_entry_id is not None:
            related = self._retrieve_recent_entries(
                db,
                user_id,
                limit=k,
                exclude_entry_id=anchor_entry_id,
            )

        mood_examples: List[MoodExample] = []
        if (
            intent == Intent.MOOD
            and anchor_entry_id is not None
            and baseline.labeled_mood_count >= MOOD_EXAMPLE_MIN_LABELS
        ):
            mood_examples = self._build_mood_examples(db, user_id, anchor_entry_id)

        bundle = ContextBundle(
            cold_start=False,
            intent=intent,
            anchor_entry=anchor_entry,
            related_entries=related,
            recent_window=recent,
            mood_examples=mood_examples,
            user_baseline=baseline,
            cache_hit=False,
            is_local_llm=is_local,
            bundle_cap_applied=False,
        )
        bundle = self._apply_local_llm_cap(bundle)
        try:
            set_cached_context(
                user_id, intent.value, params_hash, self._serialize_for_cache(bundle)
            )
        except Exception:
            logger.warning(
                "Failed to write ContextService cache",
                extra={"user_id": user_id, "intent": intent.value},
                exc_info=True,
            )
        return bundle

    def _cold_start_bundle(
        self, intent: Intent, baseline: UserBaseline, is_local: bool
    ) -> ContextBundle:
        return ContextBundle(
            cold_start=True,
            intent=intent,
            anchor_entry=None,
            related_entries=[],
            recent_window=[],
            mood_examples=[],
            user_baseline=baseline,
            cache_hit=False,
            is_local_llm=is_local,
            bundle_cap_applied=False,
        )

    def _compute_baseline(self, db: Session, user_id: int) -> UserBaseline:
        row = (
            db.query(
                func.count(Entry.id).label("entry_count"),
                func.count(Entry.mood_user).label("labeled_mood_count"),
                func.avg(Entry.mood_user).label("mood_user_mean"),
                func.max(Entry.created_at).label("last_entry_at"),
            )
            .filter(Entry.user_id == user_id, Entry.is_deleted.is_(False))
            .one()
        )
        return UserBaseline(
            entry_count=int(row.entry_count or 0),
            labeled_mood_count=int(row.labeled_mood_count or 0),
            mood_user_mean=(
                float(row.mood_user_mean) if row.mood_user_mean is not None else None
            ),
            last_entry_at=row.last_entry_at,
        )

    def _resolve_generation_url(self, db: Session, user_id: int) -> Optional[str]:
        row = (
            db.query(UserSettings.generation_url)
            .filter(UserSettings.user_id == user_id)
            .first()
        )
        return row[0] if row else None

    def _load_entry(
        self, db: Session, user_id: int, entry_id: int
    ) -> Optional[EntrySummary]:
        entry = (
            db.query(Entry)
            .filter(
                Entry.id == entry_id,
                Entry.user_id == user_id,
                Entry.is_deleted.is_(False),
            )
            .first()
        )
        return _row_to_summary(entry) if entry else None

    def _retrieve_recent_entries(
        self,
        db: Session,
        user_id: int,
        *,
        limit: int,
        exclude_entry_id: Optional[int] = None,
    ) -> List[EntrySummary]:
        if limit <= 0:
            return []
        query = db.query(Entry).filter(
            Entry.user_id == user_id, Entry.is_deleted.is_(False)
        )
        if exclude_entry_id is not None:
            query = query.filter(Entry.id != exclude_entry_id)
        rows = query.order_by(Entry.created_at.desc()).limit(limit).all()
        return [_row_to_summary(row) for row in rows]

    def _retrieve_recent_window(
        self,
        db: Session,
        user_id: int,
        *,
        window_days: int,
        limit: int,
    ) -> List[EntrySummary]:
        start = datetime.now(timezone.utc) - timedelta(days=window_days)
        rows = (
            db.query(Entry)
            .filter(
                Entry.user_id == user_id,
                Entry.is_deleted.is_(False),
                Entry.created_at >= start,
            )
            .order_by(Entry.created_at.desc())
            .limit(limit)
            .all()
        )
        return [_row_to_summary(row) for row in rows]

    def _build_mood_examples(
        self, db: Session, user_id: int, anchor_entry_id: int
    ) -> List[MoodExample]:
        rows = (
            db.query(Entry)
            .filter(
                Entry.user_id == user_id,
                Entry.id != anchor_entry_id,
                Entry.mood_user.isnot(None),
                Entry.is_deleted.is_(False),
            )
            .order_by(Entry.created_at.desc())
            .all()
        )
        examples: List[MoodExample] = []
        counts: dict[int, int] = {}
        for row in rows:
            mood = int(row.mood_user)
            if counts.get(mood, 0) >= MOOD_EXAMPLE_PER_LEVEL:
                continue
            examples.append(
                MoodExample(
                    entry_id=row.id,
                    content=row.content or "",
                    mood=mood,
                    similarity=1.0,
                )
            )
            counts[mood] = counts.get(mood, 0) + 1
        return sorted(examples, key=lambda example: example.mood)

    def _default_window_for_intent(self, intent: Intent) -> int:
        return 30 if intent == Intent.INSIGHTS else 7

    def _default_recent_limit_for_intent(self, intent: Intent, k: int) -> int:
        if intent == Intent.REFLECTION:
            return 10
        if intent == Intent.INSIGHTS:
            return max(k, 15)
        return k

    def _apply_local_llm_cap(self, bundle: ContextBundle) -> ContextBundle:
        if not bundle.is_local_llm:
            return bundle
        total = len(bundle.related_entries) + len(bundle.recent_window)
        if total <= LOCAL_LLM_BUNDLE_CAP:
            return bundle
        bundle.related_entries = bundle.related_entries[:LOCAL_LLM_BUNDLE_CAP]
        remaining = LOCAL_LLM_BUNDLE_CAP - len(bundle.related_entries)
        bundle.recent_window = bundle.recent_window[:remaining]
        bundle.bundle_cap_applied = True
        return bundle

    def _serialize_for_cache(self, bundle: ContextBundle) -> dict:
        def _slim(entries: Sequence[EntrySummary]) -> List[dict]:
            return [{"id": entry.id, "score": entry.score} for entry in entries]

        return {
            "anchor_entry_id": bundle.anchor_entry.id if bundle.anchor_entry else None,
            "related_ids": _slim(bundle.related_entries),
            "recent_ids": _slim(bundle.recent_window),
            "mood_examples": [
                {
                    "id": example.entry_id,
                    "mood": example.mood,
                    "similarity": example.similarity,
                }
                for example in bundle.mood_examples
            ],
            "bundle_cap_applied": bundle.bundle_cap_applied,
        }

    def _materialize_from_cache(
        self,
        db: Session,
        user_id: int,
        intent: Intent,
        cached: dict,
        baseline: UserBaseline,
        is_local: bool,
    ) -> Optional[ContextBundle]:
        try:
            related_meta = cached.get("related_ids") or []
            recent_meta = cached.get("recent_ids") or []
            mood_meta = cached.get("mood_examples") or []
            anchor_id = cached.get("anchor_entry_id")
            all_ids = [item["id"] for item in related_meta + recent_meta + mood_meta]
            if anchor_id is not None:
                all_ids.append(anchor_id)
            rows = (
                db.query(Entry)
                .filter(
                    Entry.id.in_(all_ids),
                    Entry.user_id == user_id,
                    Entry.is_deleted.is_(False),
                )
                .all()
                if all_ids
                else []
            )
            by_id = {row.id: row for row in rows}
            if len(by_id) < len(set(all_ids)):
                return None

            def _rehydrate(items: Sequence[dict]) -> List[EntrySummary]:
                return [
                    _row_to_summary(by_id[item["id"]], item.get("score", 1.0))
                    for item in items
                ]

            def _rehydrate_mood_examples(items: Sequence[dict]) -> List[MoodExample]:
                return [
                    MoodExample(
                        entry_id=item["id"],
                        content=by_id[item["id"]].content or "",
                        mood=item["mood"],
                        similarity=item.get("similarity", 1.0),
                    )
                    for item in items
                ]

            return ContextBundle(
                cold_start=False,
                intent=intent,
                anchor_entry=_row_to_summary(by_id[anchor_id]) if anchor_id else None,
                related_entries=_rehydrate(related_meta),
                recent_window=_rehydrate(recent_meta),
                mood_examples=_rehydrate_mood_examples(mood_meta),
                user_baseline=baseline,
                cache_hit=True,
                is_local_llm=is_local,
                bundle_cap_applied=bool(cached.get("bundle_cap_applied")),
            )
        except Exception:
            logger.warning("Failed to rehydrate ContextService cache", exc_info=True)
            return None


context_service = ContextService()
