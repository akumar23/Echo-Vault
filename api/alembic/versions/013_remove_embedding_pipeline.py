"""Remove the embedding pipeline and pgvector storage.

Revision ID: 013
Revises: 012
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS entry_embeddings CASCADE")
    op.execute("DROP EXTENSION IF EXISTS vector")
    op.drop_column("settings", "embedding_model")
    op.drop_column("settings", "embedding_api_token")
    op.drop_column("settings", "embedding_url")


def downgrade() -> None:
    # Vectors were derived data and cannot be restored. Re-add only the former
    # configuration columns so a code downgrade can start.
    op.add_column("settings", sa.Column("embedding_url", sa.String(), nullable=True))
    op.add_column(
        "settings", sa.Column("embedding_api_token", sa.String(), nullable=True)
    )
    op.add_column("settings", sa.Column("embedding_model", sa.String(), nullable=True))
