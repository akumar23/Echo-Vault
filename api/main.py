import logging
import os
import re
import time
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.rate_limit import limiter
from app.database import engine, Base, get_db
from app.routers import auth, entries, search, insights, settings, forget, export, reflections, chat, prompts
from app.services.reflection_cache import reflection_cache

# Configure logging with environment-based level
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Strip "scheme://user:pass@host" credentials before logging any URL or exception
_CREDS_IN_URL_RE = re.compile(r"://[^/\s@]+@")


def _scrub_creds(text_value: str) -> str:
    """Remove 'user:pass@' userinfo from any URL-like substrings."""
    return _CREDS_IN_URL_RE.sub("://", text_value)


def _safe_db_url_summary(raw: str) -> str:
    """Return a scheme://host/database summary of the DB URL with userinfo stripped."""
    if not raw or raw == "NOT_SET":
        return "NOT_SET"
    try:
        parsed = urlparse(raw)
        host = parsed.hostname or "?"
        port = f":{parsed.port}" if parsed.port else ""
        db = parsed.path.lstrip("/") or ""
        scheme = parsed.scheme or "?"
        return f"{scheme}://{host}{port}/{db}"
    except Exception:
        return "unparseable"


# Log DB connection target (scheme + host + database only, never userinfo)
logger.info("DATABASE_URL target: %s", _safe_db_url_summary(os.getenv("DATABASE_URL", "NOT_SET")))

# Rate limiter for health-check failure logs to avoid flooding during outages.
_HEALTH_LOG_INTERVAL_SECONDS = 60
_health_log_state: dict[str, float] = {}


def _should_log_health_failure(check: str) -> bool:
    """Return True if it's been >60s since the last logged failure for `check`."""
    now = time.monotonic()
    last = _health_log_state.get(check, 0.0)
    if now - last >= _HEALTH_LOG_INTERVAL_SECONDS:
        _health_log_state[check] = now
        return True
    return False

# Schema is managed exclusively by Alembic migrations.
# Run `alembic upgrade head` before starting the server (handled by docker-compose entrypoint).
# create_all() is intentionally removed to prevent silent schema drift.


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifespan events.
    Startup: Initialize resources
    Shutdown: Clean up resources
    """
    # Startup
    logger.info("Application startup: initializing resources")
    yield
    # Shutdown
    logger.info("Application shutdown: cleaning up resources")


app = FastAPI(
    title="EchoVault API",
    description="Privacy-first journaling app with local LLMs",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS middleware configuration
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    # Default to localhost for development only
    cors_origins = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]
    logger.warning("CORS_ORIGINS not set - using localhost defaults. Set CORS_ORIGINS for production!")
logger.info(f"CORS origins: {cors_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(entries.router, prefix="/entries", tags=["entries"])
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(forget.router, prefix="/forget", tags=["forget"])
app.include_router(export.router, prefix="/export", tags=["export"])
app.include_router(reflections.router, prefix="/reflections", tags=["reflections"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(prompts.router, prefix="/prompts", tags=["prompts"])


@app.get("/health")
async def health(db: Session = Depends(get_db)):
    """Health check endpoint - database only to minimize Redis costs.

    Railway/Render hit this endpoint every 10-30 seconds.
    Use /health/full for complete health check including Redis.
    """
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        if _should_log_health_failure("db"):
            logger.exception("Health check: database unreachable")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected", "error": _scrub_creds(str(e))}
        )


@app.get("/health/full")
async def health_full(db: Session = Depends(get_db)):
    """Full health check including Redis. Use sparingly."""
    results = {"database": "unknown", "redis": "unknown"}
    errors = []

    try:
        db.execute(text("SELECT 1"))
        results["database"] = "connected"
    except Exception as e:
        results["database"] = "disconnected"
        errors.append(f"database: {_scrub_creds(str(e))}")
        if _should_log_health_failure("db"):
            logger.exception("Health check: database unreachable")

    try:
        if reflection_cache.ping():
            results["redis"] = "connected"
        else:
            results["redis"] = "disconnected"
            errors.append("redis: ping failed")
    except Exception as e:
        results["redis"] = "disconnected"
        errors.append(f"redis: {_scrub_creds(str(e))}")
        if _should_log_health_failure("redis"):
            logger.exception("Health check: redis unreachable")

    all_healthy = all(v == "connected" for v in results.values())

    if all_healthy:
        return {"status": "ok", **results}
    else:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", **results, "errors": errors}
        )

