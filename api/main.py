import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, entries, search, insights, settings, forget, export, reflections, clusters
from app.services.ollama_service import ollama_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    Shutdown: Clean up resources (e.g., close httpx client in OllamaService)
    """
    # Startup
    logger.info("Application startup: initializing resources")
    yield
    # Shutdown
    logger.info("Application shutdown: cleaning up resources")
    await ollama_service.close()
    logger.info("OllamaService httpx client closed")


app = FastAPI(
    title="EchoVault API",
    description="Privacy-first journaling app with local LLMs",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - allow all localhost ports for development
import os
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001").split(",")
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
app.include_router(clusters.router)


@app.get("/health")
async def health():
    return {"status": "ok"}

