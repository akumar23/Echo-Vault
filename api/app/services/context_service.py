"""
ContextService — centralized semantic-context provider for AI features.

All AI features (mood inference, reflections, insights, chat) consume their
"context" through a single typed API on this service. Previously each
feature built its own retrieval logic from scratch; this module unifies
them so they share:

  - The same scoring formula (similarity * time decay, mirroring search.py)
  - MMR diversity reranking (Carbonell & Goldstein, 1998)
  - Per-intent caching (Redis, IDs only — never decrypted content)
  - Local-LLM context-window safety caps
  - Cold-start handling (<5 entries)

Architecture choice: in-process Python module, not a microservice. Sits at
the same layer as LLMService and reflection_cache. Callable from both
FastAPI request handlers and Celery workers.

Cache safety: only entry IDs + scores are persisted to Redis. On cache hit
we re-fetch entries through the ORM, which transparently decrypts via the
EncryptedText column type. A Redis compromise leaks which entries are
related, not what they say.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import List, Optional, Sequence
from urllib.parse import urlparse

import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.embedding import EntryEmbedding
from app.models.entry import Entry
from app.models.settings import Settings as UserSettings
from app.services.llm_service import LLMService, get_embedding_service_for_user
from app.services.reflection_cache import (
    get_cached_context,
    set_cached_context,
)

logger = logging.getLogger(__name__)


# --- Constants -------------------------------------------------------------

# Minimum entries before we engage semantic features. Below this, callers
# get a cold-start bundle and fall back to today's simpler behavior.
COLD_START_THRESHOLD = 5

# Hard cap on entries returned in any single bundle when the user's
# generation provider is local (Ollama / localhost). Protects the small
# context windows of local 7-8B models. Cloud providers bypass this cap.
LOCAL_LLM_BUNDLE_CAP = 50

# How many candidates to fetch from pgvector before MMR reranks down to k.
# Empirically: ~4-5x the requested k strikes a good balance — enough
# diversity to choose from, small enough that the numpy MMR pass stays
# microsecond-scale.
_MMR_CANDIDATE_MULTIPLIER = 5
_MMR_CANDIDATE_FLOOR = 20
_MMR_CANDIDATE_CEILING = 50

# Centroid-anchored retrieval for INSIGHTS averages embeddings of the most
# recent N entries to capture "current themes" as a single vector, then
# pulls MMR-diverse OLDER entries that resonate with those themes.
# Caps prevent a power-user with many recent entries from dominating the
# centroid and shifting it toward generic averages.
_CENTROID_INPUT_CAP = 20
_CENTROID_MIN_INPUTS = 3  # below this, centroid is too noisy — skip

# Few-shot mood inference: only engage once the user has labeled enough
# entries themselves that we can build a mood-balanced example set.
# Below this threshold, fall back to the zero-shot generic mood prompt.
MOOD_EXAMPLE_MIN_LABELS = 5
MOOD_EXAMPLE_PER_LEVEL = 1  # max examples per mood level (1-5)

# Hostnames that mean "the LLM is running on the same machine / network".
# Conservative: only flag obvious local cases. A user running a private
# cloud at a custom hostname will (correctly) bypass the cap.
_LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "::1", "ollama", "host.docker.internal"}
_LOCAL_HOSTNAME_SUFFIXES = (".local", ".internal", ".lan")


# --- Public types ----------------------------------------------------------


class Intent(str, Enum):
    """What the caller intends to do with the context.

    The service uses this to pick a retrieval strategy. Each value maps to
    a different mix of (anchor-based vs time-based) retrieval and a
    different default k / cache TTL.
    """

    MOOD = "mood"               # mood inference for one entry
    REFLECTION = "reflection"   # weekly user-wide reflection
    INSIGHTS = "insights"       # weekly/monthly thematic insights
    CHAT = "chat"               # per-message related-entries for chat


@dataclass
class EntrySummary:
    """Lightweight view of an entry passed back to AI features.

    Content is included because callers will forward it to the LLM prompt;
    it lives only in-process and is never serialized to the cache.
    """

    id: int
    title: Optional[str]
    content: str
    created_at: datetime
    mood_user: Optional[int]
    mood_inferred: Optional[int]
    tags: List[str]
    score: float  # similarity * decay, or 1.0 for chronologically-selected entries


@dataclass
class MoodExample:
    """A single few-shot example: a past entry the user themselves labeled.

    Used by Intent.MOOD to calibrate LLM mood inference against the user's
    personal scale (one user's "4" may be another's "3"). Selection is
    mood-balanced — at most one example per mood level — and ranked by
    semantic similarity to the entry being inferred.
    """

    entry_id: int
    content: str
    mood: int           # 1-5 — the user's own label (NOT the LLM's inference)
    similarity: float   # cosine sim to the anchor entry's embedding


@dataclass
class UserBaseline:
    """Aggregate stats about the user's corpus, useful for prompt grounding."""

    entry_count: int
    labeled_mood_count: int        # how many have mood_user set
    mood_user_mean: Optional[float]
    last_entry_at: Optional[datetime]


