# Environment Configuration

The application uses environment variables for configuration. These can be set via `.env` files or directly in your environment.

## Configuration Files

- **Root `.env`**: Used by Docker Compose and shared across services
- **`api/.env`**: For local FastAPI development (optional, falls back to root `.env`)
- **`app/.env.local`**: For local Next.js development (optional)

## Environment Variables

### API Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg://journal:journal@db:5432/journal` | `postgresql+psycopg://user:pass@localhost:5432/db` |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379/0` | `redis://localhost:6379/0` |
| `OLLAMA_URL` | Ollama server URL | `http://ollama:11434` | `http://localhost:11434` |
| `JWT_SECRET` | Secret key for JWT tokens | `change_me` | Generate with `openssl rand -hex 32` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiration time | `30` | `60` |
| `UPLOAD_DIR` | Directory for file uploads | `/data/uploads` | `./uploads` |

### Model Configuration

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `REFLECTION_MODEL` | Model for reflections and insights | `llama3.1:8b` | `llama3.1:8b`, `llama3.1:70b`, `gemma2:9b`, `mistral:7b` |
| `EMBED_MODEL` | Model for embeddings | `mxbai-embed-large` | `mxbai-embed-large`, `nomic-embed-text` |

### Frontend Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_API_URL` | API URL for frontend | `http://localhost:8000` | `http://localhost:8000` |

## Usage

### Docker Compose

The root `.env` file is automatically loaded by Docker Compose. All services will use these values.

```bash
# Start services with .env configuration
cd infra
docker compose up -d
```

### Local Development

#### Backend (FastAPI)

The FastAPI app reads from `.env` files in this order:
1. `api/.env` (if exists)
2. Root `.env` (if exists)
3. Environment variables
4. Default values

```bash
cd api
# Create .env for local development
cp .env.example .env
# Edit .env with your local settings
# OLLAMA_URL=http://localhost:11434
uvicorn main:app --reload
```

#### Frontend (Next.js)

Next.js reads from `.env.local` in the `app` directory:

```bash
cd app
# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

## Changing Models

To use different Ollama models:

1. **Pull the model:**
   ```bash
   ollama pull llama3.1:70b
   ollama pull nomic-embed-text
   ```

2. **Update `.env`:**
   ```env
   REFLECTION_MODEL=llama3.1:70b
   EMBED_MODEL=nomic-embed-text
   ```

3. **Restart services:**
   ```bash
   docker compose restart api worker
   ```

## Using Local Ollama (Outside Docker)

If you're running Ollama locally instead of in Docker:

1. **Update `.env`:**
   ```env
   OLLAMA_URL=http://localhost:11434
   ```

2. **For Docker services**, update `docker-compose.yml` to use host network or update the URL to point to your host machine.

## Security Notes

- **Never commit `.env` files** to version control
- Use strong, random `JWT_SECRET` in production
- Keep `.env.example` updated with all available options
- Use different secrets for development and production

## Generating Secrets

Generate a secure JWT secret:

```bash
openssl rand -hex 32
```

Or using Python:

```python
import secrets
print(secrets.token_hex(32))
```

