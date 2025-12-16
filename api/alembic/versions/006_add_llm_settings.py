"""Add separate LLM settings for generation and embedding

Revision ID: 006
Revises: 005
Create Date: 2024-12-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add generation LLM settings
    op.add_column('settings', sa.Column('generation_url', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('generation_api_token', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('generation_model', sa.String(), nullable=True))

    # Add embedding LLM settings
    op.add_column('settings', sa.Column('embedding_url', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('embedding_api_token', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('embedding_model', sa.String(), nullable=True))

    # Migrate existing ollama_url to both generation and embedding URLs
    op.execute("""
        UPDATE settings
        SET generation_url = ollama_url, embedding_url = ollama_url
        WHERE ollama_url IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_column('settings', 'embedding_model')
    op.drop_column('settings', 'embedding_api_token')
    op.drop_column('settings', 'embedding_url')
    op.drop_column('settings', 'generation_model')
    op.drop_column('settings', 'generation_api_token')
    op.drop_column('settings', 'generation_url')
