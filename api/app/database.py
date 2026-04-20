from sqlalchemy import create_engine, event
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


# pgvector's IVFFlat index was created in migration 002 with lists=100, which
# targets ~10k entries. At the default probes=1, small datasets (or query
# vectors that hit sparsely-populated lists) return far fewer rows than
# expected — including zero — because ANN only scans one list.
# probes=10 buys much better recall with a modest latency hit; at larger
# scale this matches pgvector's own `probes ~ sqrt(lists)` guidance for
# lists=100.
@event.listens_for(engine, "connect")
def _set_pgvector_probes(dbapi_connection, _connection_record):
    # SET without LOCAL is session-scoped, but with psycopg autocommit=False
    # SQLAlchemy's pool does a ROLLBACK when the connection is returned, which
    # undoes any SET that ran inside the implicit transaction. Commit
    # explicitly so the GUC survives the pool's reset.
    with dbapi_connection.cursor() as cursor:
        cursor.execute("SET ivfflat.probes = 10")
    dbapi_connection.commit()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

