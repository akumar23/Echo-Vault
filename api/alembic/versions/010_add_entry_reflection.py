"""Add per-entry reflection columns

Revision ID: 010
Revises: 009
Create Date: 2026-04-19 00:00:00.000000

Stores a reflection tied to a specific entry so each entry's detail page
can show its own AI-generated insight, persisted across visits.
"""
from alembic import op
import sqlalchemy as sa

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('entries', sa.Column('reflection', sa.Text(), nullable=True))
    op.add_column('entries', sa.Column('reflection_status', sa.String(length=16), nullable=True))
    op.add_column(
        'entries',
        sa.Column('reflection_generated_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('entries', 'reflection_generated_at')
    op.drop_column('entries', 'reflection_status')
    op.drop_column('entries', 'reflection')
