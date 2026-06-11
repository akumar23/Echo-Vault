# Environment Configuration

EchoVault gets its configuration from **environment variables** — `KEY=value` pairs the app reads when it starts. They live in a file called `.env` in the project root.

This doc explains every variable: what it does, what it defaults to, and when you would change it.

If "what's a `.env` file?" is your first question, read on — that's the next section.

---

## What is a `.env` file?

A `.env` file is just a text file that looks like this:

```env
JWT_SECRET=abc123...
DATABASE_URL=postgresql://user:pass@localhost/mydb
LOG_LEVEL=INFO
```

It's not source code. It's not committed to git (it's listed in `.gitignore`). It's a private place to put secrets and per-machine settings — your password to the database, the random string that signs login tokens, which port to run on, and so on.

When EchoVault starts, three different things read this file:

1. **Docker Compose** — for variables that need to go into multiple containers at once.
2. **The FastAPI backend** — reads it via Pydantic Settings.
3. **The Next.js frontend** — reads `NEXT_PUBLIC_*` variables at build time.

The repo ships a template called `default.env`. Copy it to `.env` and fill in the blanks:

```bash
cp default.env .env
```

Then edit `.env`. The bare minimum to change is `JWT_SECRET`. Generate a real one with:

```bash
openssl rand -hex 32
```

---

## Configuration files in this repo

| File | Read by | When to use |
|---|---|---|
| `.env` | Docker Compose, all services | The main one. Use this for `docker compose up`. |
| `api/.env` | FastAPI when run locally | Optional. Falls back to root `.env` if absent. |
| `app/.env.local` | Next.js when run locally | Optional. Set `NEXT_PUBLIC_API_URL` here. |

Inside Docker, the API and worker containers also load `../.env` automatically (this is wired up in `infra/docker-compose.yml`).

---

## Variables, grouped by purpose

### Security (required)

| Variable | Default | What it does |
|---|---|---|
| `JWT_SECRET` | `change_me` (placeholder!) | The random string used to sign login tokens. **You must change this.** Generate with `openssl rand -hex 32`. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (1 week in Docker, `15` in compose default) | How long a login session lasts before the user has to log in again. |
| `ENCRYPTION_KEY` | *(empty — encryption off in dev)* | Fernet key used to encrypt **entry title, content, and reflection** plus **LLM API tokens** before they are stored in Postgres. **Required when `ENV=production`.** Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Back this key up outside the repo — losing it means encrypted journal text cannot be recovered. |
| `ENV` | *(unset)* | Set to `production` on deployed hosts. Enables stricter checks (including refusing to start without `ENCRYPTION_KEY`). |

**Neon / hosted Postgres:** set `DATABASE_URL` to your Neon connection string **and** set `ENCRYPTION_KEY` on the API and Celery worker. New entries are encrypted automatically; for rows created before encryption was enabled, run `python scripts/encrypt_existing_entries.py` from the `api/` directory (with the same `ENCRYPTION_KEY` loaded).

### CORS (required for production)

CORS — Cross-Origin Resource Sharing — is the browser's safety check that says "the API at example.com is only allowed to be called from the website at app.example.com, not from random other sites."

| Variable | Default | What it does |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Comma-separated list of websites allowed to call the API. In production, set this to your real frontend URL. |

Production example:

```env
CORS_ORIGINS=https://echovault.example.com,https://www.echovault.example.com
```

### Database

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://echovault:echovault@db:5432/echovault` | Where to find PostgreSQL. The `+psycopg` bit tells SQLAlchemy to use the v3 driver. |
| `POSTGRES_USER` | `echovault` | Used by the `db` container to create the user on first start. |
| `POSTGRES_PASSWORD` | `echovault` | Same — for first-time setup of the `db` container. |
| `POSTGRES_DB` | `echovault` | The database name to create. |

For external databases (Neon, Supabase, etc.), use a connection string with SSL:

```env
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db?sslmode=require
```

### Redis

| Variable | Default | What it does |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379/0` | The Celery broker and reflection cache. The hostname is the Docker service name `redis`, not `localhost`. |

For external Redis providers like Upstash, prefer a TLS URL: `rediss://` (note the double `s`).

### Default LLM settings (server-wide)

These are the **defaults** used when a user has not configured their own LLM endpoints in the Settings page. Each user can override them.

| Variable | Default | What it does |
|---|---|---|
| `DEFAULT_GENERATION_URL` | `http://ollama:11434` | Where to send chat / reflection / mood / insights prompts. |
| `DEFAULT_GENERATION_MODEL` | `llama3.1:8b` | Which model to use for generation. |
| `DEFAULT_EMBEDDING_URL` | `http://ollama:11434` | Where to generate vector embeddings. |
| `DEFAULT_EMBEDDING_MODEL` | `mxbai-embed-large` | Which model produces 1024-dim vectors. |

These work with anything OpenAI-compatible. Examples:

```env
# Local Ollama (default)
DEFAULT_GENERATION_URL=http://ollama:11434
DEFAULT_GENERATION_MODEL=llama3.1:8b

# OpenAI
DEFAULT_GENERATION_URL=https://api.openai.com/v1
DEFAULT_GENERATION_MODEL=gpt-4o-mini
```

When using a cloud provider, the user must also set an **API token** in the in-app Settings page (server defaults intentionally have no token slot).

### Restricting user-supplied LLM endpoints (SSRF guard)

Users can point their LLM endpoints at any URL, and the backend fetches those URLs server-side (both the connection test and the background jobs). On a self-hosted single-user box that is exactly what you want — it lets you reach a local Ollama. On a **hosted, multi-user** deployment it is an SSRF risk: a user could aim the backend at internal services.

| Variable | Default | What it does |
|---|---|---|
| `RESTRICT_LLM_ENDPOINTS` | `false` | When `true`, blocks user-supplied LLM URLs that resolve to loopback or private ranges, leaving only public hosts. |

Link-local / cloud-metadata ranges (e.g. `169.254.169.254`) are **always blocked**, regardless of this flag. Server defaults (`DEFAULT_*_URL`) are operator-chosen and are never subject to the guard.

- **Self-hosted / single-user (default):** leave `false` so `localhost` / `host.docker.internal` / LAN Ollama work.
- **Hosted / multi-user:** set `true`.

```env
RESTRICT_LLM_ENDPOINTS=true
```

### Legacy LLM variables

These older variables are still read for backward compatibility:

| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_URL` | `http://ollama:11434` | Older alias used by some code paths. |
| `REFLECTION_MODEL` | `llama3.1:8b` | Legacy alias. |
| `EMBED_MODEL` | `mxbai-embed-large` | Legacy alias. |

You can usually leave these alone. New deployments should rely on the `DEFAULT_*` variables above.

### Frontend

| Variable | Default | What it does |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | The backend URL the browser should call. The `NEXT_PUBLIC_` prefix is required — it tells Next.js this value is safe to ship to the browser. |
| `API_PROXY_URL` | `http://api:8000` | The backend URL the Next.js server uses internally for rewrites/proxy. Use the Docker service name, not `localhost`. |

### Server / runtime

| Variable | Default | What it does |
|---|---|---|
| `UPLOAD_DIR` | `/data/uploads` | Where attachment files are stored on disk. Mapped to a Docker volume. |
| `LOG_LEVEL` | `INFO` | One of `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. |
| `GUNICORN_WORKERS` | `4` | Production only — how many gunicorn worker processes to run. Rule of thumb: 2-4 × CPU cores. |
| `API_CMD` | `sh -c "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"` | The command the `api` container runs. Override for production (gunicorn). |

---

## How EchoVault loads configuration

### Docker Compose

The `.env` file at the project root is loaded automatically:

```bash
cd infra
docker compose up -d
```

Variables flow through to each container via the `env_file` and `environment` blocks in `docker-compose.yml`.

### FastAPI (local development)

When you run the backend directly with `uvicorn`, it looks for `.env` files in this order:

1. `api/.env` (if present)
2. `.env` at the project root (if present)
3. Actual environment variables (`export FOO=bar`)
4. Defaults baked into the code

```bash
cd api
cp ../default.env .env       # local copy
# Edit .env — for example, point Ollama at localhost
# OLLAMA_URL=http://localhost:11434
uvicorn main:app --reload
```

### Next.js (local development)

Next.js reads `app/.env.local` for local dev:

```bash
cd app
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
pnpm run dev
```

Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Everything else stays server-side.

---

## Production checklist

Before deploying to production, set:

```env
# 1. A real JWT secret (never commit this)
JWT_SECRET=$(openssl rand -hex 32)

# 2. Real CORS origins
CORS_ORIGINS=https://your-frontend-domain.com

# 3. External database with SSL
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db?sslmode=require

# 4. External Redis (prefer TLS)
REDIS_URL=rediss://default:pass@host:6379

# 5. Production frontend URL
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

For the full Vercel + Railway/Render/Fly.io walkthrough, see [DEPLOYMENT_VERCEL.md](DEPLOYMENT_VERCEL.md).

---

## Changing the LLM models

To switch to a different Ollama model:

```bash
# Pull the new model
ollama pull llama3.1:70b
ollama pull nomic-embed-text

# Update your .env
DEFAULT_GENERATION_MODEL=llama3.1:70b
DEFAULT_EMBEDDING_MODEL=nomic-embed-text

# Restart the services that read those values
cd infra
docker compose restart api worker
```

> Note: changing the embedding model means existing embeddings won't match new queries (different model, different vector space). You'll need to re-embed everything for search to work properly.

---

## Running Ollama outside Docker

If you'd rather run Ollama natively on your host (faster on Apple Silicon, for instance):

1. Update your `.env`:
   ```env
   OLLAMA_URL=http://localhost:11434
   DEFAULT_GENERATION_URL=http://localhost:11434
   DEFAULT_EMBEDDING_URL=http://localhost:11434
   ```

2. Start Compose with the override file that disables the bundled Ollama service:
   ```bash
   cd infra
   docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
   ```

   On Linux, you may need to use `host.docker.internal` instead of `localhost` so the API container can reach the host. On Mac/Windows it works out of the box.

---

## Security notes

- **Never commit `.env` to version control.** It's in `.gitignore` already — keep it that way.
- **Rotate `JWT_SECRET` periodically** and any time you suspect a leak. Doing so invalidates all existing sessions.
- **Use different secrets** for development and production. Never let dev secrets touch production.
- **Use HTTPS in production**, always. JWTs in cookies and tokens in WebSocket query strings are both stealable over plain HTTP.
- **Cloud LLM tokens** (OpenAI, Groq) are stored per-user in the database, encrypted-at-rest is your responsibility — use a database that supports it.

---

## Generating secrets

A 32-byte (64-hex-character) secret is the safe minimum:

```bash
# OpenSSL (any OS with OpenSSL)
openssl rand -hex 32

# Python
python -c "import secrets; print(secrets.token_hex(32))"

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Where to go next

- [SETUP.md](../SETUP.md) — full first-time install
- [DEPLOYMENT_VERCEL.md](DEPLOYMENT_VERCEL.md) — production deployment
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the services use these variables
