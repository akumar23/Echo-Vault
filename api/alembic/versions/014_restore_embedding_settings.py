"""Restore per-user embedding endpoint settings.

Revision ID: 014
Revises: 013
Create Date: 2026-08-22

The embedding pipeline (pgvector / entry_embeddings) stays gone. These
columns only store the user's chosen OpenAI-compatible embedding URL,
token, and model so Settings can list and save them the same way as
generation.
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("settings", sa.Column("embedding_url", sa.String(), nullable=True))
    op.add_column(
        "settings", sa.Column("embedding_api_token", sa.String(), nullable=True)
    )
    op.add_column("settings", sa.Column("embedding_model", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("settings", "embedding_model")
    op.drop_column("settings", "embedding_api_token")
    op.drop_column("settings", "embedding_url")
