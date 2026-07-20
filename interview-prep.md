# EchoVault — Interview Question Bank

A comprehensive, judgment-focused question set built from a deep read of the EchoVault codebase. Each question is paired with an answer outline pointing to the relevant files and the tradeoffs the candidate should articulate.

> **Architecture note (July 2026):** EchoVault **removed pgvector/RAG**. Search is in-process keyword + recency ranking (`api/app/routers/search.py`). AI context is bounded chronological windows via `ContextService` — not embedding retrieval. Questions below that mention `entry_embeddings`, `embedding_job`, IVFFlat, or semantic/RAG pipelines describe the **previous** design unless marked **[current]**. See `docs/ARCHITECTURE.md` for the live system.

---

## 1. System Design & Architecture

### Q1. Walk me through what happens, end to end, the moment a user clicks "Save" on a journal entry. **[current]**
**Outline:** HTTP POST `/entries` → `create_entry` writes the row inside `get_db` session (`api/app/routers/entries.py`) → Celery `enqueue_mood_job` is pushed to Redis → user-wide reflection cache is invalidated (`reflection_cache.delete_reflection`) and the cached reverse prompt is dropped → the JSON entry is returned to the client → React Query's `onSuccess` invalidates `['entries']` and routes to `/entries` (`app/hooks/useEntryMutations.ts`). Background workers later pull the entry and call the user-scoped generation service to infer mood. Per-entry reflection lazily generates on first read of `/entries/{id}/reflection`.

### Q2. Why pgvector instead of a dedicated vector DB like Pinecone, Weaviate, or Qdrant?
**Outline (historical):** EchoVault **used to** store embeddings in Postgres via pgvector for semantic search and RAG. That pipeline was removed in 2026. **[current]** tradeoff for search today: in-process decrypt + keyword match is simpler, privacy-aligned (no derived vectors at rest), and fine for journal-sized corpora — at the cost of no semantic "find related meaning" retrieval. Filters still happen in SQL; ranking happens in Python after decrypt.

### Q3. Why Celery + Redis instead of a lighter task runner like RQ, Dramatiq, ARQ, or even FastAPI BackgroundTasks?
**Outline:** They needed retries with exponential backoff, time/soft-time limits, idempotent IDs, and visibility from Flower-style tooling (`api/app/jobs/embedding_job.py:16-31`). FastAPI BackgroundTasks die with the process and have no retry. ARQ would have been a natural async fit but Celery has more battle-tested operational surface. Worth acknowledging the tradeoff: they then added an entire architectural decision record (`docs/architecture/async-celery-pattern.md`) to justify `asyncio.run()` from sync Celery — they could have sidestepped it with ARQ.

### Q4. Why bother running Ollama locally at all when an API call to OpenAI would be one line?
**Outline:** Privacy is the product. Journal entries are uniquely sensitive. The architecture enforces it: per-user `generation_url` / `embedding_url` (`api/app/models/settings.py`), at-rest Fernet encryption of entry content (`api/app/core/encryption.py`), and an OpenAI-compatible adapter so users opt into a remote provider rather than the system defaulting to one (`api/app/services/llm_service.py:60-127`).

### Q5. What is the single biggest scalability bottleneck in this system today?
**Outline:** Three honest answers: (a) The single Ollama instance — LLM inference is the hot path and there's no provisioning for parallel inference. (b) Worker concurrency is `1` (`infra/docker-compose.yml:127`, `api/app/celery_app.py:41`) — fine for single-user, falls over with N users. (c) IVFFlat index with `lists=100` is tuned for ~10k entries (`api/alembic/versions/002_add_vector_search_indexes.py:25-32`); it'll need re-tuning at scale. Bonus: the DB connection pool is `pool_size=5, max_overflow=10` — fine until it isn't.

### Q6. Sketch how you'd evolve this system to handle 100k users.
**Outline:** Multi-tenant ML inference (vLLM with batching, or per-tier hosted providers), partition `entries`/`entry_embeddings` by `user_id`, switch IVFFlat to HNSW or shard pgvector by user range, scale Celery horizontally with priority queues per task type, move reflection cache from Redis hash to a dedicated cache cluster, push synchronous LLM calls (echo framing, reverse prompt) into Celery to keep API tail latency low, add CDN in front of static Next.js. Prompt: also revisit IVFFlat list count (`sqrt(rows)`).

### Q7. Where in the system is consistency vs availability traded off?
**Outline:** Reflections trade strict consistency for cached availability — you'll happily read a stale 7-day cached reflection (`api/app/services/reflection_cache.py:20`). The retry-failed endpoint deliberately fails OPEN if Redis can't grant a lock (`api/app/routers/entries.py:124-146`) — they'd rather double-enqueue than block the user. The rate limiter's strategy is `fixed-window` over Redis — when Redis is unreachable, `slowapi` lets requests through (`api/app/core/rate_limit.py`).

---

## 2. Backend / API Design

### Q8. Why do you have both an httpOnly cookie AND a Bearer header path in `get_current_user`?
**Outline:** Cookie is the primary path (set by `_set_auth_cookies` in `auth.py:28`), Bearer is a fallback for non-browser API clients and historical compatibility (`api/app/core/dependencies.py:22-26`). Cookie wins when both are present. Allows the same backend to serve the Next.js app, the Tauri build (which uses direct URL not the proxy), and curl/Postman.

### Q9. Why is the WebSocket chat handler using `SessionLocal()` directly inside `get_db_session()` instead of FastAPI's `Depends(get_db)`?
**Outline:** `Depends` is bound to the request lifecycle. A WebSocket lives for an entire conversation — holding one DB session for that whole time would pin a pool connection per connected user and exhaust the pool. Solution: short-lived session per operation via a `@contextmanager` (`api/app/routers/chat.py:93-100`). This is called out explicitly in the file's docstring and the project CLAUDE.md.

### Q10. The chat WebSocket calls `chat_completion_stream` and yields tokens. What happens if the client disconnects mid-stream and how does the code handle it?
**Outline:** `client_gone` flag flips on `WebSocketDisconnect` / `ConnectionClosed` from `send_json`, the loop `break`s, which closes the upstream async generator, which cancels the httpx stream so they "stop billing LLM tokens" (`api/app/routers/chat.py:298-312`). This is a real-money concern with paid providers.

