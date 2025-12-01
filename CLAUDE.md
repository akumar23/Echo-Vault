# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EchoVault** is a privacy-first journaling application with local LLM inference, vector search, and intelligent insights. All AI processing happens locally via Ollama - no data leaves the user's machine.

**Tech Stack:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** FastAPI (Python 3.11), SQLAlchemy ORM
- **Database:** PostgreSQL 16 with pgvector extension
- **AI/LLM:** Ollama (local inference for embeddings and reflections)
- **Background Jobs:** Celery with Redis broker
- **State Management:** React Query (server state), Zustand (client state)

## Development Commands

### Full Stack (Docker)

```bash
# Start all services (from /infra directory)
cd infra
docker compose up -d

# View logs
docker compose logs -f [service_name]  # service_name: api, web, worker, db, redis, ollama

# Stop all services
docker compose down

# Run database migrations
docker compose exec api alembic upgrade head

# Create a new migration
docker compose exec api alembic revision --autogenerate -m "description"
```

### Backend (Local Development)

```bash
cd api

# Install dependencies
pip install -r requirements.txt

# Run API server
uvicorn main:app --reload  # Runs on port 8000

# Run tests
pytest

# Run specific test file
pytest tests/test_search.py

# Run with coverage
pytest --cov=app

# Run Celery worker (for background jobs)
celery -A app.celery_app worker --loglevel=info

# Run database migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "add new table"
```

### Frontend (Local Development)

```bash
cd app

# Install dependencies
pnpm install

# Run dev server
pnpm run dev  # Runs on port 3000

# Build for production
pnpm run build

# Run production build
pnpm start

# Run linter
pnpm run lint

# Run Playwright tests
pnpm exec playwright test

# Run Playwright tests in UI mode
pnpm exec playwright test --ui
```

### Ollama Setup

```bash
# Pull required models (before starting services)
ollama pull llama3.1:8b        # For reflections/insights
ollama pull mxbai-embed-large  # For embeddings

# List installed models
ollama list

# Test Ollama connection
curl http://localhost:11434/api/tags
```

## Architecture Overview

### Core Data Flow: Entry Creation

1. User creates entry → POST `/entries`
2. Entry saved to database
3. **Background jobs enqueued** (non-blocking):
   - Embedding job: Calls Ollama to generate 1024-dim vector, stores in `entry_embeddings`
   - Mood inference job: Calls Ollama to infer mood (1-5), updates `entry.mood_inferred`

### Semantic Search Flow

1. Query embedded via Ollama → 1024-dim vector
2. Database query finds entries with active embeddings
3. **Time-decayed scoring:**
   ```python
   similarity = cosine_similarity(query_embedding, entry_embedding)
   age_days = (now - entry.created_at) / 86400
   decay = 1.0 / (1.0 + age_days / half_life_days)
   score = similarity * decay
   ```
4. Returns top-k results sorted by score

**Key insight:** Recent entries rank higher even with lower similarity. Half-life is user-configurable (default: 30 days).

### Forgetting System

- **Soft Forget:** Sets `entry_embeddings.is_active = false`, zeros embedding, sets `entry.is_deleted = true`. Entry removed from search but content preserved.
- **Hard Delete:** Permanently deletes entry and all related records (attachments, embeddings).

### WebSocket Streaming

Reflections stream token-by-token from Ollama to client via WebSocket at `/ws/reflect`. See `api/app/websocket.py` and frontend components using WebSocket connections.

## Key Directories

### Backend (`/api`)

```
api/
├── app/
│   ├── routers/        # FastAPI route handlers (auth, entries, search, insights, settings, forget, export)
│   ├── models/         # SQLAlchemy ORM models (user, entry, embedding, insight, settings, attachment)
│   ├── schemas/        # Pydantic schemas for request/response validation
│   ├── services/       # Business logic (ollama_service.py for LLM calls)
│   ├── jobs/           # Celery background tasks (embedding_job, mood_job, insights_job)
│   ├── core/           # Core utilities (config, dependencies, security/JWT)
│   ├── database.py     # Database session management
│   ├── celery_app.py   # Celery configuration
│   └── websocket.py    # WebSocket handlers for streaming reflections
├── alembic/            # Database migrations
├── prompts/            # LLM prompt templates (reflection.txt, mood_infer.txt, topic_labels.txt)
├── tests/              # Pytest test files
└── main.py             # FastAPI app entry point
```

### Frontend (`/app`)

