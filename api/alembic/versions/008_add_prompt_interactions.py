"""Add prompt_interactions table for tracking writing suggestion engagement

Revision ID: 008
Revises: 007
Create Date: 2026-01-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'prompt_interactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('prompt_text', sa.Text(), nullable=False),
        sa.Column('prompt_type', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('entry_id', sa.Integer(), nullable=True),
        sa.Column('source_entry_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['entry_id'], ['entries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_entry_id'], ['entries.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prompt_interactions_id'), 'prompt_interactions', ['id'], unique=False)
    op.create_index(op.f('ix_prompt_interactions_user_id'), 'prompt_interactions', ['user_id'], unique=False)
    op.create_index(op.f('ix_prompt_interactions_prompt_type'), 'prompt_interactions', ['prompt_type'], unique=False)
    op.create_index(op.f('ix_prompt_interactions_action'), 'prompt_interactions', ['action'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_prompt_interactions_action'), table_name='prompt_interactions')
    op.drop_index(op.f('ix_prompt_interactions_prompt_type'), table_name='prompt_interactions')
    op.drop_index(op.f('ix_prompt_interactions_user_id'), table_name='prompt_interactions')
    op.drop_index(op.f('ix_prompt_interactions_id'), table_name='prompt_interactions')
    op.drop_table('prompt_interactions')
