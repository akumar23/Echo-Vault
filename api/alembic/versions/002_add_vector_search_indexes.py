"""add vector search indexes

Revision ID: 002_add_vector_search_indexes
Revises: 001_initial_migration
Create Date: 2025-11-28

This migration adds performance optimization indexes for semantic search:
- IVFFlat vector index for pgvector cosine distance operations
- Composite indexes for filtering and joins
- GIN index for tag search
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # Create IVFFlat index for vector similarity search
    # Lists parameter (100) is optimized for ~10,000 entries
    # Adjust based on expected dataset size: sqrt(row_count) is a good rule of thumb
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_entry_embeddings_vector_cosine
        ON entry_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)

    # Composite index for filtering active embeddings
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_entry_embeddings_active
        ON entry_embeddings (entry_id, is_active)
        WHERE is_active = TRUE
    """)

    # Index for user filtering and date range queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_entries_user_created
        ON entries (user_id, created_at DESC)
        WHERE is_deleted = FALSE
    """)

    # GIN index for tag containment queries (requires jsonb_path_ops for JSON type)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_entries_tags
        ON entries USING GIN ((tags::jsonb) jsonb_path_ops)
    """)

    # Partial index for active entries (most common filter pattern)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_entries_active_user
        ON entries (user_id, id)
        WHERE is_deleted = FALSE
    """)

    # Note: VACUUM ANALYZE should be run manually after migration
    # It cannot run inside a transaction block
    # Run: VACUUM ANALYZE entry_embeddings; VACUUM ANALYZE entries;


def downgrade():
    # Drop indexes in reverse order
    op.execute("DROP INDEX IF EXISTS idx_entries_active_user")
    op.execute("DROP INDEX IF EXISTS idx_entries_tags")
    op.execute("DROP INDEX IF EXISTS idx_entries_user_created")
    op.execute("DROP INDEX IF EXISTS idx_entry_embeddings_active")
    op.execute("DROP INDEX IF EXISTS idx_entry_embeddings_vector_cosine")