### Q11. Why a one-time WebSocket ticket instead of just passing the JWT in the WS query string?
**Outline:** Browsers can't set headers on `new WebSocket()`, so the obvious fallback is `?token=<jwt>` — but URLs end up in nginx/access logs, browser history, and Referer headers. Solution: cookie-authenticated `GET /auth/ws-ticket` mints a 60s, single-use opaque ticket (`api/app/services/token_store.py:79-110`, `api/app/routers/auth.py:182-186`) which is consumed atomically with a Redis pipeline (GET + DEL).

### Q12. Walk through the access-token / refresh-token flow.
**Outline:** Login sets two httpOnly cookies: a 15-min JWT access token and a 7-day opaque refresh token whose SHA-256 hash is stored in Redis (`auth.py:_set_auth_cookies`, `core/security.py:62-64`). 401 responses on the frontend trigger axios interceptor → `POST /auth/refresh` → server re-validates by hashing the cookie value and looking it up (`auth.py:142-169`). Logout deletes the Redis row and clears cookies. Mention that they hash the refresh token before storing — never store raw bearer secrets.

### Q13. Why are passwords hashed with a SHA-256 pre-step inside `verify_password`?
**Outline:** Bcrypt has a 72-byte input limit and silently truncates. Passwords longer than 72 bytes were once pre-hashed with SHA-256 hex (64 ASCII chars, safely under the limit). New passwords go through bcrypt directly because they're validated to ≤72 bytes at the API layer; the SHA-256 path is purely a backward-compat fallback (`api/app/core/security.py:14-32`). Honest about it being "legacy".

### Q14. Why is `slowapi` configured with `fixed-window` and what does it do when Redis is down?
**Outline:** `fixed-window` is the cheapest counter algorithm — fewer Redis ops than sliding-window-log (`api/app/core/rate_limit.py`). When Redis is unavailable, `slowapi` defaults to allow rather than fail. They also added per-WebSocket rate limiting in-process with a sliding-window deque (`chat.py:_check_rate_limit`) since slowapi only covers HTTP.

### Q15. The `/insights/cron/weekly` endpoint uses `hmac.compare_digest`. Why not just `==`?
**Outline:** Constant-time string comparison prevents remote timing attacks on the secret (`api/app/routers/insights.py:44`). They also enforce a minimum length of 32 chars and 404 (not 401) when the env var is absent so the endpoint's existence isn't leaked.

### Q16. `EncryptedText` is a `TypeDecorator`. What does that buy you over manually calling `encrypt_content` in the model?
**Outline:** Transparent at the ORM layer — every `Entry.content = "..."` write encrypts, every read decrypts (`api/app/core/encryption.py:99-115`). Code that touches `entry.content` is unaware. Critical: `decrypt_content` ONLY unwraps values starting with `encv1:`, so legacy plaintext rows from before encryption was added remain readable — supports zero-downtime migration. Failed decryption raises loudly because silently returning `""` for a journal entry would be indistinguishable from a deliberately empty entry.

### Q17. Why does `forget_entry` zero out the embedding to `[0.0] * 1024` instead of deleting the row?
**Outline:** Foreign key integrity. The embedding may have been referenced by something at some point (cached search results, downstream jobs, retention auditing). But more importantly, the user's intent is "forget", not "destroy" — the soft path also wipes the entry row's content, title, tags, and moods, then sets `is_deleted=True` (`api/app/routers/forget.py:101-114`). Hard delete is gated on `settings.privacy_hard_delete`. Rationale you should articulate: "soft" by default because hard delete is irreversible and a misclick is unrecoverable.

### Q18. In `delete_entry` and `update_entry` you invalidate the user-wide reflection. Why invalidate on update?
**Outline:** Reflections are summaries over the user's last 7 days of entries. If they edit an entry — especially fix a typo or rewrite a passage — the reflection that quoted/themed it should regenerate. Same for delete. Trade-off: more LLM cost for fresher accuracy.

### Q19. The retry-failed endpoint uses Celery's `group(...)` instead of N `.delay()` calls. Why?
**Outline:** One Redis round-trip per group instead of N (`api/app/routers/entries.py:204-207`). At up to 500 entries per call (the cap), that's 500x fewer Redis ops per click. Also surfaces nicely in Celery's monitoring tools.

### Q20. The export endpoint deliberately omits embeddings. What attack does that prevent?
**Outline:** Semantic inference attacks (`api/app/routers/export.py:19-23`). An attacker who has the export plus a suitable embedding model can run nearest-neighbor inference against an arbitrary corpus to deduce themes the user never explicitly wrote down. The embedding is derived data and excluding it costs nothing to the user.

---

## 3. Database & Data Modeling

### Q21. Why is the embedding stored in a separate `entry_embeddings` table instead of as a column on `entries`?
**Outline:** Three reasons: (1) embeddings are derived data with their own lifecycle (regeneration, async population), (2) the soft-delete "forget" workflow needs to flip `is_active=False` and zero the vector independently of the entry row, (3) supports multiple embedding versions per entry if they ever want to re-embed with a new model without losing history. The `is_active` column also lets the IVFFlat index avoid scanning forgotten vectors.

### Q22. Walk me through the IVFFlat index — why `lists=100`, and what's `probes=10` doing?
**Outline:** IVFFlat partitions vectors into `lists` clusters (`alembic/versions/002`). Querying scans `probes` clusters. `lists=100` targets ~10k entries (rule of thumb: `lists ≈ sqrt(rows)`). The default `probes=1` would only scan one cluster — devastating for small datasets where the right answer is in another bucket. They bumped probes to 10 in `database.py:_set_pgvector_probes` to trade some latency for much better recall, matching pgvector's `probes ≈ sqrt(lists)` guidance.

### Q23. There's a non-trivial story behind `SET ivfflat.probes = 10`. Tell me about it.
**Outline:** `SET` (without `LOCAL`) is session-scoped, but SQLAlchemy's pool issues `ROLLBACK` on connection return, which inside an implicit transaction undoes the `SET`. They had to explicitly `commit()` after the SET so the GUC survives the pool's reset (`api/app/database.py:24-32`). Classic "obvious bug discoverable only in production" story.

### Q24. The semantic search query computes similarity AND time decay in SQL. Why not score in Python?
**Outline:** All filtering, scoring, ordering, and limiting happen inside Postgres (`api/app/routers/search.py:54-104`). Pulling all candidate rows back to Python and scoring there would defeat the IVFFlat index, transfer huge vector blobs over the wire, and prevent `LIMIT k` from short-circuiting the work. The decay formula `1 / (1 + age_days / half_life_days)` is a hyperbolic decay, not exponential — gentler tail, monotonic, never zero.

