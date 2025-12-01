# Architecture

## Overview

EchoVault is a full-stack application with a Next.js frontend, FastAPI backend, PostgreSQL database with pgvector extension, Redis for job queuing, and Ollama for local LLM inference.

## System Components

### Frontend (Next.js 14)

- **Framework**: Next.js 14 with App Router
- **State Management**: React Query for server state, Zustand for client state
- **Styling**: CSS modules with global styles
- **Key Pages**:
  - `/` - Dashboard with reflections and trends
  - `/new` - Create new entry
  - `/entries` - List all entries
  - `/entries/[id]` - Entry detail with editor
  - `/insights` - AI-generated insights
  - `/settings` - User settings

### Backend (FastAPI)

- **Framework**: FastAPI with Python 3.11
- **Database**: SQLAlchemy ORM with PostgreSQL
- **Authentication**: JWT tokens
- **Background Jobs**: Celery with Redis broker

### Database Schema

#### Users
- User accounts with email, username, hashed passwords

#### Entries
- Journal entries with title, content, tags, mood (user-set and AI-inferred)
- Soft delete support via `is_deleted` flag

#### Entry Embeddings
- Vector embeddings (1024 dimensions) for semantic search
- `is_active` flag for soft forgetting
- Uses pgvector extension

#### Insights
- AI-generated summaries, themes, and actionable suggestions
- Period-based (7-day, 30-day)

#### Settings
- User preferences: search half-life, privacy settings

#### Attachments
- File attachments with OCR support (future)

## Data Flow

### Entry Creation Flow

1. User creates entry via POST `/entries`
2. Entry saved to database
3. Background job enqueued for embedding generation
4. Background job enqueued for mood inference
5. Embedding job:
   - Calls Ollama embedding API (`mxbai-embed-large`)
   - Stores 1024-dim vector in `entry_embeddings`
6. Mood job:
   - Calls Ollama with mood inference prompt
   - Updates `entry.mood_inferred`

### Semantic Search Flow

1. User submits search query
2. Query embedded via Ollama
3. Database query:
   - Find entries with active embeddings
   - Calculate cosine similarity
   - Apply time decay: `decay = 1 / (1 + age_days / half_life)`
   - Combine: `score = similarity * decay`
4. Return top-k results sorted by score

### Insights Generation Flow

1. Nightly Celery task runs for each user
2. Aggregates entries from last 7/30 days
3. Calls Ollama with reflection prompt
4. Parses response into summary, themes, actions
5. Stores in `insights` table

### Reflection Streaming Flow

1. User requests reflection (via WebSocket)
2. Server fetches recent entries
3. Opens WebSocket connection to client
4. Streams Ollama response token-by-token
5. Client displays tokens as they arrive

### Forgetting Flow

**Soft Forget:**
- Sets `entry_embeddings.is_active = false`
- Zeros out embedding vector
- Sets `entry.is_deleted = true`
- Entry removed from search but content preserved

**Hard Delete:**
- Deletes entry and all related records
- Removes attachment files from disk
- Permanent deletion

## Background Jobs

### Embedding Job
- Triggered on entry create/update
- Generates embedding via Ollama
- Stores in `entry_embeddings`

### Mood Inference Job
- Triggered on entry create
- Infers mood (1-5) from content
- Updates `entry.mood_inferred`

### Insights Job
- Runs nightly via Celery beat (not implemented in this version)
- Generates 7-day and 30-day insights
- Can be manually triggered

## Time-Decayed Search

The search scoring combines semantic similarity with temporal decay:

```
similarity = 1 - cosine_distance(query_embedding, entry_embedding)
age_days = (now - entry.created_at) / 86400
decay = 1 / (1 + age_days / half_life_days)
score = similarity * decay
```

This ensures:
- Recent entries rank higher even with slightly lower similarity
- Older entries need higher similarity to rank well
- Half-life is user-configurable (default 30 days)

## Privacy Features

1. **Local Processing**: All LLM calls go to local Ollama instance
2. **Soft Delete**: Entries can be removed from search without deletion
3. **Hard Delete**: Optional permanent deletion
4. **Export**: JSONL export of entries with embeddings
5. **No External APIs**: No data sent to external services

## Security

- JWT authentication with bcrypt password hashing
- Protected routes require valid JWT
- User-scoped queries (users can only access their own data)
- SQL injection protection via SQLAlchemy ORM

## Scalability Considerations

- Background jobs prevent blocking on LLM calls
- Vector search uses indexed pgvector queries
- Redis for efficient job queuing
- Database connection pooling

## Future Enhancements

- OCR for attachments
- Multi-user household support
- At-rest encryption for attachments
- Multi-model mood voices
- Structured output parsing for insights
- Celery beat for scheduled tasks

