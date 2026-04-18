# Deploying EchoVault to Vercel

This guide covers deploying EchoVault to production using Vercel for the Next.js frontend, with the FastAPI backend and supporting services deployed to complementary platforms.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Database Setup (PostgreSQL with pgvector)](#database-setup-postgresql-with-pgvector)
4. [Redis Setup](#redis-setup)
5. [Backend Deployment](#backend-deployment)
6. [Ollama Considerations](#ollama-considerations)
7. [Frontend Deployment to Vercel](#frontend-deployment-to-vercel)
8. [Environment Variable Reference](#environment-variable-reference)
9. [Post-Deployment Verification](#post-deployment-verification)
10. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
11. [Security Checklist](#security-checklist)

---

## Architecture Overview

EchoVault is a multi-service application that requires careful consideration during deployment:

```
                                    +------------------+
                                    |     Vercel       |
                                    |  (Next.js 16)    |
                                    +--------+---------+
                                             |
                                             | HTTPS
                                             v
+------------------+              +------------------+              +------------------+
|   PostgreSQL     |<------------>|    FastAPI       |<------------>|      Redis       |
|   (pgvector)     |              |    Backend       |              |    (Celery)      |
+------------------+              +--------+---------+              +------------------+
                                           |
                                           | (Optional)
                                           v
                                  +------------------+
                                  |     Ollama       |
                                  |  (LLM Inference) |
                                  +------------------+
```

| Component | Recommended Platform | Purpose |
|-----------|---------------------|---------|
| Frontend | Vercel | Next.js 16 with App Router |
| Backend API | Railway, Render, or Fly.io | FastAPI with Celery workers |
| Database | Neon or Supabase | PostgreSQL 16 with pgvector |
| Cache/Queue | Upstash or Railway Redis | Celery broker |
| LLM | User's local Ollama or OpenAI-compatible API | AI inference |

---

## Prerequisites

Before starting deployment, ensure you have:

- [ ] A [Vercel account](https://vercel.com/signup)
- [ ] A [GitHub account](https://github.com) with the repository pushed
- [ ] Access to a managed PostgreSQL service (Neon, Supabase, or similar)
- [ ] Access to a managed Redis service (Upstash, Railway, or similar)
- [ ] Access to a platform for backend deployment (Railway, Render, or Fly.io)
- [ ] A generated JWT secret: `openssl rand -hex 32`

### Required Tools

```bash
# Verify Node.js installation (v20+ recommended)
node --version

# Verify pnpm installation
pnpm --version

# Generate a secure JWT secret
openssl rand -hex 32
```

---

## Database Setup (PostgreSQL with pgvector)

EchoVault requires PostgreSQL with the pgvector extension for vector similarity search. Choose one of the following providers:

### Option A: Neon (Recommended)

Neon provides serverless PostgreSQL with pgvector pre-installed.

1. **Create a Neon account** at [neon.tech](https://neon.tech)

2. **Create a new project**
   - Select the region closest to your backend deployment
   - Choose PostgreSQL 16

3. **Enable pgvector extension**
   ```sql
   -- Run in the Neon SQL Editor
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. **Copy the connection string**
   - Navigate to your project dashboard
   - Copy the connection string from the "Connection Details" panel
   - Format: `postgresql://user:password@host/database?sslmode=require`

5. **Convert to SQLAlchemy format**
   ```
   # Neon provides:
   postgresql://user:password@host/database?sslmode=require

   # Convert to (add +psycopg for async support):
   postgresql+psycopg://user:password@host/database?sslmode=require
   ```

### Option B: Supabase

Supabase also provides PostgreSQL with pgvector support.

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Enable pgvector extension**
   - Go to Database > Extensions
   - Search for "vector" and enable it

3. **Get the connection string**
   - Go to Settings > Database
   - Copy the "Connection string" (use the "URI" format)
   - Ensure you use the pooler connection for production

### Database Migration

After setting up your database, run migrations:

```bash
# Set your DATABASE_URL
export DATABASE_URL="postgresql+psycopg://user:password@host/database?sslmode=require"

# Run migrations from the api directory
cd api
alembic upgrade head
```

---

## Redis Setup

Redis is required for Celery task queue and result backend.

### Option A: Upstash (Recommended for Serverless)

Upstash provides serverless Redis with a generous free tier.

1. **Create an Upstash account** at [upstash.com](https://upstash.com)

2. **Create a Redis database**
   - Select the region closest to your backend
   - Choose the free tier for development or appropriate plan for production

3. **Copy the connection URL**
   - Navigate to your database details
   - Copy the "Redis URL" (starts with `redis://` or `rediss://` for TLS)

### Option B: Railway Redis

If deploying your backend to Railway, you can add Redis as a service:

1. Create a new Redis service in your Railway project
2. Railway will automatically provide the `REDIS_URL` environment variable

---

## Backend Deployment

The FastAPI backend cannot run on Vercel (which only supports serverless Node.js/Python functions). Deploy to one of these platforms:

### Option A: Railway (Recommended)

Railway provides a simple deployment experience with automatic builds.

1. **Create a Railway account** at [railway.app](https://railway.app)

2. **Create a new project**

3. **Deploy from GitHub**
   - Connect your GitHub repository
   - Select the repository containing EchoVault

4. **Configure the service**
   - Set the **Root Directory** to `api`
   - Set the **Build Command**: `pip install -r requirements.txt`
   - Set the **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

5. **Add environment variables** (see [Environment Variable Reference](#environment-variable-reference))

6. **Deploy Celery Worker** (separate service)
   - Create another service from the same repository
   - Set **Root Directory** to `api`
   - Set **Start Command**: `celery -A app.celery_app worker --loglevel=info`
   - Add the same environment variables

7. **Deploy Celery Beat** (separate service, optional for scheduled tasks)
   - Create another service from the same repository
   - Set **Root Directory** to `api`
   - Set **Start Command**: `celery -A app.celery_app beat --loglevel=info`
   - Add the same environment variables

### Option B: Render

1. **Create a Render account** at [render.com](https://render.com)

2. **Create a Web Service**
   - Connect your GitHub repository
   - Set **Root Directory** to `api`
   - Set **Build Command**: `pip install -r requirements.txt`
   - Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Create a Background Worker** for Celery
   - Create a new "Background Worker" service
   - Set **Root Directory** to `api`
   - Set **Build Command**: `pip install -r requirements.txt`
   - Set **Start Command**: `celery -A app.celery_app worker --loglevel=info`

### Option C: Fly.io

1. **Install the Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create a `fly.toml` in the `api` directory**
   ```toml
   app = "echovault-api"
   primary_region = "iad"  # Choose your region

   [build]
     dockerfile = "../infra/Dockerfile.api"

   [env]
     PORT = "8000"

   [http_service]
     internal_port = 8000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 1

   [[services]]
     protocol = "tcp"
     internal_port = 8000
     [[services.ports]]
       port = 80
       handlers = ["http"]
     [[services.ports]]
       port = 443
       handlers = ["tls", "http"]
   ```

3. **Deploy**
   ```bash
   cd api
   fly launch
   fly secrets set DATABASE_URL="..." REDIS_URL="..." JWT_SECRET="..."
   fly deploy
   ```

### Backend API URL

After deployment, note your backend URL:
- Railway: `https://your-app.up.railway.app`
- Render: `https://your-app.onrender.com`
- Fly.io: `https://your-app.fly.dev`

---

## Ollama Considerations

EchoVault is designed as a privacy-first application where AI processing happens locally via Ollama. For cloud deployment, you have several options:

### Option 1: User-Provided LLM Configuration (Recommended)

EchoVault supports user-configurable LLM endpoints. Users can:

1. **Run Ollama locally** and configure the app to use their local instance
2. **Use an OpenAI-compatible API** (OpenAI, Groq, Together.ai, etc.)

Users configure this in the Settings page:
- **Generation URL**: The LLM API endpoint (e.g., `http://localhost:11434` for local Ollama)
- **Generation Model**: Model name (e.g., `llama3.1:8b` or `gpt-4o`)
- **Embedding URL**: The embedding API endpoint
- **Embedding Model**: Embedding model name (e.g., `mxbai-embed-large` or `text-embedding-3-small`)

### Option 2: Default OpenAI-Compatible API

Configure the backend to use OpenAI or another cloud LLM provider as the default:

```bash
# In your backend environment variables
DEFAULT_GENERATION_URL=https://api.openai.com/v1
DEFAULT_GENERATION_MODEL=gpt-4o-mini
DEFAULT_EMBEDDING_URL=https://api.openai.com/v1
DEFAULT_EMBEDDING_MODEL=text-embedding-3-small
```

Note: This requires an API key and users should be informed that their data will be sent to a third-party service.

### Option 3: Self-Hosted Ollama

For organizations wanting to maintain the privacy-first approach:

1. **Deploy Ollama on a GPU instance** (AWS EC2 with GPU, GCP Compute Engine, etc.)
2. **Secure the endpoint** with authentication
3. **Configure the backend** to use this endpoint as the default

```bash
# Example for self-hosted Ollama
DEFAULT_GENERATION_URL=https://your-ollama-instance.com
DEFAULT_GENERATION_MODEL=llama3.1:8b
DEFAULT_EMBEDDING_URL=https://your-ollama-instance.com
DEFAULT_EMBEDDING_MODEL=mxbai-embed-large
```

### Privacy Implications

| Option | Data Privacy | Cost | Complexity |
|--------|-------------|------|------------|
| User's local Ollama | Highest (no data leaves device) | Free (user's hardware) | User must install Ollama |
| OpenAI-compatible API | Low (data sent to third party) | Pay per use | Simple |
| Self-hosted Ollama | High (your infrastructure) | GPU instance costs | Complex |

---

## Frontend Deployment to Vercel

### Step 1: Prepare the Repository

Ensure your repository is pushed to GitHub and the `app` directory contains your Next.js application.

### Step 2: Import to Vercel

1. **Log in to Vercel** at [vercel.com](https://vercel.com)

2. **Click "Add New" > "Project"**

3. **Import your GitHub repository**
   - Authorize Vercel to access your GitHub account
   - Select the EchoVault repository

### Step 3: Configure Project Settings

1. **Framework Preset**: Vercel should auto-detect Next.js

2. **Root Directory**: Set to `app`
   - Click "Edit" next to Root Directory
   - Enter `app`

3. **Build and Output Settings** (usually auto-detected):
   - Build Command: `pnpm run build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

4. **Node.js Version**: Select 20.x (LTS)

### Step 4: Configure Environment Variables

Click "Environment Variables" and add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend-url.com` | Production, Preview, Development |

Replace `https://your-backend-url.com` with your deployed backend URL from Railway, Render, or Fly.io.

### Step 5: Deploy

1. Click **"Deploy"**

2. Wait for the build to complete (typically 1-3 minutes)

3. Once deployed, Vercel will provide your production URL:
   - `https://your-project.vercel.app`

### Step 6: Configure Custom Domain (Optional)

1. Go to your project's **Settings > Domains**

2. Add your custom domain

3. Follow Vercel's instructions to configure DNS

### Step 7: Update Backend CORS

After deployment, update your backend's CORS configuration to allow requests from your Vercel domain:

```bash
# Add to your backend environment variables
CORS_ORIGINS=https://your-project.vercel.app,https://your-custom-domain.com
```

---

## Environment Variable Reference

### Backend (FastAPI) Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql+psycopg://user:pass@host/db?sslmode=require` |
| `REDIS_URL` | Yes | Redis connection URL | `redis://default:pass@host:6379` |
| `JWT_SECRET` | Yes | Secret for JWT tokens (generate with `openssl rand -hex 32`) | `a1b2c3d4...` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token expiration (default: 10080 = 1 week) | `10080` |
| `CORS_ORIGINS` | Yes | Allowed origins (comma-separated) | `https://your-app.vercel.app` |
| `DEFAULT_GENERATION_URL` | No | Default LLM API URL | `http://localhost:11434` |
| `DEFAULT_GENERATION_MODEL` | No | Default LLM model | `llama3.1:8b` |
| `DEFAULT_EMBEDDING_URL` | No | Default embedding API URL | `http://localhost:11434` |
| `DEFAULT_EMBEDDING_MODEL` | No | Default embedding model | `mxbai-embed-large` |
| `UPLOAD_DIR` | No | File upload directory | `/data/uploads` |

### Frontend (Next.js) Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL | `https://your-api.railway.app` |

---

## Post-Deployment Verification

After deploying all services, verify each component:

### 1. Database Connection

```bash
# Test from your local machine with the production DATABASE_URL
psql "postgresql://user:pass@host/db?sslmode=require" -c "SELECT 1;"

# Verify pgvector extension
psql "postgresql://user:pass@host/db?sslmode=require" -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### 2. Backend Health Check

```bash
# Replace with your backend URL
curl https://your-api.railway.app/health
# Expected: {"status":"ok"}
```

### 3. Backend API Documentation

Open in browser: `https://your-api.railway.app/docs`

You should see the FastAPI Swagger documentation.

### 4. Frontend Deployment

1. Open your Vercel URL: `https://your-project.vercel.app`

2. Verify the page loads without errors

3. Open browser DevTools > Network tab and verify API requests go to the correct backend URL

### 5. End-to-End Test

1. **Register a new user** on the deployed frontend

2. **Create a journal entry**

3. **Verify the entry appears** in the entries list

4. **Test search functionality** (requires embeddings to be generated)

5. **Check Celery worker logs** in your backend deployment platform to verify background tasks are processing

### Verification Checklist

- [ ] Database migrations completed successfully
- [ ] Backend `/health` endpoint returns `{"status":"ok"}`
- [ ] Backend `/docs` page loads
- [ ] Frontend loads without console errors
- [ ] User registration works
- [ ] User login works
- [ ] Creating entries works
- [ ] Celery workers are processing tasks (check logs)
- [ ] Search returns results (after embeddings are generated)

---

## Common Issues and Troubleshooting

### Issue: CORS Errors

**Symptoms**: Browser console shows "Access to fetch at ... has been blocked by CORS policy"

**Solution**:
1. Verify `CORS_ORIGINS` environment variable in the backend includes your frontend URL
2. Ensure the URL matches exactly (including `https://` and no trailing slash)
3. Restart the backend service after updating environment variables

```bash
# Correct format
CORS_ORIGINS=https://your-project.vercel.app,https://custom-domain.com

# Incorrect (trailing slash)
CORS_ORIGINS=https://your-project.vercel.app/
```

### Issue: Database Connection Errors

**Symptoms**: Backend fails to start with database connection errors

**Solutions**:
1. Verify the `DATABASE_URL` format includes `+psycopg` for SQLAlchemy:
   ```
   postgresql+psycopg://user:pass@host/db?sslmode=require
   ```
2. Ensure SSL mode is enabled (`?sslmode=require`)
3. Check if your database provider requires IP allowlisting

### Issue: Migrations Fail

**Symptoms**: `alembic upgrade head` fails

**Solutions**:
1. Ensure pgvector extension is enabled:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. Verify database credentials have sufficient permissions
3. Check for existing tables that might conflict

### Issue: Celery Workers Not Processing

**Symptoms**: Journal entries don't get embeddings, insights don't generate

**Solutions**:
1. Verify Redis connection URL is correct
2. Check Celery worker logs for errors
3. Ensure workers have the same environment variables as the API

```bash
# View worker logs on Railway
railway logs --service worker

# View worker logs on Render
# Check the Render dashboard > Background Worker > Logs
```

### Issue: Frontend Shows "Network Error"

**Symptoms**: API calls fail with network errors

**Solutions**:
1. Verify `NEXT_PUBLIC_API_URL` is set correctly in Vercel
2. Check that the backend is running and accessible
3. Verify the backend URL uses HTTPS
4. Check backend CORS configuration

### Issue: Authentication Failures

**Symptoms**: Login works but subsequent requests fail with 401/403

**Solutions**:
1. Verify `JWT_SECRET` is the same across all backend services (API, worker, beat)
2. Check `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` is set appropriately
3. Clear browser localStorage and try logging in again

### Issue: Embeddings/Reflections Not Working

**Symptoms**: Search returns no results, reflections don't generate

**Solutions**:
1. Check if users have configured their LLM settings
2. Verify the default LLM configuration if using cloud LLMs:
   ```bash
   DEFAULT_GENERATION_URL=https://api.openai.com/v1
   DEFAULT_GENERATION_MODEL=gpt-4o-mini
   ```
3. Check Celery worker logs for LLM connection errors

### Issue: Vercel Build Fails

**Symptoms**: Deployment fails during build

**Solutions**:
1. Verify `app` is set as the Root Directory
2. Check that `pnpm-lock.yaml` exists in the `app` directory
3. Ensure Node.js version is set to 20.x
4. Review build logs for specific errors

### Debugging Tips

1. **Check logs first**: Most issues are visible in service logs
   - Railway: `railway logs`
   - Render: Dashboard > Service > Logs
   - Vercel: Dashboard > Project > Functions/Deployments > Logs

2. **Test locally with production config**: Run the app locally with production environment variables to isolate issues

3. **Use the `/health` endpoint**: A failing health check indicates backend configuration issues

4. **Check browser DevTools**: Network tab shows failed requests and their responses

---

## Security Checklist

Before going to production, verify:

- [ ] `JWT_SECRET` is a strong, randomly generated value (64+ characters)
- [ ] `JWT_SECRET` is NOT committed to version control
- [ ] Database credentials are stored as environment variables
- [ ] HTTPS is enforced on all endpoints
- [ ] CORS is configured to allow only your frontend domain(s)
- [ ] Database has SSL mode enabled (`sslmode=require`)
- [ ] Redis connection uses TLS if available (`rediss://`)
- [ ] No default/example credentials in production configuration
- [ ] API rate limiting is configured (if applicable)
- [ ] Users are informed about data privacy implications of cloud LLM usage

---

## Related Documentation

- [Environment Configuration Reference](./ENV_CONFIG.md)
- [API Documentation](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)

---

## Support

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/your-repo/echovault/issues) for similar problems
2. Review the application logs for error details
3. Create a new issue with:
   - Deployment platform details
   - Error messages from logs
   - Steps to reproduce
