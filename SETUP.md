# Setup Guide

This is the long version of the install guide, written for someone who has never run a Dockerized project before. If you are already comfortable with Docker, skim the [Quick start in README.md](README.md#quick-start) instead.

By the end of this guide, you will have EchoVault running at `http://localhost:3000`, with all six backing services started by a single command.

---

## What you need first

You need three things installed on your machine:

1. **Git** — to download the source code.
2. **Docker Desktop** — to run the services. Download from [docker.com](https://www.docker.com/products/docker-desktop/). Start it after install; you should see a whale icon in your menu bar / system tray.
3. **Ollama** — to run the local AI model. Download from [ollama.com](https://ollama.com).

That's it. You do not need to install Python, Node.js, or PostgreSQL on your laptop. Docker handles all of those inside containers (see the [Glossary in README](README.md#glossary)).

### Verifying the prerequisites

Open a terminal and run:

```bash
git --version
docker --version
docker compose version
ollama --version
```

You should see a version number from each. If `docker compose version` fails but `docker --version` works, your Docker is too old — update Docker Desktop. (Old versions used `docker-compose` with a hyphen; the new one is two words.)

---

## Step 1: Get the code

```bash
git clone <repo-url>
cd echo-vault
```

Replace `<repo-url>` with the actual repository URL. Once cloned, all commands below assume you are inside the project root unless otherwise noted.

---

## Step 2: Set up your config file

Apps like EchoVault read their configuration from a file called `.env` (short for "environment"). The repository ships a template called `default.env`. Copy it:

```bash
cp default.env .env
```

Now open `.env` in any text editor. The most important line to change is:

```env
JWT_SECRET=your-secret-key-here-generate-with-openssl-rand-hex-32
```

This is a random string the app uses to sign your login tokens. Generate a real one:

```bash
openssl rand -hex 32
```

That prints a 64-character hex string. Paste it after `JWT_SECRET=` and save the file.

For local development, the rest of the defaults are fine. If you are curious what every variable does, see [docs/ENV_CONFIG.md](docs/ENV_CONFIG.md).

> Important: never commit your `.env` file to git. It is already listed in `.gitignore`.

---

## Step 3: Pull the AI models

Ollama needs to download the generation model before EchoVault can use it.

```bash
ollama pull llama3.1:8b
```

| Model | Used for | Size |
|---|---|---|
| `llama3.1:8b` | Reflections, mood inference, chat | ~4.7 GB |

Verify the models are present:

```bash
ollama list
```

You should see `llama3.1:8b` in the output.

---

## Step 4: Start the services

Now the fun part. From inside the `infra` directory, run:

```bash
cd infra
docker compose up -d
```

Here is what each piece of that command means:

- `docker compose` — the tool for running a group of containers together.
- `up` — start the services defined in `docker-compose.yml`.
- `-d` — "detached" mode: run in the background so you can keep using your terminal.

The first time you run this, Docker will download a few base images and build two custom ones (the API and the web app). This takes 2-5 minutes depending on your internet. On later runs it is near-instant.

When it finishes, six containers are running:

| Container | Port | Purpose |
|---|---|---|
| `echovault_web` | 3000 | The Next.js frontend (the website you'll visit). |
| `echovault_api` | 8000 | The FastAPI backend (handles all data and login). |
| `echovault_worker` | — | A Celery worker that runs background AI jobs. |
| `echovault_db` | 5432 | PostgreSQL. |
| `echovault_redis` | 6379 | The job queue and cache. |
| `echovault_ollama` | 11434 | Local LLM inference. |

Check they are all running:

```bash
docker compose ps
```

Every row should say `running` and the `db`, `redis`, and `ollama` rows should say `healthy`. If any container is missing or restarting, see [Troubleshooting](#troubleshooting) below.

---

## Step 5: Database migrations

The first time you start the API, it automatically runs the database migrations (this is configured in `docker-compose.yml` — the API command is `alembic upgrade head && uvicorn ...`). So you usually don't have to do anything here.

If you ever need to run migrations manually — for example after pulling new code that adds a column — do:

```bash
docker compose exec api alembic upgrade head
```

What this does, in plain language: `docker compose exec api` means "run the next command inside the running `api` container". `alembic upgrade head` is the migration tool that brings the database schema up to the latest version.

---

## Step 6: Open the app

Navigate to:

- **App:** http://localhost:3000
- **API health check:** http://localhost:8000/health
- **Interactive API docs:** http://localhost:8000/docs

The first time you visit, you will be sent to a registration page. Create an account (it's stored locally — there is no email verification). Log in. Write your first entry.

Within a few seconds, the background worker should generate an embedding and infer a mood for your entry. You can verify by opening the entry and seeing the mood badge fill in, or by using the search to look for similar entries.

---

## Step 7: Verify everything works

A few quick health checks:

```bash
# API is alive
curl http://localhost:8000/health
# Expected: {"status":"ok","database":"connected"}

# Ollama has the right models
curl http://localhost:11434/api/tags

# Worker is processing jobs (look for log lines about embedding tasks)
docker compose logs worker --tail=50
```

If the API health check returns `503 unhealthy`, the database container is not reachable yet — wait 10 seconds and try again, or check `docker compose logs db`.

---

## Stopping and starting

```bash
# Stop everything (data is preserved)
cd infra
docker compose down

# Start it again later
docker compose up -d

# Stop AND wipe all data (database, Redis, uploaded files)
docker compose down -v
```

The `-v` flag removes the named volumes, which is where your journal entries actually live. Use it carefully.

---

## Local development (editing code with hot-reload)

The Docker setup is for "I just want to use the app". When you are editing code, you usually want hot-reload — the app restarting automatically when you save a file.

You can run the frontend and backend directly on your machine while leaving the database, Redis, and Ollama running in Docker.

### Backend with hot-reload

In one terminal, leave the supporting services running in Docker:

```bash
cd infra
docker compose up -d db redis ollama
```

In another terminal:

```bash
cd api
pip install -r requirements.txt
# Point the API at the Docker services running on localhost
export DATABASE_URL="postgresql+psycopg://echovault:echovault@localhost:5432/echovault"
export REDIS_URL="redis://localhost:6379/0"
export OLLAMA_URL="http://localhost:11434"
uvicorn main:app --reload
```

`--reload` watches your Python files and restarts the server when you save.

### Frontend with hot-reload

```bash
cd app
pnpm install
pnpm run dev
```

The frontend calls the backend at the URL in `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).

### Running tests

```bash
# Backend
cd api && pytest

# A single backend test
cd api && pytest tests/test_auth.py::test_register -v

# Frontend end-to-end
cd app && pnpm exec playwright test

# A single frontend test
cd app && pnpm exec playwright test tests/example.spec.ts
```

### Linting

```bash
cd app && pnpm run lint
```

---

## Troubleshooting

### `docker compose up -d` fails immediately

Make sure Docker Desktop is actually running (whale icon in your menu bar / system tray). If you see "Cannot connect to the Docker daemon", that is what's wrong.

### A port is already in use

Error like `bind: address already in use`. Something else on your machine is using one of these ports: 3000, 5432, 6379, 8000, or 11434. Stop that process, or edit `infra/docker-compose.yml` to use a different port mapping.

### `db` container keeps restarting

Usually means the data volume has been corrupted by a previous failed start. Wipe and try again:

```bash
docker compose down -v
docker compose up -d
```

You will lose any journal entries — that is the trade-off for a clean slate.

### API is up but I can't log in

Check that `JWT_SECRET` in `.env` is set (not the placeholder). After changing `.env`, restart the API:

```bash
docker compose restart api worker
```

### Mood or reflections never get generated

The worker container generates them. Check its logs:

```bash
docker compose logs worker --tail=100
```

Common causes:
- Ollama is not reachable. Inside the worker, the URL is `http://ollama:11434` (the container name, not `localhost`).
- The generation model isn't pulled. Run `ollama list` and confirm `llama3.1:8b` is there.
- The user has bad LLM settings configured in the app. Reset them in Settings, or for a brand-new install they fall back to the `DEFAULT_*` values from `.env`.

### Frontend shows "Network Error"

The frontend cannot reach the API. Check:
1. The API is up: `curl http://localhost:8000/health`
2. `NEXT_PUBLIC_API_URL` in `.env` points to the right place (usually `http://localhost:8000`)
3. CORS allows your frontend origin (`CORS_ORIGINS` in `.env`)

### "I want to start over"

```bash
cd infra
docker compose down -v          # delete all containers AND data volumes
docker system prune -f          # free up disk space from old images
docker compose up -d --build    # rebuild from scratch
```

---

## What to do next

- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand how the pieces fit together.
- Read [docs/FEATURES.md](docs/FEATURES.md) for a tour of what the app actually does.
- Read [docs/ENV_CONFIG.md](docs/ENV_CONFIG.md) when you want to tune configuration.
- When you are ready to deploy publicly, see [docs/DEPLOYMENT_VERCEL.md](docs/DEPLOYMENT_VERCEL.md).

---

## Mini glossary (quick reference)

- **Container** — a sealed environment running one program. Started by Docker.
- **Docker Compose** — runs a group of containers together with one command.
- **`.env` file** — text file with `KEY=value` pairs the app reads at startup.
- **Port** — a number identifying a network service. Frontend = 3000, API = 8000.
- **Migration** — a script that updates the database schema.
- **LLM** — Large Language Model. The AI that reads and writes text.
- **Embedding** — a list of numbers representing the meaning of a piece of text.

The full glossary lives in the [README](README.md#glossary).