@dataclass
class ContextBundle:
    """The unified return type of ContextService.get_context().

    Callers branch on `cold_start` to decide whether to engage AI features
    at all; otherwise they consume `related_entries` / `recent_window`
    according to their intent.
    """

    cold_start: bool
    intent: Intent
    anchor_entry: Optional[EntrySummary]
    related_entries: List[EntrySummary]     # MMR-diverse semantic neighbors
    recent_window: List[EntrySummary]        # chronological slice
    mood_examples: List[MoodExample]         # populated only for Intent.MOOD
    user_baseline: UserBaseline
    cache_hit: bool
    is_local_llm: bool                       # whether the user's gen provider is local
    bundle_cap_applied: bool                 # True iff we trimmed to LOCAL_LLM_BUNDLE_CAP
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# --- Helpers ---------------------------------------------------------------


def is_local_llm_url(url: Optional[str]) -> bool:
    """Decide whether a generation URL points at a local LLM.

    Used to gate the LOCAL_LLM_BUNDLE_CAP. Cloud-hosted models (OpenAI,
    Groq, Anthropic, Together, etc.) have 100k+ token context windows and
    don't need this protection.
    """
    if not url:
        return True  # default: assume local, safest for context-window protection
    try:
        hostname = (urlparse(url).hostname or "").lower()
    except (ValueError, AttributeError):
        return True
    if not hostname:
        return True
    if hostname in _LOCAL_HOSTNAMES:
        return True
    return any(hostname.endswith(suffix) for suffix in _LOCAL_HOSTNAME_SUFFIXES)


def _params_hash(*parts: object) -> str:
    """Stable 16-char hash of cache-key parameters."""
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


def mmr_rerank(
    candidate_vecs: np.ndarray,    # (N, D) — already L2-normalized
    candidate_scores: np.ndarray,  # (N,)  — sim*decay or raw similarity
    k: int,
    lambda_: float = 0.65,
) -> List[int]:
    """Maximum Marginal Relevance reranker.

    Picks the candidate with highest MMR score iteratively. Per iteration
    selects the candidate maximizing:

        lambda_ * score_to_query - (1 - lambda_) * max_sim_to_already_selected

    Returns indices into the candidate arrays. Pure numpy, no sklearn —
    keeps it cheap and dependency-light.

    Reference: Carbonell & Goldstein, "The Use of MMR, Diversity-Based
    Reranking..." (CMU, 1998).
    """
    n = candidate_vecs.shape[0]
    if n == 0 or k <= 0:
        return []
    k = min(k, n)

    selected: List[int] = []
    remaining = list(range(n))

    # First pick: the candidate with the highest raw score.
    first = int(np.argmax(candidate_scores))
    selected.append(first)
    remaining.remove(first)

    while remaining and len(selected) < k:
        sel_mat = candidate_vecs[selected]               # (S, D)
        rem_mat = candidate_vecs[remaining]              # (R, D)
        # Cosine sim between remaining candidates and already-selected.
        # Vectors are L2-normalized, so dot product = cosine similarity.
        sims_to_selected = rem_mat @ sel_mat.T           # (R, S)
        max_sim_to_selected = sims_to_selected.max(axis=1)  # (R,)
        scores_remaining = candidate_scores[remaining]
        mmr_scores = lambda_ * scores_remaining - (1 - lambda_) * max_sim_to_selected
        pick_local = int(np.argmax(mmr_scores))
        pick_global = remaining[pick_local]
        selected.append(pick_global)
        remaining.pop(pick_local)

    return selected


# --- Service ---------------------------------------------------------------


