"""Add ollama_url to settings

Revision ID: 004
Revises: 003
Create Date: 2024-12-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('settings', sa.Column('ollama_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('settings', 'ollama_url')
