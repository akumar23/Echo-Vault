"""Fix boolean defaults for is_deleted and is_active columns

Revision ID: 007
Revises: 006
Create Date: 2025-01-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Fix existing NULL values in entries table
    op.execute("UPDATE entries SET is_deleted = false WHERE is_deleted IS NULL")

    # Fix existing NULL values in entry_embeddings table
    op.execute("UPDATE entry_embeddings SET is_active = true WHERE is_active IS NULL")

    # Alter columns to have server defaults and be non-nullable
    op.alter_column('entries', 'is_deleted',
                    existing_type=sa.Boolean(),
                    server_default=sa.text('false'),
                    nullable=False)

    op.alter_column('entry_embeddings', 'is_active',
                    existing_type=sa.Boolean(),
                    server_default=sa.text('true'),
                    nullable=False)


def downgrade() -> None:
    # Remove server defaults and make nullable again
    op.alter_column('entries', 'is_deleted',
                    existing_type=sa.Boolean(),
                    server_default=None,
                    nullable=True)

    op.alter_column('entry_embeddings', 'is_active',
                    existing_type=sa.Boolean(),
                    server_default=None,
                    nullable=True)