### Q25. Walk through the half-life setting. Why is it user-configurable?
**Outline:** Different journaling cadences want different "memory horizons". Daily writers want recent results to dominate (low half-life, ~7 days); occasional writers want deep history weighted equally (long half-life, ~90 days). `Settings.search_half_life_days` defaults to 30 (`api/app/models/settings.py:12`) and is fetched per-search.

### Q26. You have indexes on `(user_id, created_at DESC) WHERE is_deleted = FALSE` and `(user_id, id) WHERE is_deleted = FALSE`. Aren't these redundant?
**Outline:** No — different access patterns. The first serves chronological listing (the `/entries` list endpoint), the second serves random-access by ID with the user filter. Both are partial indexes excluding soft-deleted rows so the index stays small (`alembic/versions/002`). Mention partial index size win — soft-deleted entries are still in the table but don't bloat the index.

### Q27. The `tags` column uses GIN with `jsonb_path_ops`. Why that op class specifically?
**Outline:** `jsonb_path_ops` is smaller and faster than the default `jsonb_ops` for the only operator they use: containment (`@>`). Tradeoff: it doesn't support key existence (`?`) queries, which they don't need (`alembic/versions/002`).

### Q28. Why is there a unique index on `settings.user_id`? Couldn't you just use a `UNIQUE` constraint?
**Outline:** A `UniqueConstraint` *is* implemented as a unique index in Postgres. Migration 009 adds it explicitly to be sure it exists across environments where the original migration may have set it up differently. Settings is one-row-per-user; this enforces it at the DB level rather than relying on application code to be careful.

### Q29. How would your schema break if mxbai-embed-large were swapped for a 1536-dim model like text-embedding-3-small?
**Outline:** The `Vector(1024)` column type is a fixed dimension — you'd need a migration to alter the column, and the IVFFlat index would have to be rebuilt. The soft-delete code zeros to `[0.0] * embedding_dim` (`config.py:78`), so that constant is centralized. Worth noting: mixed-dimension embeddings can't coexist in the same column — you'd need a transition with two columns or a "version" column on `entry_embeddings`.

### Q30. Why is content `Text` rather than versioned/append-only history? What's the tradeoff?
**Outline:** Simpler model, lower storage, but no edit history — once you update an entry you've lost what was there. For a privacy app this is arguably correct (no surveilled past versions) but it's worth naming as an explicit tradeoff. The `updated_at` column at least reveals that an edit happened.

---

## 4. AI / LLM Integration & Context (formerly RAG)

### Q31. Walk me through how chat WebSocket assembles context. **[current]**
**Outline:** Per user message: (1) `ContextService.get_context` with `Intent.CHAT` loads a bounded window of recent entries (and optional anchor entry) — no embedding step (`api/app/routers/chat.py`, `api/app/services/context_service.py`), (2) related entries are formatted into the system prompt along with the cached reflection, (3) prepend system prompt to the last 10 conversation turns, (4) stream tokens back to the client. When `entry_id` is set, context is pinned to that single entry.

### Q32. Why use `input_type="query"` vs `input_type="document"` and how is that handled?
**Outline:** Voyage AI's retrieval-tuned models perform better when embeddings know whether they're indexing a document or formulating a query — asymmetric embedding space. The code forwards `input_type` ONLY when the URL hostname matches `voyageai.com` (parsed via `urlparse`, not substring, to avoid `voyageai.com.evil.tld` spoofing) and silently drops it elsewhere with a one-shot warning log (`api/app/services/llm_service.py:144-163`).

### Q33. Why is a fresh `httpx.AsyncClient` created per request?
**Outline:** Documented in `api/app/services/llm_service.py:110-128`: avoids "Event loop is closed" errors when invoked from `asyncio.run()` inside a Celery worker. The client carries an event loop; if the task ends and the loop is destroyed, a stashed long-lived client breaks. Cost is ~1ms vs LLM inference of 5-30s — negligible. The same pattern is reaffirmed in the `async-celery-pattern.md` ADR.

### Q34. Mood inference uses a JSON-only system prompt. Walk through the parsing strategy when the model misbehaves.
**Outline:** Three-strategy waterfall in `_parse_mood_response` (`llm_service.py:351-403`): (1) regex-extract a JSON object and parse, (2) regex-find the first integer 1-5, (3) word-to-number mapping ("three" → 3). Falls through to neutral (3) if all fail. Then clamps to [1,5] regardless. Logs a hash of the response (not the response itself — privacy) when confidence is low. Worth saying: this defends against local models that ignore JSON instructions.

