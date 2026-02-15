import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
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

# Debug: Log database URL (masked) to verify env var is loaded
_db_url = os.getenv("DATABASE_URL", "NOT_SET")
_masked_url = _db_url[:30] + "..." if len(_db_url) > 30 else _db_url
logger.info(f"DATABASE_URL from env: {_masked_url}")

# Create tables
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified successfully")
except Exception as e:
    logger.error(f"Error creating database tables: {str(e)}", exc_info=True)


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
    """Health check endpoint that verifies database and Redis connectivity."""
    results = {"database": "unknown", "redis": "unknown"}
    errors = []

    # Check database
    try:
        db.execute(text("SELECT 1"))
        results["database"] = "connected"
    except Exception as e:
        results["database"] = "disconnected"
        errors.append(f"database: {str(e)}")
        logger.error(f"Health check - database failed: {e}")

    # Check Redis
    try:
        if reflection_cache.ping():
            results["redis"] = "connected"
        else:
            results["redis"] = "disconnected"
            errors.append("redis: ping failed")
    except Exception as e:
        results["redis"] = "disconnected"
        errors.append(f"redis: {str(e)}")
        logger.error(f"Health check - redis failed: {e}")

    all_healthy = all(v == "connected" for v in results.values())

    if all_healthy:
        return {"status": "ok", **results}
    else:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", **results, "errors": errors}
        )