class ContextService:
    """Singleton-style service. Stateless; safe to call concurrently."""

    def __init__(self, *, half_life_days_default: float = 30.0):
        self._half_life_default = half_life_days_default

    # ---- public API -----------------------------------------------------

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
        embedding_service: Optional[LLMService] = None,
        generation_url: Optional[str] = None,
    ) -> ContextBundle:
        """Resolve a context bundle for an AI feature.

        Args:
            db: SQLAlchemy session. Caller owns its lifecycle.
            user_id: Authenticated user.
            intent: One of Intent.* — drives strategy & TTL selection.
            anchor_text: Free-text anchor (e.g., chat message). Embedded
                on the fly. Mutually exclusive with anchor_entry_id.
            anchor_entry_id: Use this entry's existing embedding as the
                anchor (cheap — skips a remote embedding call).
            time_window_days: Restrict retrieval to the last N days.
                Used by REFLECTION/INSIGHTS; passed through for others.
            k: Target number of related entries to return.
            mmr_lambda: 1.0 = pure relevance, 0.0 = pure diversity.
                0.65 is a reasonable default for journaling.
            embedding_service: Optional override. If None and an anchor
                is provided, resolves from user settings.
            generation_url: Override for local-LLM detection. If None,
                resolves from user settings.
        """
        baseline = self._compute_baseline(db, user_id)

        if baseline.entry_count < COLD_START_THRESHOLD:
            return self._cold_start_bundle(intent, baseline, generation_url)

        is_local = is_local_llm_url(
            generation_url or self._resolve_generation_url(db, user_id)
        )

        # --- cache lookup ------------------------------------------------
        params_hash = _params_hash(
            anchor_text and hashlib.sha256(anchor_text.encode()).hexdigest()[:16],
            anchor_entry_id,
            time_window_days,
            k,
            mmr_lambda,
        )
        cached = get_cached_context(user_id, intent.value, params_hash)
        if cached:
            bundle = self._materialize_from_cache(db, intent, cached, baseline, is_local)
            if bundle is not None:
                bundle.cache_hit = True
                return bundle
            # Fall through on materialization failure (e.g., entry deleted).

        # --- retrieval ---------------------------------------------------
        anchor_entry = (
            self._load_entry(db, user_id, anchor_entry_id)
            if anchor_entry_id is not None
            else None
        )

        recent: List[EntrySummary] = []
        if intent in (Intent.REFLECTION, Intent.INSIGHTS) or time_window_days:
            recent = self._retrieve_recent_window(
                db=db,
                user_id=user_id,
                window_days=time_window_days or self._default_window_for_intent(intent),
                limit=self._default_recent_limit_for_intent(intent, k),
            )

        related: List[EntrySummary] = []
        if anchor_text or anchor_entry or intent in (Intent.CHAT, Intent.MOOD):
            # Anchor-driven retrieval (chat message, single-entry reflection,
            # mood-with-trajectory, etc.)
            related = await self._retrieve_related(
                db=db,
                user_id=user_id,
                anchor_text=anchor_text,
                anchor_entry=anchor_entry,
                k=k,
                mmr_lambda=mmr_lambda,
                embedding_service=embedding_service,
                exclude_entry_id=anchor_entry_id,
            )
        elif intent == Intent.INSIGHTS and recent:
            # Centroid-driven retrieval: surface older themed entries that
            # resonate with what the user is writing about now. Substantive
            # semantic upgrade over "concatenate everything in the window".
            related = self._retrieve_centroid_related(
                db=db,
                user_id=user_id,
                recent=recent,
                k=k,
                mmr_lambda=mmr_lambda,
            )

        mood_examples: List[MoodExample] = []
        if (
            intent == Intent.MOOD
            and anchor_entry is not None
            and baseline.labeled_mood_count >= MOOD_EXAMPLE_MIN_LABELS
        ):
            mood_examples = self._build_mood_examples(
                db=db,
                user_id=user_id,
                anchor_entry_id=anchor_entry.id,
            )

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

        # --- cache write -------------------------------------------------
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

    # ---- internals ------------------------------------------------------

    def _cold_start_bundle(
        self,
        intent: Intent,
        baseline: UserBaseline,
        generation_url: Optional[str],
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
            is_local_llm=is_local_llm_url(generation_url),
            bundle_cap_applied=False,
        )

    def _compute_baseline(self, db: Session, user_id: int) -> UserBaseline:
        row = db.query(
            func.count(Entry.id).label("entry_count"),
            func.count(Entry.mood_user).label("labeled_mood_count"),
            func.avg(Entry.mood_user).label("mood_user_mean"),
            func.max(Entry.created_at).label("last_entry_at"),
        ).filter(
            Entry.user_id == user_id,
            Entry.is_deleted == False,  # noqa: E712
        ).one()

        return UserBaseline(
            entry_count=int(row.entry_count or 0),
            labeled_mood_count=int(row.labeled_mood_count or 0),
            mood_user_mean=float(row.mood_user_mean) if row.mood_user_mean is not None else None,
            last_entry_at=row.last_entry_at,
        )

    def _resolve_generation_url(self, db: Session, user_id: int) -> Optional[str]:
        settings = (
            db.query(UserSettings.generation_url)
            .filter(UserSettings.user_id == user_id)
            .first()
        )
        return settings[0] if settings else None

    def _load_entry(self, db: Session, user_id: int, entry_id: int) -> Optional[EntrySummary]:
        entry = (
            db.query(Entry)
            .filter(
                Entry.id == entry_id,
                Entry.user_id == user_id,
                Entry.is_deleted == False,  # noqa: E712
            )
            .first()
        )
        return _row_to_summary(entry) if entry else None

    async def _retrieve_related(
        self,
        *,
        db: Session,
        user_id: int,
        anchor_text: Optional[str],
        anchor_entry: Optional[EntrySummary],
        k: int,
        mmr_lambda: float,
        embedding_service: Optional[LLMService],
        exclude_entry_id: Optional[int],
    ) -> List[EntrySummary]:
        """Anchor-driven retrieval: top-N by sim*decay → MMR rerank to top-k.

        The anchor vector is either (a) freshly embedded from `anchor_text`
        or (b) read from the existing `entry_embeddings` row for
        `anchor_entry.id`. (b) is free; (a) costs one remote call.
        """
        if k <= 0:
            return []

        anchor_vec = await self._resolve_anchor_vector(
            db=db,
            user_id=user_id,
            anchor_text=anchor_text,
            anchor_entry=anchor_entry,
            embedding_service=embedding_service,
        )
        if anchor_vec is None:
            return []

        exclude_ids = {exclude_entry_id} if exclude_entry_id is not None else None
        return self._run_mmr_pipeline(
            db=db,
            user_id=user_id,
            anchor_vec=anchor_vec,
            k=k,
            mmr_lambda=mmr_lambda,
            exclude_entry_ids=exclude_ids,
        )

    def _retrieve_centroid_related(
        self,
        *,
        db: Session,
        user_id: int,
        recent: List[EntrySummary],
        k: int,
        mmr_lambda: float,
    ) -> List[EntrySummary]:
        """Centroid-anchored retrieval over the older corpus.

        Averages embeddings of the most recent N entries into a single
        "current themes" vector, then pulls MMR-diverse entries from
        OUTSIDE the recent window. This surfaces older themes that
        resonate with what the user is writing about right now —
        without ever running an offline clustering pipeline.

        Returns [] if the recent window is too small to form a stable
        centroid, or if the user has no older corpus to retrieve from.
        """
        if len(recent) < _CENTROID_MIN_INPUTS:
            return []

        # Use the most recent N entries (already sorted DESC by caller).
        recent_ids = [r.id for r in recent[:_CENTROID_INPUT_CAP]]
        oldest_recent_ts = min(r.created_at for r in recent)

        vec_rows = (
            db.query(EntryEmbedding.embedding)
            .filter(
                EntryEmbedding.entry_id.in_(recent_ids),
                EntryEmbedding.is_active == True,  # noqa: E712
            )
            .all()
        )
        if len(vec_rows) < _CENTROID_MIN_INPUTS:
            return []

        vecs = np.array(
            [np.asarray(row[0], dtype=np.float32) for row in vec_rows]
        )
        # L2-normalize each, then average, then re-normalize. This is the
        # standard "spherical centroid" — mean-pool followed by renorm so
        # the centroid lives on the unit sphere alongside individual vectors.
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        vecs = vecs / norms
        centroid = vecs.mean(axis=0)
        centroid_norm = np.linalg.norm(centroid)
        if centroid_norm == 0:
            return []
        centroid = centroid / centroid_norm

        return self._run_mmr_pipeline(
            db=db,
            user_id=user_id,
            anchor_vec=centroid.tolist(),
            k=k,
            mmr_lambda=mmr_lambda,
            exclude_entry_ids=set(r.id for r in recent),
            older_than=oldest_recent_ts,
        )

    def _build_mood_examples(
        self,
        *,
        db: Session,
        user_id: int,
        anchor_entry_id: int,
    ) -> List[MoodExample]:
        """Build mood-balanced few-shot examples from the user's own labels.

        Strategy: for each mood level (1..5), pick the user's labeled entry
        with the highest cosine similarity to the anchor. This gives the
        LLM a balanced calibration set tailored to the current entry's
        themes — addressing the "one user's 4 = another's 3" problem.

        SQL pattern: ROW_NUMBER() OVER (PARTITION BY mood_user ORDER BY
        cosine_distance ASC) — picks rank-1 per mood level. Cosine sim is
        derived from distance and returned to the caller for logging.

        Returns [] if the anchor has no active embedding (e.g., embedding
        job hasn't run yet — caller will fall back to zero-shot prompt).
        """
        anchor_row = (
            db.query(EntryEmbedding.embedding)
            .filter(
                EntryEmbedding.entry_id == anchor_entry_id,
                EntryEmbedding.is_active == True,  # noqa: E712
            )
            .first()
        )
        if not anchor_row or anchor_row[0] is None:
            return []
        anchor_vec = list(anchor_row[0])

        distance = EntryEmbedding.embedding.cosine_distance(anchor_vec)
        rn = (
            func.row_number()
            .over(partition_by=Entry.mood_user, order_by=distance.asc())
            .label("rn")
        )

        inner = (
            db.query(
                Entry.id.label("entry_id"),
                Entry.content.label("content"),
                Entry.mood_user.label("mood"),
                distance.label("dist"),
                rn,
            )
            .join(EntryEmbedding, Entry.id == EntryEmbedding.entry_id)
            .filter(
                Entry.user_id == user_id,
                Entry.id != anchor_entry_id,
                Entry.mood_user.isnot(None),
                Entry.is_deleted == False,  # noqa: E712
                EntryEmbedding.is_active == True,  # noqa: E712
            )
            .subquery()
        )

        rows = (
            db.query(
                inner.c.entry_id,
                inner.c.content,
                inner.c.mood,
                inner.c.dist,
            )
            .filter(inner.c.rn <= MOOD_EXAMPLE_PER_LEVEL)
            .order_by(inner.c.mood)
            .all()
        )

        return [
            MoodExample(
                entry_id=r.entry_id,
                content=r.content or "",
                mood=int(r.mood),
                similarity=1.0 - (float(r.dist) / 2),
            )
            for r in rows
        ]

    def _run_mmr_pipeline(
        self,
        *,
        db: Session,
        user_id: int,
        anchor_vec: List[float],
        k: int,
        mmr_lambda: float,
        exclude_entry_ids: Optional[set] = None,
        older_than: Optional[datetime] = None,
    ) -> List[EntrySummary]:
        """Shared retrieval pipeline: pgvector top-N by sim*decay → MMR top-k.

        Used by both anchor-driven (anchor_text/anchor_entry) and centroid-
        driven (insights themes) retrieval paths.

        Two-query design: the candidate-pool query returns only scalar
        columns (id/vec/score), avoiding SQLAlchemy's row-level dedup on
        ORM-entity tuples — that path tries to hash the pgvector embedding,
        which comes back as a numpy ndarray (unhashable). Once MMR picks
        the survivors we fetch the full Entry rows by ID in a second
        indexed query.
        """
        candidate_pool = max(
            _MMR_CANDIDATE_FLOOR,
            min(_MMR_CANDIDATE_CEILING, k * _MMR_CANDIDATE_MULTIPLIER),
        )

        half_life = self._user_half_life(db, user_id)
        age_days = func.extract("epoch", func.now() - Entry.created_at) / 86400.0
        decay = 1.0 / (1.0 + (func.greatest(age_days, 0.0) / half_life))
        distance = EntryEmbedding.embedding.cosine_distance(anchor_vec)
        similarity = 1 - (distance / 2)
        score = similarity * decay

        query = (
            db.query(
                Entry.id.label("entry_id"),
                EntryEmbedding.embedding.label("vec"),
                score.label("score"),
            )
            .join(EntryEmbedding, Entry.id == EntryEmbedding.entry_id)
            .filter(
                Entry.user_id == user_id,
                Entry.is_deleted == False,  # noqa: E712
                EntryEmbedding.is_active == True,  # noqa: E712
            )
        )
        if exclude_entry_ids:
            query = query.filter(~Entry.id.in_(exclude_entry_ids))
        if older_than is not None:
            query = query.filter(Entry.created_at < older_than)

        rows = query.order_by(score.desc()).limit(candidate_pool).all()
        if not rows:
            return []

        entry_ids = [r.entry_id for r in rows]
        vecs = np.array([np.asarray(r.vec, dtype=np.float32) for r in rows])
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        vecs = vecs / norms

        scores = np.array([float(r.score) for r in rows], dtype=np.float32)
        picks = mmr_rerank(vecs, scores, k=k, lambda_=mmr_lambda)

        picked_ids = [entry_ids[i] for i in picks]
        picked_scores = [float(scores[i]) for i in picks]

        # Second query: fetch the actual Entry rows for the picked IDs.
        entry_rows = (
            db.query(Entry)
            .filter(Entry.id.in_(picked_ids))
            .all()
        )
        by_id = {e.id: e for e in entry_rows}

        # Preserve MMR ordering; skip any entry that disappeared between
        # the two queries (rare — deleted concurrently).
        return [
            _row_to_summary(by_id[eid], picked_scores[i])
            for i, eid in enumerate(picked_ids)
            if eid in by_id
        ]

    async def _resolve_anchor_vector(
        self,
        *,
        db: Session,
        user_id: int,
        anchor_text: Optional[str],
        anchor_entry: Optional[EntrySummary],
        embedding_service: Optional[LLMService],
    ) -> Optional[List[float]]:
        if anchor_entry is not None:
            # Use the entry's existing embedding — free.
            row = (
                db.query(EntryEmbedding.embedding)
                .filter(
                    EntryEmbedding.entry_id == anchor_entry.id,
                    EntryEmbedding.is_active == True,  # noqa: E712
                )
                .first()
            )
            if row and row[0] is not None:
                return list(row[0])
            # Fall through to text-based embed if the entry has no active vector.
            anchor_text = anchor_text or f"{anchor_entry.title or ''} {anchor_entry.content}".strip()

        if not anchor_text:
            return None

        if embedding_service is None:
            embedding_service = get_embedding_service_for_user(db, user_id)
        try:
            return await embedding_service.get_embedding(anchor_text, input_type="query")
        except Exception:
            logger.warning(
                "ContextService: failed to embed anchor text",
                extra={"user_id": user_id},
                exc_info=True,
            )
            return None

    def _retrieve_recent_window(
        self,
        *,
        db: Session,
        user_id: int,
        window_days: int,
        limit: int,
    ) -> List[EntrySummary]:
        start = datetime.now(timezone.utc) - timedelta(days=window_days)
        rows = (
            db.query(Entry)
            .filter(
                Entry.user_id == user_id,
                Entry.is_deleted == False,  # noqa: E712
                Entry.created_at >= start,
            )
            .order_by(Entry.created_at.desc())
            .limit(limit)
            .all()
        )
        return [_row_to_summary(r) for r in rows]

    def _default_window_for_intent(self, intent: Intent) -> int:
        if intent == Intent.REFLECTION:
            return 7
        if intent == Intent.INSIGHTS:
            return 30
        return 7

    def _default_recent_limit_for_intent(self, intent: Intent, k: int) -> int:
        if intent == Intent.REFLECTION:
            return 10
        if intent == Intent.INSIGHTS:
            return max(k, 15)
        return k

    def _user_half_life(self, db: Session, user_id: int) -> float:
        settings = (
            db.query(UserSettings.search_half_life_days)
            .filter(UserSettings.user_id == user_id)
            .first()
        )
        if settings and settings[0]:
            return float(settings[0])
        return self._half_life_default

    def _apply_local_llm_cap(self, bundle: ContextBundle) -> ContextBundle:
        """Trim a bundle to LOCAL_LLM_BUNDLE_CAP entries when the user is on a local LLM.

        Trims `recent_window` first (less semantically valuable than MMR-ranked
        related_entries) and only touches related_entries if still over cap.
        Cloud providers pass through untouched.
        """
        if not bundle.is_local_llm:
            return bundle
        total = len(bundle.related_entries) + len(bundle.recent_window)
        if total <= LOCAL_LLM_BUNDLE_CAP:
            return bundle

        budget = LOCAL_LLM_BUNDLE_CAP
        # Always preserve the MMR-ranked related entries up to budget/2 minimum.
        related_keep = min(len(bundle.related_entries), max(budget // 2, budget - len(bundle.recent_window)))
        recent_keep = max(0, budget - related_keep)

        bundle.related_entries = bundle.related_entries[:related_keep]
        bundle.recent_window = bundle.recent_window[:recent_keep]
        bundle.bundle_cap_applied = True
        return bundle

    # ---- cache serialization -------------------------------------------

    def _serialize_for_cache(self, bundle: ContextBundle) -> dict:
        """Convert a bundle to JSON-safe form for Redis.

        IMPORTANT: deliberately strips decrypted `content` and `title` so
        only metadata (IDs, scores, timestamps, mood, tags) lives in
        Redis. See module docstring for the security rationale.
        """
        def _slim(entries: Sequence[EntrySummary]) -> List[dict]:
            return [
                {
                    "id": e.id,
                    "score": e.score,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                    "mood_user": e.mood_user,
                    "mood_inferred": e.mood_inferred,
                    "tags": e.tags,
                }
                for e in entries
            ]

        return {
            "intent": bundle.intent.value,
            "anchor_entry_id": bundle.anchor_entry.id if bundle.anchor_entry else None,
            "related_ids": _slim(bundle.related_entries),
            "recent_ids": _slim(bundle.recent_window),
            "baseline": {
                "entry_count": bundle.user_baseline.entry_count,
                "labeled_mood_count": bundle.user_baseline.labeled_mood_count,
                "mood_user_mean": bundle.user_baseline.mood_user_mean,
                "last_entry_at": (
                    bundle.user_baseline.last_entry_at.isoformat()
                    if bundle.user_baseline.last_entry_at
                    else None
                ),
            },
            "is_local_llm": bundle.is_local_llm,
            "bundle_cap_applied": bundle.bundle_cap_applied,
            "generated_at": bundle.generated_at.isoformat(),
        }

    def _materialize_from_cache(
        self,
        db: Session,
        intent: Intent,
        cached: dict,
        baseline: UserBaseline,
        is_local: bool,
    ) -> Optional[ContextBundle]:
        """Rehydrate a cached bundle by fetching entry rows by ID.

        Returns None if any cached entry has since been deleted/forgotten —
        caller falls back to fresh retrieval to avoid serving a stale bundle.
        """
        try:
            related_meta = cached.get("related_ids") or []
            recent_meta = cached.get("recent_ids") or []
            all_ids = [m["id"] for m in related_meta] + [m["id"] for m in recent_meta]
            anchor_id = cached.get("anchor_entry_id")
            if anchor_id is not None:
                all_ids.append(anchor_id)
            if not all_ids:
                return ContextBundle(
                    cold_start=False,
                    intent=intent,
                    anchor_entry=None,
                    related_entries=[],
                    recent_window=[],
                    mood_examples=[],
                    user_baseline=baseline,
                    cache_hit=True,
                    is_local_llm=is_local,
                    bundle_cap_applied=bool(cached.get("bundle_cap_applied")),
                )

            rows = (
                db.query(Entry)
                .filter(
                    Entry.id.in_(all_ids),
                    Entry.is_deleted == False,  # noqa: E712
                )
                .all()
            )
            by_id = {r.id: r for r in rows}

            # If any cached ID is now missing, treat the cache as stale.
            if len(by_id) < len(set(all_ids)):
                return None

            def _rehydrate(meta_list):
                out = []
                for m in meta_list:
                    row = by_id.get(m["id"])
                    if row is None:
                        continue
                    out.append(_row_to_summary(row, score=m.get("score", 1.0)))
                return out

            anchor_entry = _row_to_summary(by_id[anchor_id]) if anchor_id else None

            return ContextBundle(
                cold_start=False,
                intent=intent,
                anchor_entry=anchor_entry,
                related_entries=_rehydrate(related_meta),
                recent_window=_rehydrate(recent_meta),
                mood_examples=[],  # never cached — content is encrypted at rest
                user_baseline=baseline,
                cache_hit=True,
                is_local_llm=is_local,
                bundle_cap_applied=bool(cached.get("bundle_cap_applied")),
            )
        except Exception:
            logger.warning(
                "ContextService: failed to rehydrate cached bundle",
                exc_info=True,
            )
            return None


# Module-level singleton, mirrors reflection_cache.reflection_cache.
context_service = ContextService()
