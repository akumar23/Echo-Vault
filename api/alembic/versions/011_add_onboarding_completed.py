"""Add onboarding_completed flag to settings

Revision ID: 011
Revises: 010
Create Date: 2026-04-30 00:00:00.000000

Tracks whether a user has dismissed or completed the first-time LLM
configuration prompt. Defaults to True for existing users so they don't
suddenly see the onboarding modal on next login.
"""
from alembic import op
import sqlalchemy as sa

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'settings',
        sa.Column(
            'onboarding_completed',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Existing users have already seen the app — mark them complete so the
    # modal only fires for genuinely new accounts.
    op.execute("UPDATE settings SET onboarding_completed = TRUE")


def downgrade() -> None:
    op.drop_column('settings', 'onboarding_completed')
