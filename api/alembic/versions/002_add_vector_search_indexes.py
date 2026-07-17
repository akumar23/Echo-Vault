"""Add entry filtering indexes

Revision ID: 002_add_vector_search_indexes
Revises: 001_initial_migration
Create Date: 2025-11-28

The revision ID is retained for migration compatibility. Vector indexes were
retired; this migration now creates only entry and tag filtering indexes.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
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

def downgrade():
    # Drop indexes in reverse order
    op.execute("DROP INDEX IF EXISTS idx_entries_active_user")
    op.execute("DROP INDEX IF EXISTS idx_entries_tags")
    op.execute("DROP INDEX IF EXISTS idx_entries_user_created")
