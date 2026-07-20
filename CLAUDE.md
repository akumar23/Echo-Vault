# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

EchoVault is a self-hosted, privacy-first AI journal. Users write entries; a **local** LLM (Ollama by default) embeds them, infers mood, and generates reflections/insights. By default nothing leaves the machine. Any OpenAI-compatible endpoint (OpenAI, Groq, vLLM, LM Studio, Together.ai) can be swapped in per-user from Settings.

Three-part monorepo:
- `api/` — FastAPI backend + Celery worker (Python 3.11)
- `app/` — Next.js 16 / React 19 frontend, also packaged as a Tauri desktop app
- `infra/` — Docker Compose, Dockerfiles, `init.sql`

Deep documentation lives in `docs/` (`ARCHITECTURE.md`, `ENV_CONFIG.md`, `API.md`, `WEBSOCKET_AUTH_GUIDE.md`, `architecture/async-celery-pattern.md`). Read these before large changes — they explain *why*, not just *what*.

## Common commands

```bash
# Full stack (from infra/)
cd infra && docker compose up -d        # starts db, redis, ollama, api, worker, web
docker compose logs <service>           # worker is where AI-job failures surface
docker compose ps                       # which container is unhealthy

# Backend dev (from api/)
uvicorn main:app --reload               # API on :8000, interactive docs at /docs
celery -A app.celery_app worker --loglevel=info --concurrency=1   # the worker
pytest                                  # all backend tests
pytest tests/test_auth.py               # one file
pytest tests/test_auth.py::test_name    # one test
alembic upgrade head                    # apply migrations (run before serving)
alembic revision --autogenerate -m "msg"

# Frontend dev (from app/) — package manager is pnpm
pnpm install
pnpm run dev                            # :3000
pnpm run lint                           # eslint
pnpm exec playwright test               # e2e tests
pnpm tauri:dev / pnpm tauri:build       # desktop app (needs Rust)
```

The frontend needs db + redis + ollama running (use Docker for those even during local frontend/backend dev).

## Architecture essentials (the non-obvious parts)

**Schema is Alembic-only.** `create_all()` is intentionally removed from startup to prevent silent schema drift. New tables/columns require a migration in `api/alembic/versions/`. The Docker entrypoint runs `alembic upgrade head` before `uvicorn`.

**Background work goes through Celery, never inline.** LLM calls are slow (1-2s+), so routers enqueue jobs and return immediately. Jobs live in `api/app/jobs/` (`mood_job`, `reflection_job`, `insights_job`), are dispatched with `.delay()`, and run `ignore_result=True` (no result backend — the Celery config is heavily tuned to minimize Redis ops for single-user/Upstash deploys). **Celery tasks call async LLM service methods via `asyncio.run()`** — this is deliberate; see `docs/architecture/async-celery-pattern.md`.

**LLM access is per-user and provider-agnostic.** Everything speaks the OpenAI chat-completions API format. Never construct an `LLMService` directly — use `get_generation_service_for_user(db, user_id)` in `api/app/services/llm_service.py`.

It falls back to server defaults (`DEFAULT_GENERATION_*`) when the user hasn't configured their own. A fresh `httpx.AsyncClient` is created per request to avoid event-loop reuse issues in the worker.

**Search and AI context do not use RAG.** Search decrypts up to the user's 1,000 most recent entries in the API process, matches query terms against title/content/tags, and uses recency as a tiebreaker. AI features receive bounded chronological windows from `ContextService`. Do not add plaintext full-text indexes: entry title/content are encrypted at rest.

**At-rest encryption (Fernet).** `api/app/core/encryption.py` encrypts LLM API tokens (`enc:` prefix) and entry content/title (`encv1:` prefix, versioned) via a SQLAlchemy `TypeDecorator` on the `entries` model. Controlled by `ENCRYPTION_KEY`. **Losing this key makes encrypted entries unrecoverable.** Production refuses to start without it (see validators in `config.py`). `api/scripts/encrypt_existing_entries.py` backfills legacy plaintext rows.

**Auth is httpOnly cookies + a same-origin proxy.** Access tokens are short-lived (15 min) with a 7-day refresh; `app/lib/api.ts` has a refresh interceptor that retries 401s once. Browsers block cross-origin `Set-Cookie`, so the frontend calls `/api/*` and Next.js rewrites (`app/next.config.js`) proxy to the backend, making cookies first-party — this is why `cookie_same_site` is `lax` and why `API_PROXY_URL` (server-only, e.g. `http://api:8000`) is separate from `NEXT_PUBLIC_API_URL` (browser-reachable). Do not "simplify" this to direct cross-origin calls; it breaks auth. Tauri static builds have no Next server, so they bypass the proxy and use the direct URL.

**Frontend state split:** React Query for server state (caching/refetch), Zustand for client UI state. Reflections are cached in Redis with a TTL and invalidated on entry create/update/delete.

**WebSocket chat** streams tokens from `/chat/ws/chat`, pulling relevant past entries as context. Auth differs from REST — see `docs/WEBSOCKET_AUTH_GUIDE.md`.

## Conventions

- DB driver is psycopg v3; `config.py` auto-rewrites `postgresql://` → `postgresql+psycopg://`.
- Never log raw URLs/exceptions that may contain credentials — `main.py` has `_scrub_creds` / `_safe_db_url_summary` helpers; follow that pattern.
- Two config layers: root `.env` (Docker Compose, stack-wide defaults) vs. the in-app Settings page (per-user overrides for LLM endpoints, search half-life, hard-delete).
- "Forget": soft-delete sets `is_deleted` (hides from search); hard delete (opt-in per user) erases permanently.
- Prompt templates for the LLM live in `api/prompts/*.txt`.
- Pin/check library versions and use context7 for unfamiliar framework APIs (per global instructions).
- **Commit messages:** use imperative mood, 1–2 sentences on *why* (not a file list). Merge commits should summarize the branch outcome (e.g. "Remove embedding pipeline; switch search to in-process keyword ranking"), not repeat the branch name alone. Review follow-ups get descriptive subjects (e.g. "Fix mood cache rehydration and restore migration bodies for fresh installs"), not "MR comment response".