### Q35. You log a hash of the LLM response, not the response itself. Why?
**Outline:** Journal content can leak through into LLM output (it's the input). Logging the response into stdout / log aggregator could dump user PII. Hashing gives them a deduplication key for debugging without leaking content (`llm_service.py:393-401`).

### Q36. Tell me about the "echo framing" feature — why does it exist as a server-rendered concept? **[current]**
**Outline:** Echoes are tag-related (or recent-fallback) entries to the one you're reading (`_rank_related_entries` in `api/app/routers/entries.py`). The framing is a 2-3 sentence LLM observation about what links the current entry to the past ones (`llm_service.py:generate_echo_framing`). Cached for 7 days per (user, entry) in Redis to avoid re-prompting the LLM on every page view (`reflection_cache.set_cached_echoes`). Returns `status="empty"` when there are no other entries.

### Q37. The "reverse prompt" feature mines the corpus for things "REFERENCED but not EXPLORED". How does the prompt enforce that constraint?
**Outline:** The system prompt in `generate_reverse_prompt` (`llm_service.py:521-549`) explicitly instructs the model to find a gap that was REFERENCED but not EXPLORED, with examples ("your brother Mark" beats "family"), bans "why haven't you" phrasing, and demands JSON output. Cached 24h per user, invalidated on new entry creation. Honest about LLM compliance: there's a defensive `_parse_reverse_prompt_response` with fallbacks.

### Q38. The system has both a user-wide weekly reflection AND a per-entry reflection. Why two?
**Outline:** Different mental modes. The weekly is a "what's been on your mind lately" summary across the last 7 days, intended as ambient context (cached in Redis, `reflection_job.py:generate_reflection_task`). The per-entry reflection is "what does this single entry say" — stored on the entry row itself (`Entry.reflection`, `Entry.reflection_status`) so it persists across visits without sharing the user-wide cache.

### Q39. Why does temperature vary across endpoints — 0.3 for mood, 0.7 for reflection, 0.8 for welcome-back?
**Outline:** Mood inference needs deterministic structured output → low temp. Reflection wants empathetic natural language → mid temp. Welcome-back wants a warm, fresh, slightly varied greeting each login → high temp. Mention this is a real engineering decision, not arbitrary.

### Q40. How is prompt injection mitigated? A user could write "ignore previous instructions and ..." in their journal.
**Outline:** Honest answer: not robustly. The journal content goes straight into the system prompt body (`chat.py:CHAT_SYSTEM_PROMPT_ENTRY`), so a malicious entry can attempt to manipulate the LLM. Mitigations in place: (a) the chat is a private companion with no privileged tools — there's nothing to exfiltrate via prompt injection, (b) input length caps (50k chars per entry, 4k chars for pinned entry context, 2k char user messages), (c) per-connection rate limit. The threat model is single-user, so the user is essentially the attacker against themselves.

### Q41. The system context window is bounded at "last 10 messages" + truncated entry content. Why both?
**Outline:** Token budget. Some local models have 4k or 8k context. `conversation_history[-10:]` keeps the dialog window bounded (`chat.py:296`); `_MAX_PINNED_ENTRY_CHARS = 4000` caps a single pinned entry. The `extract_common_theme` truncates each input entry to 500 chars and limits to 10 entries (`llm_service.py:601-606`). Predictable token usage matters because the user is paying for tokens with hosted providers.

### Q42. How does the system avoid burning LLM tokens on repeated semantic mood-content analysis?
**Outline:** It mostly doesn't — `/insights/mood-content` makes 1-2 LLM calls per request (`extract_common_theme` for high-mood and low-mood clusters). The mitigation is a `MIN_ENTRIES = 10` and `MIN_CLUSTER_SIZE = 3` gate so the call only happens when there's signal (`api/app/routers/insights.py:75-167`). The endpoint is not currently cached in Redis — that would be a reasonable improvement to mention.

---

## 5. Frontend / Next.js

### Q43. Why React Query for server state and Zustand-like stores for client state — what goes where?
**Outline:** React Query owns anything that originates on the server: entries list, single entry, settings, insights, echoes (`app/hooks/useEntries.ts`, `useSettings.ts`). Local UI state and ephemeral state — chat streaming buffers, command palette open/close (`app/lib/commandPaletteStore.ts`), theme — live in React state or simple stores. Rule of thumb: if the answer can change because someone else (or a Celery worker) changed it, it's React Query.

### Q44. The `useEchoes` hook used to poll when embeddings were pending. What changed? **[current]**
**Outline:** Echoes no longer depend on an embedding job — related entries are computed synchronously from tags/recency. The hook fetches once via React Query (`app/hooks/useEntries.ts`); there is no `pending` embedding state. Historical note: polling existed when echoes waited on `entry_embeddings` population.

### Q45. The reflection endpoint uses SSE while chat uses WebSocket. Why two transports?
**Outline:** Chat is bi-directional and stateful (conversation history per connection), perfect for WebSocket. Reflection is a server-pushed status stream — read-only, no client→server messages mid-stream — so SSE is the cheaper fit (`api/app/routers/reflections.py:80-148`, `app/hooks/useReflection.ts`). SSE auto-reconnects natively in `EventSource`, can be cookie-authed without a custom protocol, and survives most middleboxes more cleanly than WS. The hook also disconnects on `visibilitychange` (tab hidden) — saves Redis ops.

### Q46. Walk me through what `useReflection` does to "reduce Redis operations by ~70%".
**Outline:** (a) Closes the SSE on tab hide, reopens on visible (`useReflection.ts:130-146`). (b) Uses `queueMicrotask` to defer connect/close so they don't trigger cascading renders. (c) Closes immediately when status reaches a terminal state. The reflection cache then has its own cached `ping()` result for 30s (`reflection_cache.py:48-69`) to avoid health-check ping storms.

### Q47. What does `withCredentials: true` actually do in the axios + EventSource clients, and why is it required?
**Outline:** It tells the browser to attach cookies on cross-origin requests. EchoVault's httpOnly auth cookie can't be read or attached by JS — it's only sent automatically when `withCredentials` is set. Combined with `Access-Control-Allow-Credentials: true` server-side and the Vercel proxy rewrites making `/api/*` same-origin, this is what makes cookie-based auth work in production (`app/lib/api.ts:12-14`).

### Q48. The Next.js config rewrites `/api/*` to the backend. Why not just hit the backend URL directly from the browser?
**Outline:** Cross-origin cookie restrictions. Browsers won't accept `Set-Cookie` from `api.example.com` when the page is `app.example.com` unless cookies are `SameSite=None; Secure` AND the origin policies align — it's brittle. Proxying through Next means cookies are first-party to the page origin (`app/next.config.js:16-28`). The Tauri build skips the proxy because there's no Next server in a static export, so it falls back to the direct `NEXT_PUBLIC_API_URL` (`app/lib/api.ts:6-8`). This was apparently a real bug, given the memory note "cross-origin cookie fix via Vercel proxy".

### Q49. Why is there middleware AND a `ProtectedRoute` component? Doesn't the middleware already gate access?
**Outline:** `middleware.ts` checks for the cookie's *presence* server-side at the edge — it can't validate the JWT (no secret available there) or verify the user is still active. Useful as a fast redirect for unauthenticated users. `ProtectedRoute` (and the `useAuth` flow that follows) does a real `/auth/me` check against the backend, handling expired tokens via the refresh interceptor. Belt-and-braces.

### Q50. The chat hook reconnects with exponential backoff up to 5 attempts. What guarantees no infinite reconnect storm?
**Outline:** `shouldReconnectRef.current = false` is set on close codes 4001/4002 (auth failed / user not found) so the loop bails on permanent errors (`useChat.ts:211-220`). Counter caps at `maxReconnectAttempts`. Delay is `Math.min(reconnectBaseDelay * 2^attempts, 30000)` — caps at 30s. Closes 1000 and 1001 (normal / going away) skip reconnect entirely. Mention `mountedRef` guard prevents setState on unmounted component.

### Q51. The QueryClient has `refetchOnWindowFocus: false` and `staleTime: 5 * 60 * 1000`. Why these defaults?
**Outline:** `refetchOnWindowFocus: false` because the data here is journal content — it doesn't change behind the user's back, and refetching every focus would pound the API (`app/app/providers.tsx:18-25`). 5min staleTime + 10min gcTime balances freshness with API cost. Mutations explicitly invalidate the relevant query keys, so user-triggered changes still propagate immediately.

### Q52. Why is the auth token not stored in localStorage anymore? What changed?
**Outline:** Earlier architecture stored JWT in localStorage (per the project CLAUDE.md description) but the code now uses httpOnly cookies exclusively — `AuthContext.tsx` doesn't touch localStorage, the axios client just does `withCredentials: true`, and middleware reads `request.cookies.get('access_token')`. httpOnly is XSS-resistant; localStorage is readable by any script that runs on the page. CLAUDE.md is stale on this point — be ready to flag it.

---

## 6. Security & Privacy

### Q53. List every layer of defense against an attacker who has gotten read access to your Postgres. **[current]**
**Outline:** (1) Entry content + title encrypted at rest with Fernet AES-128 / HMAC-SHA-256 (`api/app/core/encryption.py`). (2) LLM provider API tokens encrypted with the same key (`enc:` prefix). (3) Refresh tokens stored as SHA-256 hashes in Redis, never raw. (4) Passwords bcrypt-hashed. The encryption key MUST be set in production (validator in `core/config.py`). Historical note: embedding vectors were previously stored plaintext for pgvector; that table was dropped in migration 013.

### Q54. Why use Fernet instead of writing your own AES wrapper?
**Outline:** Fernet is a vetted authenticated encryption recipe — AES-128-CBC + HMAC-SHA-256 + timestamp, with versioning, base64 encoding, and key rotation primitives. Rolling your own is the easy way to introduce a padding oracle or IV reuse bug. Tradeoff: Fernet has no native key rotation across many rows — if they ever rotate the key, they need a re-encryption job.

### Q55. The encryption key is in an env var. What's the disaster scenario?
**Outline:** Lose the key → all encrypted entries unrecoverable, by design (`core/config.py:54-58`). Documented in `default.env` and the model file. They should be backing up the key out-of-band (password manager, cloud secret store with versioning). Tradeoff conversation: you can't have at-rest encryption that you can also recover when the key is lost — that's the whole point.

### Q56. The cookies are `SameSite=lax`. Why not `Strict`? Why not `None`?
**Outline:** `Strict` would break top-level cross-site navigation (e.g., clicking a link from email won't carry the cookie — first request after redirect is logged out). `None` requires `Secure` AND cross-site requests would carry credentials, raising CSRF risk. `Lax` is the modern default — sent on top-level GETs, not on cross-site POSTs (`api/app/core/config.py:51-52`).

### Q57. CSRF — what's the protection model here?
**Outline:** SameSite=Lax + httpOnly cookies covers the common cross-site form-submission CSRF. State-changing endpoints are POST/PUT/DELETE which Lax blocks from cross-site origins. The Vercel proxy makes the request same-origin so explicit CSRF tokens aren't required. If they exposed an SVG/HTML body that could be served from a third party, GET-only state changes would be a concern — they don't.

### Q58. Tell me about the path-traversal protection in the forget endpoint.
**Outline:** `_safe_delete_file` resolves the upload path AND the requested path, then checks `target.is_relative_to(upload_base)` (`api/app/routers/forget.py:21-58`). `resolve()` follows symlinks so a symlink escape gets caught. Refuses to delete the upload directory itself (`target == upload_base`). Logs "Path traversal attempt blocked" rather than silently doing nothing.

### Q59. The prompt-interaction endpoint validates that referenced `entry_id` and `source_entry_id` belong to the current user. Why does that matter?
**Outline:** IDOR (Insecure Direct Object Reference). Without that check, a user could log a prompt interaction tagged with another user's entry ID and pollute that user's stats / completion-rate calculations. The single COUNT query covers both IDs at once (`api/app/routers/prompts.py:50-60`).

### Q60. What's in DB logs that could be a privacy issue and how is it mitigated?
**Outline:** The DATABASE_URL contains credentials. `_safe_db_url_summary` and `_scrub_creds` strip the userinfo before any URL is logged (`api/main.py:32-49`). Health-check failure logs are rate-limited to once per 60s per check to prevent log flooding during outages (`main.py:60-67`). Email is logged as the first 8 chars of the SHA-256 hash, never the email itself (`auth.py:67`).

### Q61. If a user logs out from one browser, what happens to their session in another browser?
**Outline:** Logout revokes the refresh token in Redis (`auth.py:172-179`). Other browsers' access tokens remain valid for up to 15 minutes (the access token TTL), but their refresh attempt will fail and bounce them to login. This is by design — true global logout would require a token denylist or per-session JWT IDs, which adds complexity.

---

## 7. Performance & Scalability

### Q62. The Redis client is configured with `max_connections=3`. Why so low?
**Outline:** Free-tier Redis (Upstash) has tight connection limits per plan (`reflection_cache.py:31-44`). The token store reuses the same module-level singleton client. If they spawned a new pool per service, they'd burn the connection budget on idle sockets. Tradeoff: under heavy concurrency, requests will queue waiting for a connection — fine for this app's traffic shape.

### Q63. Walk through every Redis-cost optimization in the Celery config.
**Outline:** From `api/app/celery_app.py`: (1) No result backend — `ignore_result=True` everywhere kills 30-50% of Redis ops from result polling. (2) `task_send_sent_event=False`, `worker_send_task_events=False` — no event traffic. (3) `socket_timeout=300` so workers BRPOP-block for 5 min instead of reconnecting. (4) `broker_pool_limit=1` — one broker connection. (5) `broker_heartbeat=300` — 5min keep-alive instead of seconds. (6) `worker_prefetch_multiplier=1` — no speculative reservation. The ping in `reflection_cache.ping()` is also cached for 30s.

### Q64. Why are reflections cached in Redis instead of stored in Postgres?
**Outline:** They're regenerated frequently (every entry create/update/delete invalidates), have a natural 7-day TTL, and "stale is OK" semantics. Postgres would need a row + a TTL column + a janitor job to clean it up. Redis's built-in TTL is the right tool. Per-entry reflections, which do persist, *do* live in Postgres because they're permanent per-entry artifacts.

### Q65. The reflection status update is a Lua script. Why?
**Outline:** Atomic GET + decode + re-encode + SETEX in one round-trip (`reflection_cache.py:set_status:111-122`). Without Lua it would be two ops with a race window between them. Comment says "reduces Redis operations by 50%" — accurate.

### Q66. What's the consequence of `worker_concurrency=1` and how would you change it for multi-user?
**Outline:** Tasks for different users serialize through a single worker. Embedding job for user A blocks mood job for user B. For a single-user privacy-app deployment, this is fine and minimizes Redis ops. For multi-tenant, bump concurrency or run multiple worker processes — but be careful: every worker is another Redis connection, another DB pool. Mention `CELERY_WORKER_CONCURRENCY` env override exists.

### Q67. The IVFFlat index will degrade as the dataset grows past 10k entries. What's the migration plan?
**Outline:** Two paths: (a) `REINDEX` with `lists = sqrt(rows)` periodically, or (b) move to HNSW (supported in pgvector 0.5+) which is more accurate at the cost of build time and memory. HNSW also supports incremental insert better. Reindexing locks the table — would need to use `CREATE INDEX CONCURRENTLY` and swap.

### Q68. Why is `pool_recycle=300` on the database engine?
**Outline:** Many managed Postgres providers and PgBouncer setups close idle connections after a few minutes. `pool_pre_ping=True` catches dead connections (cheap SELECT 1) and `pool_recycle=300` proactively rotates connections every 5 min so we never hand a stale socket to a request (`api/app/database.py:7-14`).

### Q69. What's the worst case latency on `POST /entries`?
**Outline:** Bound by: Pydantic validate, INSERT round-trip, two `delay()` calls to Redis (broker), one `delete_reflection` Redis op, one `invalidate_reverse_prompt` Redis op. Probably <50ms p99 with healthy Redis/Postgres. Embedding/mood inference happen async — the user doesn't wait. The "echoes" feature, in contrast, *is* synchronous to the request and burns an LLM call when the cache misses — that's a worst-case multi-second latency the candidate should call out.

### Q70. Where can a slow LLM stall the API itself (vs background work)?
**Outline:** Synchronous LLM endpoints: (a) `/entries/{id}/echoes` (`get_echo_framing`), (b) `/insights/mood-content` (`extract_common_theme`), (c) `/prompts/suggestions`, (d) `/prompts/reverse`, (e) `/prompts/welcome-back`, (f) the chat WebSocket handlers. All would benefit from being moved to Celery or behind a cache. The chat case is intentional because streaming is the UX. The others are arguably bugs waiting to happen if Ollama hangs.

---

## 8. DevOps / Infrastructure

### Q71. The Dockerfile.api command is `alembic upgrade head && uvicorn ...`. Why not skip the migration on every boot?
**Outline:** Idempotent — `alembic upgrade head` is a no-op when DB is current. Guarantees that whatever pod boots is at the schema version it expects. The CLAUDE.md note explains schema is *exclusively* managed by Alembic — `Base.metadata.create_all()` is intentionally removed to prevent silent schema drift between models and DB.

### Q72. There are two health endpoints — `/health` and `/health/full`. Why?
**Outline:** Railway/Render hit health endpoints every 10-30s. A full check that pings Redis on each call would burn the free-tier Redis quota in operations (`api/main.py:130-184`). `/health` is DB-only (cheap), `/health/full` includes Redis (use sparingly). They also rate-limit the failure logging itself with `_should_log_health_failure` to once per minute per check — prevents log bloat during outages.

### Q73. Why pin Ollama to a specific Docker digest rather than `:latest`?
**Outline:** Reproducibility (`infra/docker-compose.yml:62`). `latest` is mutable — yesterday's `latest` is not today's `latest`. A digest pin guarantees the exact image bytes. Ollama in particular ships breaking changes to the API surface; a silent upgrade could break embedding/generation calls.

### Q74. The web service has `depends_on: api` but the API has `depends_on: db: condition: service_healthy`. Why the difference?
**Outline:** Postgres takes time to be ready for connections — a healthcheck-gated dependency prevents the API from booting and immediately failing. The web service just needs the API container to exist for the proxy URL to resolve at startup; the actual API readiness is handled by the API's own retry logic. `condition: service_healthy` for every dependency is conservative; the web doesn't strictly need it.

### Q75. Why use external cron for weekly insights instead of Celery Beat?
**Outline:** Celery Beat is another process to run, persists schedule state in its own scheduler DB, and can have bizarre failure modes (clock drift, missed ticks on restart). Calling `POST /insights/cron/weekly` from a known-reliable cron (system cron, GitHub Actions, fly machines schedule) with an HMAC-protected secret is simpler, observable, and easier to test (`api/app/routers/insights.py:27-48`). Mentioned explicitly in CLAUDE.md.

### Q76. Walk through how the docker-compose `x-common-env` pattern helps.
**Outline:** YAML anchors and aliases — `x-common-env: &common-env` defines a block once, `*common-env` includes it (`infra/docker-compose.yml:4-17`). Avoids drift between API and worker containers' environments. `x-api-worker-env` extends with `<<: *common-env` and adds upload-specific vars. Pure DRY for compose files.

### Q77. Why is `uploads_data` a named volume mounted to both API and worker?
**Outline:** Uploaded attachments need to be readable by both the API (serving downloads) and the worker (e.g., extracting text for embedding) — a shared persistent volume makes this work without coordinating file paths over the network. The forget endpoint also needs to delete from this directory (`api/app/routers/forget.py`).

---

## 9. Tradeoffs & Decisions

### Q78. You chose HTTP polling for echoes-when-pending instead of WebSocket / SSE. Why?
**Outline:** Cost-of-complexity. The pending window is seconds, not minutes. Adding a streaming transport just for "is your embedding ready" requires server state, an auth path, reconnection, and tear-down. Polling at 5s is one extra GET — already cheap, REST-cacheable, and stops itself. The chat *did* warrant a WebSocket because of bidirectional streaming.

### Q79. Why HTTP polling for the `/reflections` endpoint AND an SSE `/reflections/stream` endpoint?
**Outline:** The `/reflections` GET is the simple path — fetch current state, lazily kick off generation if missing. The SSE stream is the optimization — push status changes without polling. Frontend prefers SSE, but a non-browser client could fall back to polling the GET. The CLAUDE.md note "HTTP polling pattern" describes the GET path; the SSE was a later optimization.

### Q80. Why a fresh httpx client per request to the LLM provider — doesn't that throw away connection pooling?
**Outline:** Already covered in Q33. Tradeoff articulation: a long-lived client would reuse keep-alive connections (saves ~50-100ms TLS handshake). A per-request client breaks that but eliminates a class of "Event loop closed" bugs in mixed sync/async Celery contexts. With LLM inference dominating at multiple seconds, the pooling savings are noise. They acknowledge this in `llm_service.py:110-128`.

### Q81. The `Settings` model has both `ollama_url` (legacy) and `generation_url`/`embedding_url`. Why hasn't the legacy column been removed?
**Outline:** Migration cost + backward compat risk. The model file has a TODO comment to remove via migration (`api/app/models/settings.py:15`). Migration 006 already migrated existing `ollama_url` values into both new fields. Removing the column is a future cleanup that requires verifying no code paths still touch it.

### Q82. Why is reflection regeneration rate-limited but not normal reflection fetching?
**Outline:** Fetching is read-only and cache-served; regeneration triggers an LLM call on demand. Without `5/minute` rate-limiting (`api/app/routers/reflections.py:42`), a user could spam regenerate and burn LLM budget / API credits. Same logic for `regenerate_entry_reflection`, `retry-failed`, the prompts endpoints.

### Q83. The chat WebSocket is one global connection per user, not one per entry. Why?
**Outline:** Connection cost. WebSockets pin a worker thread / async task in the API server. One per entry would multiply that. The single connection takes an optional `entry_id` query param to pin context, and the server keeps the conversation history per-connection. Drawback: if you have multiple entries open in tabs, they share state — but the UI flow doesn't expose that.

### Q84. Why don't you persist chat conversations server-side?
**Outline:** Privacy default — conversations live in the WebSocket process memory only and die when the connection closes. The user can re-open a fresh chat anytime. Persistent chat would need encryption-at-rest, retention policy, history pagination, deletion semantics — substantial product surface. Trade: lose history on disconnect.

### Q85. The "soft forget" wipes content but keeps the entry row. Wouldn't users expect their data to be *gone*?
**Outline:** Two reads: (a) "forget from search and view" vs (b) "wipe from disk". The settings model exposes a `privacy_hard_delete` flag (`models/settings.py:13`) that lets the user opt into the latter. Default is soft to prevent accidental data loss. The forget endpoint zeros the embedding, nulls the content/title, but leaves the row so foreign key references stay sane (`api/app/routers/forget.py:101-114`). They could / should make this very visible in the UI.

### Q86. Why are mood values mood_user and mood_inferred separate columns?
**Outline:** Distinguishes ground truth (user said it) from prediction (LLM inferred). The semantic-mood-insights endpoint prefers `mood_user` and falls back to `mood_inferred` (`insights.py:107`). Lets the system improve over time — if the user starts disagreeing with inferred moods, you can train against that. Also lets you build "you said happy but the entry sounds sad" features.

### Q87. The reflection prompt says "Keep the reflection under 250 words". Why not enforce this with `max_tokens`?
**Outline:** Soft prompt constraints get the LLM to write in a length-aware style (terser paragraphs, fewer sub-points). Hard `max_tokens` cuts mid-sentence. Both could be combined — the prompt for shape, max_tokens as a guard. They've left max_tokens unset on `chat_completion` calls in most paths, accepting whatever the model produces. Reasonable for a single user; risky for paid providers at scale.

---

## 10. Curveballs / "Tell me about a hard problem"

### Q88. Tell me about a non-obvious bug you fixed.
**Outline:** Pick any of: (a) The pgvector `SET ivfflat.probes = 10` SQLAlchemy pool reset bug — `SET` was getting rolled back when the connection returned to the pool, requiring an explicit `commit()` (`api/app/database.py:24-32`). (b) The cross-origin cookie failure that drove the entire Vercel proxy rewrite (memory note `project_cross_origin_cookie_fix.md`). (c) The Voyage hostname-vs-substring detection — `voyageai.com` substring matching would let `voyageai.com.evil.tld` get treated as Voyage. (d) Bcrypt's silent 72-byte truncation requiring SHA-256 pre-hashing.

### Q89. What's a part of this codebase you'd refactor today if you had a week?
**Outline:** Honest answers to choose from: (a) Unify the synchronous LLM-calling endpoints (echoes, reverse prompt, welcome back, mood-content insights) into a consistent "lazy + cache + background-fill" pattern instead of the ad-hoc mix today. (b) Remove the legacy `ollama_url` column with a migration and clean up the dual codepath. (c) Make per-entry reflections use the same Redis pattern as user-wide reflections rather than an Entry column with status tracking. (d) Move the WebSocket history into Redis so users can resume after a reload. (e) Add a content-versioning model so entry edits don't destroy history.

### Q90. Suppose the LLM provider returns garbage for mood five times in a row. What does the system do?
**Outline:** Each call goes through `_parse_mood_response` with three fallback strategies, ultimately returning 3 (neutral) and clamping. The Celery task itself doesn't retry on parse failure (only on httpx/connection errors). So the user gets neutral moods. To improve: track confidence and surface "we couldn't analyze your mood — set it manually" in the UI.

### Q91. What happens if the encryption key is rotated mid-flight (someone changed `ENCRYPTION_KEY` and restarted)?
**Outline:** All previously-stored ciphertext becomes undecryptable. Tokens return `""` from `decrypt_token` (which then fails with auth error against the LLM provider — by design, "fail with auth error, not a data leak"). Entry content raises `ContentDecryptionError` which propagates as a 500. Mitigation: never rotate without a re-encryption migration. The Fernet recipe doesn't natively support multi-key, so you'd have to write the migration yourself.

### Q92. Walk me through what "fails open vs fails closed" decisions were made and why.
**Outline:** (1) Retry-failed lock acquisition fails OPEN — better to double-enqueue than block the user (`entries.py:124-146`). (2) Rate limiter fails OPEN when Redis is down — bad UX to block valid users on infra outage. (3) Encryption fails CLOSED for content (raises) but OPEN-ish for API tokens (returns empty so the call fails noisily). (4) WebSocket auth fails CLOSED — wrong ticket, no connection. The pattern: privacy/security primitives fail closed, performance/reliability primitives fail open.

### Q93. Imagine a malicious user posts 10 MB of zalgo text in `entry.content`. What blocks them?
**Outline:** Pydantic validator caps content at 50,000 chars in `EntryCreate` (`api/app/schemas/entry.py`). Tags capped at 20 with 50-char limit each. Title capped at 500. Below the schema, the embedding job has a 120-second time limit and the LLM provider has its own input size limits. Above the schema, FastAPI's default body size limit applies.

### Q94. What's the worst data-loss scenario in this system and how would you mitigate it?
**Outline:** Losing the encryption key with backups containing only ciphertext = total content loss for all users. Mitigations: (a) multiple key copies in different secret stores, (b) optional unencrypted "recovery export" the user can download themselves, (c) Fernet supports multi-key rotation at the recipe level if you write the wrapper. Lesser scenarios: hard-delete is irreversible by definition; no entry edit history.

### Q95. The frontend has a 5-minute `staleTime` on React Query but the user can update an entry from another browser. How do they see the update?
**Outline:** They don't, until either: (a) staleTime expires and they re-focus the page (but `refetchOnWindowFocus: false` is set, so even that won't trigger), (b) they manually navigate, or (c) some mutation invalidates the query. There's no real-time invalidation across sessions. Trade-off they accepted because the app is a journal — nobody else is editing your entries. If it became multi-device for the same user editing simultaneously, you'd want a Pusher / WebSocket invalidation channel or shorter staleTime.

### Q96. If you had to add full-text keyword search alongside semantic search, how would you do it?
**Outline:** Postgres native: add a `tsvector` generated column on `entries.content`, GIN-index it, accept `ts_query` in the search request, blend with the semantic score (e.g. `0.6 * cosine + 0.3 * decay + 0.1 * bm25`). pgvector + tsvector co-exist nicely. No new service required. The blending weights would benefit from being user-configurable like `search_half_life_days`.

### Q97. Why do most async Celery tasks log `extra={"user_id": ...}` rather than including it in the message string?
**Outline:** Structured logging. Log aggregators (Loki, Datadog, CloudWatch) can index and filter on the structured fields. String interpolation forces grep-style queries. This is a small thing but reflects a serious operational mindset.

### Q98. The chat handler has `_MAX_MESSAGES_PER_MINUTE = 10` enforced via a `deque` of timestamps. Why a deque?
**Outline:** O(1) `popleft` to evict expired timestamps from the front, O(1) `append` to add the new one (`api/app/routers/chat.py:40-54`). A list would be O(n) on `pop(0)`. Sliding window — at any given moment the deque contains exactly the timestamps from the last 60 seconds. Compared to a fixed-window counter, this is more accurate at window boundaries.

### Q99. You said local Ollama "by default". What's the actual default endpoint and how does the user override it?
**Outline:** `default_generation_url = "http://ollama:11434"` and same for embedding (`api/app/core/config.py:71-74`) — points at the docker-compose `ollama` service. User overrides via the Settings UI which writes to `Settings.generation_url` / `embedding_url`. Per-request, `get_generation_service_for_user` and `get_embedding_service_for_user` resolve the user's setting falling back to the server default (`llm_service.py:660-695`). API tokens are decrypted lazily on use.

### Q100. If I asked you to walk me through the failure modes when the user's chosen LLM provider is misconfigured, what would you say?
**Outline:** (1) Wrong URL: `httpx.HTTPError` / `ConnectError` → caught by Celery autoretry up to 3 times with exponential backoff. (2) Wrong API key: `LLMProviderError(status_code=401)` raised, body snippet logged. (3) Wrong model name: 404 from the provider, same `LLMProviderError` path. (4) Provider down: timeout (read=300s) eventually raises, gets retried. (5) Embedding endpoint returns wrong dimension: pgvector insert fails with a SQL error, propagates. The retry-failed endpoint exists specifically to recover from "user fixed their settings, now re-process the orphaned entries" (`entries.py:retry_failed_entries`).

---

## Bonus Wildcard Questions

### Q101. If you could only keep three architectural decisions and throw the rest away, which three?
**Outline:** Personal answer, but defensible picks: (a) at-rest encryption — irreversible decision that defines the privacy posture, (b) pgvector inside Postgres — keeps the architecture small, (c) OpenAI-compatible LLM adapter — makes provider choice a config knob, not a code change.

### Q102. You're walking into Day 1 of a startup that's going to scale this to 100k DAU. What's the first thing you change?
**Outline:** Move all synchronous LLM-touching endpoints (echoes, reverse prompt, mood-content) behind a queue with cached responses. Then partition pgvector by `user_id` and switch to HNSW. Then split chat WebSocket onto its own service so a slow LLM provider doesn't starve the API. Then introduce per-tenant LLM concurrency limits so one user can't drown out others.

### Q103. What's the most controversial line of code in this repo and why is it correct anyway?
**Outline:** Defensible candidate: `embedding.embedding = [0.0] * app_settings.embedding_dim` in soft-forget — many devs would argue you should just delete the row. But the row keeps referential integrity for any cached references and the zero vector explicitly makes it un-findable in cosine-distance search (cosine of zero vector is undefined / falls out as the worst match in pgvector's IVFFlat). It's a clever, intentional cryptographic-style erasure that preserves database invariants.

---

## Files Referenced (absolute paths)

**Backend core**
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/main.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/celery_app.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/database.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/core/config.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/core/security.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/core/dependencies.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/core/encryption.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/core/rate_limit.py

**Routers**
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/auth.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/entries.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/search.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/chat.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/reflections.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/insights.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/prompts.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/settings.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/forget.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/routers/export.py

**Services & jobs**
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/services/llm_service.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/services/reflection_cache.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/services/token_store.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/jobs/embedding_job.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/jobs/mood_job.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/jobs/reflection_job.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/jobs/insights_job.py

**Models & migrations**
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/models/entry.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/models/embedding.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/models/settings.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/models/user.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/models/insight.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/app/models/prompt_interaction.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/alembic/versions/001_initial_migration.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/alembic/versions/002_add_vector_search_indexes.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/alembic/versions/006_add_llm_settings.py
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/api/alembic/versions/009_add_missing_indexes.py

**Frontend**
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/lib/api.ts
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/contexts/AuthContext.tsx
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/middleware.ts
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/next.config.js
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/app/providers.tsx
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/hooks/useChat.ts
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/hooks/useReflection.ts
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/hooks/useEntries.ts
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/hooks/useEntryMutations.ts
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/hooks/useSettings.ts
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/app/components/OnboardingModal.tsx

**Infrastructure & docs**
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/infra/docker-compose.yml
- /Users/aryankumar/Documents/personal-projects/Echo-Vault/docs/architecture/async-celery-pattern.md
