# Environment Configuration

The application uses environment variables for configuration. These can be set via `.env` files or directly in your environment.

## Configuration Files

- **Root `.env`**: Used by Docker Compose and shared across services
- **`api/.env`**: For local FastAPI development (optional, falls back to root `.env`)
- **`app/.env.local`**: For local Next.js development (optional)

## Environment Variables

### Security Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | Secret key for JWT tokens | `change_me` | **Yes (Production)** |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiration time in minutes | `10080` (1 week) | No |

### CORS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGINS` | Comma-separated list of allowed origins | `http://localhost:3000,http://localhost:3001` | **Yes (Production)** |

**Production Example:**
```env
CORS_ORIGINS=https://echovault.example.com,https://www.echovault.example.com
```

### Database Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg://echovault:echovault@db:5432/echovault` | `postgresql+psycopg://user:pass@host:5432/db` |
| `POSTGRES_USER` | PostgreSQL username (Docker) | `echovault` | - |
| `POSTGRES_PASSWORD` | PostgreSQL password (Docker) | `echovault` | - |
| `POSTGRES_DB` | PostgreSQL database name (Docker) | `echovault` | - |

### Redis Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `REDIS_URL` | Redis connection URL | `redis://redis:6379/0` | `redis://localhost:6379/0` |

### LLM Configuration (Legacy)

These variables are used for backward compatibility with local Ollama:

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `OLLAMA_URL` | Ollama server URL | `http://ollama:11434` | `http://localhost:11434` |
| `REFLECTION_MODEL` | Model for reflections and insights | `llama3.1:8b` | `llama3.1:8b`, `llama3.1:70b`, `gemma2:9b` |
| `EMBED_MODEL` | Model for embeddings | `mxbai-embed-large` | `mxbai-embed-large`, `nomic-embed-text` |

### Default LLM Settings (User-Configurable)

These are defaults when users haven't configured their own LLM settings in the app:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEFAULT_GENERATION_URL` | Default URL for text generation | `http://ollama:11434` |
| `DEFAULT_GENERATION_MODEL` | Default model for text generation | `llama3.1:8b` |
| `DEFAULT_EMBEDDING_URL` | Default URL for embeddings | `http://ollama:11434` |
| `DEFAULT_EMBEDDING_MODEL` | Default model for embeddings | `mxbai-embed-large` |

### Frontend Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_API_URL` | API URL for frontend | `http://localhost:8000` | `https://api.echovault.example.com` |

### Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `UPLOAD_DIR` | Directory for file uploads | `/data/uploads` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `GUNICORN_WORKERS` | Number of gunicorn workers (production) | `4` |

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
cp ../default.env .env
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
pnpm run dev
```

## Production Configuration

For production deployments, ensure you set:

1. **Security:**
   ```env
   JWT_SECRET=<generate with: openssl rand -hex 32>
   ```

2. **CORS:**
   ```env
   CORS_ORIGINS=https://your-frontend-domain.com
   ```

3. **Database (External):**
   ```env
   DATABASE_URL=postgresql+psycopg://user:password@host:5432/database?sslmode=require
   ```

4. **Redis (External):**
   ```env
   REDIS_URL=redis://default:password@host:6379
   ```

5. **Frontend API URL:**
   ```env
   NEXT_PUBLIC_API_URL=https://your-api-domain.com
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
   DEFAULT_GENERATION_URL=http://localhost:11434
   DEFAULT_EMBEDDING_URL=http://localhost:11434
   ```

2. **Use the override file:**
   ```bash
   cd infra
   docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
   ```

## Security Notes

- **Never commit `.env` files** to version control
- Use strong, random `JWT_SECRET` in production (minimum 32 bytes)
- Keep `default.env` updated with all available options
- Use different secrets for development and production
- Always use HTTPS in production

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
