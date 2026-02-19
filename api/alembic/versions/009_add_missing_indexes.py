"""Add missing indexes for frequently queried columns

Revision ID: 009
Revises: 008
Create Date: 2026-02-19 00:00:00.000000

Performance optimization: Adding indexes on user_id and created_at columns
that are frequently used in WHERE and ORDER BY clauses but were missing indexes.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Index for insights table - frequently queried by user_id with created_at ordering
    op.create_index(
        'ix_insights_user_created',
        'insights',
        ['user_id', 'created_at'],
        unique=False
    )

    # Index for settings table - queried on every request needing user settings
    op.create_index(
        'ix_settings_user_id',
        'settings',
        ['user_id'],
        unique=True  # One settings row per user
    )


def downgrade() -> None:
    op.drop_index('ix_settings_user_id', table_name='settings')
    op.drop_index('ix_insights_user_created', table_name='insights')
