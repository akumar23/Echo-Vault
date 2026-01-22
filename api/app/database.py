from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Production-ready connection pool configuration
engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,      # Verify connections before use (handles stale connections)
    pool_size=5,             # Number of persistent connections
    max_overflow=10,         # Additional connections allowed beyond pool_size
    pool_recycle=300,        # Recycle connections after 5 minutes (handles server-side timeouts)
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