```
app/
├── app/                # Next.js App Router pages
│   ├── entries/        # Entry list and detail pages
│   ├── new/            # Create new entry
│   ├── insights/       # AI insights page
│   ├── settings/       # User settings
│   ├── login/          # Login page
│   └── register/       # Registration page
├── components/         # React components (Editor, SemanticSearchBox, ReflectionsPanel, TrendsChart, DecaySlider)
├── hooks/              # React hooks (useEntries, useEntryMutations, useInsights, useSettings)
├── lib/                # Utilities (api.ts - Axios client, validation.ts, errors.ts)
├── contexts/           # React contexts
└── types/              # TypeScript type definitions
```

## Database Schema

**Key Tables:**
- `users` - User accounts with email, username, hashed passwords
- `entries` - Journal entries with title, content, tags, mood (user-set and AI-inferred), `is_deleted` flag
- `entry_embeddings` - Vector embeddings (1024 dimensions) with `is_active` flag for soft forgetting
- `insights` - AI-generated summaries, themes, actions for 7-day/30-day periods
- `settings` - User preferences (search half-life, privacy settings)
- `attachments` - File attachments (OCR support planned)

**Vector Search:** Uses pgvector extension for cosine similarity search on embeddings.

## Important Patterns

### Authentication

- JWT tokens stored in localStorage (frontend)
- Axios interceptor adds `Authorization: Bearer <token>` to all requests
- SSR guard: `typeof window !== 'undefined'` before accessing localStorage
- Protected routes use `get_current_user` dependency (backend) or `ProtectedRoute` component (frontend)

### Background Jobs

All LLM calls are async via Celery to prevent blocking:
```python
# In routers/entries.py
from app.jobs.embedding_job import generate_embedding_task
generate_embedding_task.delay(entry.id)  # Non-blocking
```

Jobs defined in `api/app/jobs/` and registered with Celery.

### React Query Patterns

```typescript
// Custom hooks in /app/hooks use React Query for caching
const { data: entries } = useEntries()          // Auto-fetches and caches
const createEntry = useCreateEntry()            // Mutation with optimistic updates
```

### Environment Variables

- Backend uses Pydantic Settings (`app.core.config`)
- Frontend uses `process.env.NEXT_PUBLIC_*` for client-side vars
- All configs in `/.env` (see `.env.example` in README if needed)

## Common Workflows

### Adding a New API Endpoint

1. Create Pydantic schema in `api/app/schemas/`
2. Add route handler in appropriate router in `api/app/routers/`
3. Add service logic in `api/app/services/` if needed
4. Update `api/main.py` to include router (if new router file)
5. Add TypeScript types and API function in `app/lib/api.ts`
6. Create React Query hook in `app/hooks/` for data fetching

### Adding a New Database Column

1. Update SQLAlchemy model in `api/app/models/`
2. Generate migration: `alembic revision --autogenerate -m "add column"`
3. Review and edit migration in `api/alembic/versions/`
4. Run migration: `alembic upgrade head`
5. Update Pydantic schemas in `api/app/schemas/`
6. Update TypeScript types in `app/lib/api.ts`

### Debugging Background Jobs

```bash
# View Celery worker logs
docker compose logs -f worker

# Check Redis connection
docker compose exec redis redis-cli ping

# Manually trigger a job (in Python shell)
from app.jobs.embedding_job import generate_embedding_task
generate_embedding_task.delay(entry_id)
```

### Testing Search Functionality

The search implementation is in `api/app/routers/search.py`:
- Uses numpy for cosine similarity calculation
- Converts pgvector embeddings to numpy arrays
- Time decay formula: `1.0 / (1.0 + age_days / half_life_days)`
- When modifying search logic, test with various half-life values and time ranges

## Privacy & Security Considerations

- All LLM processing is local via Ollama (OLLAMA_URL defaults to Docker service)
- JWT tokens expire per `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30 min)
- User data is scoped: all queries filter by `user_id`
- SQLAlchemy ORM prevents SQL injection
- Passwords hashed with bcrypt via passlib

## Helpful Context

- **Why Next.js 16 with App Router?** Server Components for better performance, modern routing
- **Why Celery?** LLM calls can take seconds; async jobs prevent blocking API responses
- **Why pgvector?** Native PostgreSQL extension for fast vector similarity search
- **Why local Ollama?** Privacy-first design - no external API calls, all data stays local
- **Time-decayed search rationale:** Users typically care more about recent relevant memories than old ones

## Testing

- Backend tests use pytest with async support (`pytest-asyncio`)
- Frontend tests use Playwright for E2E testing
- Test database should use separate connection string
- Mock Ollama calls in tests to avoid LLM dependencies
