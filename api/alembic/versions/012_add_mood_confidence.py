"""Add mood_confidence column to entries

Revision ID: 012
Revises: 011
Create Date: 2026-05-13 00:00:00.000000

LLM mood inference already emits a confidence label ("high"/"medium"/"low")
but the parser was discarding it. Persisting it on the entry row lets the
UI gate display of inferred mood badges so low-confidence guesses don't
masquerade as authoritative — a small but high-trust-ROI change.

Nullable: existing rows have no recorded confidence; the mood inference
job will populate it on next write, and a backfill is not required.
"""
from alembic import op
import sqlalchemy as sa

revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'entries',
        sa.Column('mood_confidence', sa.String(length=8), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('entries', 'mood_confidence')
