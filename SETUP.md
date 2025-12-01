# Setup Instructions

## Prerequisites

1. Docker and Docker Compose installed
2. Ollama installed locally (or use Docker service)

## Initial Setup

### 1. Pull Ollama Models

Before starting the services, pull the required models:

```bash
ollama pull llama3.1:8b
ollama pull mxbai-embed-large
```

### 2. Environment Configuration

Create a `.env` file in the root directory (or copy from `.env.example`):

```env
JWT_SECRET=your-strong-secret-key-here
REFLECTION_MODEL=llama3.1:8b
EMBED_MODEL=mxbai-embed-large
```

### 3. Start Services

```bash
cd infra
docker compose up -d
```

This will start:
- PostgreSQL with pgvector (port 5432)
- Redis (port 6379)
- Ollama (port 11434)
- FastAPI backend (port 8000)
- Celery worker
- Next.js frontend (port 3000)

### 4. Run Database Migrations

```bash
docker compose exec api alembic upgrade head
```

Or if running locally:

```bash
cd api
alembic upgrade head
```

### 5. Verify Services

Check all services are running:

```bash
docker compose ps
```

Test API health:

```bash
curl http://localhost:8000/health
```

Test Ollama:

```bash
curl http://localhost:11434/api/tags
```

## Development Setup

### Backend (Local)

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (Local)

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

## Troubleshooting

### Database Connection Issues

If the API can't connect to the database:

1. Check database is running: `docker compose ps db`
2. Check database logs: `docker compose logs db`
3. Verify DATABASE_URL in environment

### Ollama Connection Issues

If embeddings/reflections fail:

1. Check Ollama is running: `docker compose ps ollama`
2. Verify models are pulled: `ollama list`
3. Check Ollama logs: `docker compose logs ollama`

### Background Jobs Not Running

If embeddings aren't being created:

1. Check Celery worker: `docker compose logs worker`
2. Check Redis: `docker compose ps redis`
3. Verify REDIS_URL in environment

### Frontend Can't Connect to API

1. Verify NEXT_PUBLIC_API_URL is set correctly
2. Check API is running: `curl http://localhost:8000/health`
3. Check CORS settings in `api/main.py`

## First Use

1. Navigate to http://localhost:3000
2. Register a new account
3. Create your first journal entry
4. Wait a few seconds for embeddings to process
5. Try semantic search
6. Check insights page (may need to wait for nightly job or trigger manually)

## Production Considerations

- Change JWT_SECRET to a strong random value
- Use environment-specific database credentials
- Set up proper backup strategy for PostgreSQL
- Configure reverse proxy (nginx) for production
- Enable HTTPS
- Set up monitoring and logging
- Configure Celery beat for scheduled tasks

