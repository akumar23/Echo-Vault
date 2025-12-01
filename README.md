# EchoVault
#### A self-hosted AI memory system that learns, recalls, and forgets.

A privacy-first journaling application with local LLM inference, vector search, and intelligent insights. All processing happens locally - no data leaves your machine.

## Features

- **Local LLM Processing**: Uses Ollama for all AI features (embeddings, reflections, mood inference, insights)
- **Vector Search**: Semantic search with time-decayed scoring via PGVector
- **Background Jobs**: Async processing with Celery for embeddings and insights
- **Streaming Reflections**: Real-time streaming of AI-generated reflections
- **Privacy Controls**: Soft/hard delete options for entries
- **Mood Tracking**: User-set and AI-inferred mood tracking
- **Insights**: Automated nightly insights generation

## How It Works: Understanding the AI Features

If you're new to LLMs (Large Language Models) and vector search, here's what these features actually do for you:

### 🤖 LLM Processing (Local AI)

**What it is**: An LLM is like having a smart assistant that reads and understands your journal entries. Unlike ChatGPT or other online services, this runs entirely on your computer - your private thoughts never leave your machine.

**What it does for you**:

1. **Reflections**: After you write entries, the AI reads them and provides thoughtful insights. For example, if you wrote about work stress, it might notice patterns like "You've mentioned feeling overwhelmed on Mondays" and suggest actionable advice.

2. **Mood Inference**: The AI automatically detects the emotional tone of your entries (on a scale of 1-5) even if you forget to set it manually. This helps track your mood over time.

3. **Insights Generation**: Every night, the AI analyzes your recent entries and creates summaries like:
   - "This week you focused on work-life balance"
   - "Common themes: stress, family time, gratitude"
   - "Consider taking breaks during work hours"

**Why it's useful**: Instead of manually reviewing hundreds of entries, the AI helps you see patterns, themes, and insights you might miss, but remembering everything you've written.

### 🔍 Vector Search (Semantic Search)

**What it is**: Traditional search finds entries by matching exact words. Vector search understands the *meaning* behind your words, even if you use different phrasing.

**How it works**: 
- When you write an entry, the AI converts it into a "vector" (a mathematical representation of meaning)
- When you search, your query is also converted to a vector
- The system finds entries with similar meanings, not just matching words

**Example**:
- You search for: "feeling anxious about deadlines"
- It finds entries about: "work stress", "pressure at the office", "worried about projects" - even if those exact words weren't used
- It also prioritizes recent entries (time-decayed scoring), so newer relevant entries appear first

**Why it's useful**: You can find entries by describing how you felt or what you were thinking about, without remembering the exact words you used. It's like Google Search, but for your personal thoughts.

### 📊 Time-Decayed Scoring

**What it is**: A way to balance relevance with recency in search results.

**How it works**: 
- Entries that match your search are ranked by both:
  1. How similar they are to your query (semantic similarity)
  2. How recent they are (time decay)
- You can adjust the "half-life" setting: lower values favor recent entries, higher values treat all entries equally regardless of age

**Example**: If you search for "work stress" and have 10 relevant entries:
- A very recent entry about work stress might rank #1 even if it's slightly less similar
- An older entry needs to be much more relevant to rank high
- You control this balance in Settings

**Why it's useful**: Sometimes you want to find what you wrote recently about a topic, not necessarily the most detailed entry from months ago.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Ollama installed locally (or use the Docker service)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd infinite-drafts
   ```

2. **Set up environment variables**
   
   Copy the example environment file and customize:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   - `JWT_SECRET`: Generate a strong secret (e.g., `openssl rand -hex 32`)
   - `REFLECTION_MODEL`: Model for reflections/insights (default: `llama3.1:8b`)
   - `EMBED_MODEL`: Model for embeddings (default: `mxbai-embed-large`)
   - `OLLAMA_URL`: Ollama server URL (default: `http://ollama:11434` for Docker, `http://localhost:11434` for local)
   
   See `.env.example` for all available options.

3. **Pull Ollama models** (before starting services)
   ```bash
   ollama pull llama3.1:8b
   ollama pull mxbai-embed-large
   ```

4. **Start all services**
   ```bash
   cd infra
   docker compose up -d
   ```

5. **Run database migrations**
   ```bash
   cd ../api
   docker compose exec api alembic upgrade head
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### First Use

1. Register a new account at http://localhost:3000/register
2. Create your first journal entry
3. Wait a few seconds for embeddings to process
4. Try semantic search to find related entries
5. Check insights page for AI-generated summaries

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

## API Documentation

See [API.md](docs/API.md) for complete API reference.

## Development

### Backend Development

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Development

```bash
cd app
pnpm install
pnpm run dev
```

### Running Tests

**Backend:**
```bash
cd api
pytest
```

**Frontend:**
```bash
cd app
pnpm exec playwright test
```

## Services

- **web**: Next.js frontend (port 3000)
- **api**: FastAPI backend (port 8000)
- **worker**: Celery worker for background jobs
- **db**: PostgreSQL 16 with pgvector (port 5432)
- **redis**: Redis for Celery broker (port 6379)
- **ollama**: Ollama LLM server (port 11434)

## Docker Image Versions

All Docker images are pinned to specific versions for reproducibility and stability:

| Service | Image | Version/Digest | Last Updated |
|---------|-------|----------------|--------------|
| **Ollama** | `ollama/ollama` | `sha256:3d8a05e...` | Nov 2024 |
| **Redis** | `redis` | `7.2.5-alpine` | Nov 2024 |
| **PostgreSQL** | `pgvector/pgvector` | `pg16` | Nov 2024 |
| **Node.js** | `node` | `20.18.0-alpine` | Nov 2024 |
| **Python** | `python` | `3.11.10-slim` | Nov 2024 |

### Updating Versions

To update Docker image versions:

1. Check for new versions:
   ```bash
   docker pull ollama/ollama:latest
   docker inspect ollama/ollama:latest --format='{{.RepoDigests}}'
   ```

2. Test the new version locally:
   ```bash
   docker compose up -d
   # Run your tests
   ```

3. Update the version in `infra/docker-compose.yml` or Dockerfiles

4. Update this table with the new version and date

**Why pin versions?** Ensures reproducible builds, prevents unexpected breaking changes, and makes debugging easier when versions are known.

## Configuration

### Search Decay

Adjust the search half-life in Settings to control how quickly older entries decay in search results. Lower values favor recent entries.

### Privacy Settings

- **Soft Delete**: Removes entries from search but keeps content
- **Hard Delete**: Permanently deletes entries and all associated data

## Troubleshooting

### Ollama Connection Issues

Ensure Ollama is running and accessible:
```bash
curl http://localhost:11434/api/tags
```

### Database Connection

Check database is healthy:
```bash
docker compose ps
```

### Background Jobs Not Running

Check Celery worker logs:
```bash
docker compose logs worker
```

## License

MIT

