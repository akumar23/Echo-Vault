# EchoVault Feature Documentation

EchoVault is a privacy-first journaling application that combines local AI processing with semantic search capabilities. All AI inference happens locally by default, ensuring your journal entries remain private while still providing intelligent insights, mood analysis, and natural language search.

## Table of Contents

1. [Core Features](#core-features)
2. [User-Facing Features](#user-facing-features)
3. [AI and Machine Learning Features](#ai-and-machine-learning-features)
4. [Real-Time Features](#real-time-features)
5. [Privacy and Security Features](#privacy-and-security-features)
6. [Configuration and Customization](#configuration-and-customization)
7. [Technical Features](#technical-features)
8. [API Reference Summary](#api-reference-summary)

---

## Core Features

### Privacy-First Architecture

EchoVault is designed with privacy as a fundamental principle:

- **Local LLM Processing**: All AI inference runs locally via Ollama by default
- **No External API Calls**: Your journal data never leaves your infrastructure unless you explicitly configure external providers
- **Self-Hosted**: Full control over your data with Docker-based deployment
- **Optional Cloud Providers**: Support for OpenAI-compatible APIs (OpenAI, Groq, Together.ai, LM Studio, vLLM) when desired

### Multi-Layer AI Integration

The application uses AI across multiple dimensions:

| Feature | Purpose | Default Model |
|---------|---------|---------------|
| Text Generation | Reflections, insights, chat | llama3.1:8b |
| Embeddings | Semantic search | mxbai-embed-large |
| Mood Inference | Automatic mood detection | llama3.1:8b |

### Technology Stack

- **Frontend**: Next.js 16 with App Router, React 19, React Query, Zustand
- **Backend**: FastAPI (Python 3.11), SQLAlchemy ORM
- **Database**: PostgreSQL 16 with pgvector extension (1024-dimensional vectors)
- **Queue**: Celery with Redis broker
- **LLM**: Ollama (local) or any OpenAI API-compatible provider

---

## User-Facing Features

### Journal Entry Management

#### Creating Entries

The writing editor (`/new`) provides a distraction-free writing experience:

- **Minimal Interface**: Clean, focused writing environment
- **Auto-Save Indicator**: Visual feedback for unsaved changes
- **Keyboard Shortcuts**: Cmd/Ctrl + S to save
- **Word Count**: Real-time word count display

#### Entry Fields

| Field | Description | Required |
|-------|-------------|----------|
| Title | Optional entry title | No |
| Content | Main journal text | Yes |
| Tags | Categorization labels | No |
| Mood | Manual mood rating (1-5) | No |

#### Mood Selection

Users can either:
- **Set mood manually**: Choose from a 5-point scale with emoji indicators
  - 1: Low (sad face)
  - 2: Down (worried face)
  - 3: Neutral (neutral face)
  - 4: Good (slight smile)
  - 5: Great (happy face)
- **Let AI detect mood**: Toggle "Let AI detect mood" to have the LLM analyze entry content

### Voice Input

The voice input feature allows dictation using the Web Speech API:

- **Browser-Based**: Uses native browser speech recognition
- **Real-Time Transcription**: Shows interim transcription while speaking
- **Continuous Mode**: Supports ongoing dictation sessions
- **Seamless Integration**: Transcribed text appends to current content

### Dashboard

The main dashboard (`/`) provides an overview of journaling activity:

#### Recent Entries Panel
- Displays the 5 most recent journal entries
- Shows entry title, content preview, and date
- Click to expand entry details in a modal

#### Reflection Panel
- AI-generated reflection based on recent entries
- Auto-regenerates when new entries are created
- Click to view in expanded modal
- Quick access to chat for follow-up questions

#### Mood Insights
- Visual mood trends chart (7, 30, or 90 days)
- AI-powered semantic insights about mood patterns
- Weekly comparisons and trend indicators
- Best day of the week analysis
- Journaling streak tracking

### Mood Nudge System

Contextual prompts that appear when:
- Recent mood average falls below 2.5
- User hasn't journaled in 2+ days during a low mood period

Features:
- **Writing Prompts**: Rotating set of thoughtful prompts like:
  - "What's one small thing that brought you comfort today?"
  - "If you could tell your past self one thing, what would it be?"
  - "What would make tomorrow a little better?"
- **Voice-Adaptive Messaging**: Messages adjust based on selected insight voice
- **One-Click Writing**: Direct link to new entry page with prompt pre-loaded
- **Dismissible**: Can be closed without taking action

### Similar Entries

When recent mood is high (4+), the system surfaces past entries with similar positive moods:
- Shows up to 3 past high-mood entries
- Includes entry title, date, and content preview
- Helps users recognize positive patterns

### Personalized Greeting

Time-aware, mood-contextual greeting that displays:
- **Time of Day Greeting**: Good morning/afternoon/evening/night
- **Username**: Personalized with user's name
- **Mood-Based Message**: Contextual encouragement based on recent entries
- **Mood Trend Indicator**: Visual bar showing recent mood average with trend arrow

### Semantic Search

The search feature (`/entries`) uses AI embeddings for meaning-based search:

#### How It Works
1. User enters a natural language query
2. Query is converted to a 1024-dimensional vector
3. Cosine similarity is calculated against all entry embeddings
4. Results are ranked by combined relevance and recency score

#### Search Parameters
- **Query**: Natural language search text
- **Result Count (k)**: Number of results to return (default: 10)
- **Date Range**: Optional start/end date filtering
- **Tags**: Optional tag-based filtering

#### Time-Decay Scoring

Results balance relevance with recency using the formula:
```
score = similarity * decay
decay = 1 / (1 + age_days / half_life_days)
```

This ensures:
- Recent entries rank higher even with slightly lower similarity
- Older entries need higher relevance to rank well
- Half-life is user-configurable (default: 30 days)

### Insights Page

The insights page (`/insights`) provides AI-generated analysis:

#### Insight Components
- **Summary**: Factual overview of journaling patterns
- **Themes**: Key topics extracted from entries (e.g., "work", "family", "growth")
- **Suggested Actions**: Specific, actionable recommendations

#### Generation Options
- 3-day analysis
- 7-day analysis (default)
- 14-day analysis
- 30-day analysis

### Entry Detail View

Individual entry pages (`/entries/[id]`) display:
- Full entry content
- Mood indicator (user-set or AI-inferred)
- Tags with visual badges
- Edit capability
- Delete and "Forget" options

---

## AI and Machine Learning Features

### Mood Inference

When users don't manually set a mood, the system automatically infers it:

#### Inference Process
1. Entry is saved to database
2. Background job is queued via Celery
3. LLM analyzes entry content
4. Mood (1-5) is determined and stored

#### Mood Scale Definitions
| Score | Label | Description |
|-------|-------|-------------|
| 1 | Very Negative | Despair, grief, severe anxiety, hopelessness |
| 2 | Somewhat Negative | Stress, frustration, sadness, worry |
| 3 | Neutral | Factual reporting, mixed emotions, mundane |
| 4 | Somewhat Positive | Contentment, mild happiness, hope, calm |
| 5 | Very Positive | Joy, excitement, achievement, love |

### Semantic Embedding Generation

Every entry is automatically embedded for semantic search:

#### Embedding Process
1. Entry content is combined with title
2. Text is sent to embedding model (mxbai-embed-large by default)
3. 1024-dimensional vector is generated
4. Vector is stored in pgvector-enabled PostgreSQL

#### Re-embedding
- Embeddings are regenerated when entry content is updated
- Old embeddings are deleted before new ones are created

### AI Reflections

Daily reflections are generated based on recent journal entries:

#### Reflection Content
- Key themes and patterns observed
- Insights about emotional state and growth
- Two actionable suggestions
- Limited to ~250 words

#### Caching System
- Reflections are cached in Redis
- Cache is invalidated when entries are created, updated, or deleted
- Background generation prevents blocking user interactions

### Semantic Mood Insights

Advanced analysis correlating journal content with mood:

#### Insight Types
| Type | Description | Example |
|------|-------------|---------|
| positive_theme | Topics associated with high mood | "Your mood lifts when writing about creative projects" |
| negative_theme | Topics associated with low mood | "Entries about work deadlines tend toward lower mood" |
| mood_trend | Overall trajectory | "Your overall mood has been improving over time" |

#### Requirements
- Minimum 10 entries with mood data
- At least 3 entries in high-mood (4+) or low-mood (2-) categories
- LLM extracts common theme from grouped entries

### Theme Extraction

The system can extract common themes from multiple entries:

- Analyzes up to 10 entries (truncated to 500 chars each)
- Returns a 2-4 word phrase describing the shared topic
- Examples: "creative writing", "work deadlines", "family gatherings"

---

## Real-Time Features

### WebSocket Chat

Interactive chat interface for discussing reflections and entries:

#### Connection
```
WS /chat/ws/chat?token={jwt_token}
```

#### Message Types

**Client to Server:**
```json
{"type": "chat_message", "content": "user message"}
```

**Server to Client:**
```json
{"type": "context", "reflection": "...", "related_entries": [...]}
{"type": "token", "content": "..."}
{"type": "complete"}
{"type": "error", "message": "..."}
```

#### Features
- **Streaming Responses**: Tokens sent as generated
- **Context-Aware**: Includes current reflection and related entries
- **Conversation History**: Maintains last 10 messages for context
- **Semantic Search Integration**: Finds related entries for each question

### Reflection Streaming

Real-time streaming of AI-generated reflections:

#### Connection
```
WS /reflections/ws/{entry_id}?token={jwt_token}
```

#### Flow
1. Client connects with JWT token
2. Server fetches recent entries
3. LLM generates reflection token-by-token
4. Tokens streamed to client as generated

---

## Privacy and Security Features

### Authentication

#### JWT-Based Authentication
- Tokens expire after 7 days (configurable)
- HS256 algorithm for signing
- Secure password hashing with bcrypt
- Support for passwords of any length (SHA-256 preprocessing for >72 bytes)

#### Protected Routes
- All data endpoints require valid JWT
- User-scoped queries prevent cross-user data access
- WebSocket endpoints accept token via query parameter

### Data Deletion Options

#### Soft Delete (Default)
When "Forget" is used with soft delete enabled:
- Entry marked as `is_deleted = true`
- Embedding vector zeroed out (1024 zeros)
- Embedding marked as `is_active = false`
- Entry removed from search but preserved in database

#### Hard Delete
When "Forget" is used with hard delete enabled:
- Entry permanently deleted from database
- All embeddings deleted
- Attachment files removed from disk
- Cannot be undone

### Data Export

Full data portability via JSONL export:

```
GET /export/entries
```

Returns:
- Entry ID, title, content, tags
- User and inferred mood scores
- Timestamps (created, updated)
- Embedding vectors (for migration)

### Security Measures

- **SQL Injection Protection**: SQLAlchemy ORM parameterization
- **CORS Configuration**: Configurable allowed origins
- **No Credential Hardcoding**: All secrets via environment variables
- **Token Sanitization**: API tokens are write-only (never returned in responses)

---

## Configuration and Customization

### User Settings

Accessible via `/settings`:

#### Search Settings
- **Search Half-Life**: 1-365 days (default: 30)
  - Lower values prioritize recent entries
  - Higher values prioritize relevance only

#### LLM Settings

**Text Generation (Reflections, Insights, Mood):**
- API URL (e.g., `http://host.docker.internal:11434`)
- API Token (optional, for cloud providers)
- Model Name (e.g., `llama3.1:8b`, `gpt-4`)

**Embeddings (Semantic Search):**
- Separate URL, token, and model configuration
- Allows mixing providers (e.g., local embeddings, cloud generation)

#### Privacy Settings
- **Hard Delete Toggle**: Enable permanent deletion

#### Insight Voice

Three personality options for AI-generated content:

| Voice | Style | Example Greeting |
|-------|-------|------------------|
| Gentle | Warm, supportive | "You've been on a great streak lately" |
| Direct | Concise, factual | "Mood up. Strong momentum." |
| Playful | Fun, with emojis | "Look at you go! On fire!" |

### Theme Support

- **Light Mode**: Bright, clean interface
- **Dark Mode**: Reduced eye strain for night use
- **System Mode**: Follows OS preference
- Persisted in localStorage

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Token signing secret | Required |
| `DATABASE_URL` | PostgreSQL connection | Required |
| `REDIS_URL` | Redis connection | Required |
| `DEFAULT_GENERATION_URL` | LLM API URL | `http://ollama:11434` |
| `DEFAULT_GENERATION_MODEL` | Generation model | `llama3.1:8b` |
| `DEFAULT_EMBEDDING_URL` | Embedding API URL | `http://ollama:11434` |
| `DEFAULT_EMBEDDING_MODEL` | Embedding model | `mxbai-embed-large` |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | API URL for frontend | `http://localhost:8000` |

---

## Technical Features

### Background Job Processing

Celery workers handle async operations:

#### Embedding Job
- Triggered: Entry creation, content update
- Task: `embedding.create_embedding`
- Duration: ~500ms-2s

#### Mood Inference Job
- Triggered: Entry creation (if no user mood set)
- Task: `mood.infer_mood`
- Duration: ~1-5s

#### Insights Generation Job
- Triggered: Manual request or nightly schedule
- Task: `insights.generate_insights`
- Duration: ~5-30s

### Database Schema

#### Core Tables

**users**
- id, email, username, hashed_password
- created_at, is_active

**entries**
- id, user_id, title, content, tags (JSON)
- mood_user, mood_inferred
- created_at, updated_at, is_deleted

**entry_embeddings**
- id, entry_id
- embedding (Vector 1024)
- is_active

**insights**
- id, user_id
- summary, themes (JSON), actions (JSON)
- period_start, period_end, created_at

**settings**
- id, user_id
- search_half_life_days, privacy_hard_delete
- generation_url, generation_api_token, generation_model
- embedding_url, embedding_api_token, embedding_model

### Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| web | 3000 | Next.js frontend |
| api | 8000 | FastAPI backend |
| worker | - | Celery background jobs |
| beat | - | Celery scheduler |
| db | 5432 | PostgreSQL + pgvector |
| redis | 6379 | Celery broker |
| ollama | 11434 | Local LLM inference |

### API Design

- RESTful endpoints for CRUD operations
- WebSocket endpoints for real-time features
- OpenAPI documentation at `/docs`
- Consistent error response format

---

## API Reference Summary

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create new user account |
| POST | `/auth/login` | Get JWT access token |
| GET | `/auth/me` | Get current user info |

### Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/entries` | Create entry |
| GET | `/entries` | List entries |
| GET | `/entries/{id}` | Get single entry |
| PUT | `/entries/{id}` | Update entry |
| DELETE | `/entries/{id}` | Soft delete entry |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/search/semantic` | Semantic search with time decay |

### Insights
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/insights/recent` | Get recent insights |
| POST | `/insights/generate` | Trigger insight generation |
| GET | `/insights/mood-content` | Get semantic mood insights |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings` | Get user settings |
| PUT | `/settings` | Update settings |

### Privacy
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/forget/{id}` | Forget entry (soft/hard delete) |
| GET | `/export/entries` | Export all entries as JSONL |

### Reflections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reflections` | Get cached reflection |
| POST | `/reflections/regenerate` | Force regeneration |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `WS /chat/ws/chat?token=...` | Interactive chat |

---

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Ollama with required models pulled:
  ```bash
  ollama pull llama3.1:8b
  ollama pull mxbai-embed-large
  ```

### Quick Start
```bash
# Clone and navigate to project
cd Echo-Vault

# Create environment file
cp default.env .env
# Edit .env to set JWT_SECRET

# Start all services
cd infra && docker compose up -d

# Run database migrations
docker compose exec api alembic upgrade head

# Access application
open http://localhost:3000
```

For detailed setup instructions, see the main [README.md](/README.md) and [ENV_CONFIG.md](/docs/ENV_CONFIG.md).
