"""Remove semantic clustering tables

Revision ID: 005
Revises: 004
Create Date: 2024-12-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove columns from entry_embeddings first
    op.drop_column('entry_embeddings', 'cluster_version')
    op.drop_column('entry_embeddings', 'last_clustered_at')

    # Drop tables in reverse order of creation (respecting foreign keys)
    op.drop_index(op.f('ix_cluster_transitions_transition_date'), table_name='cluster_transitions')
    op.drop_index(op.f('ix_cluster_transitions_user_id'), table_name='cluster_transitions')
    op.drop_index(op.f('ix_cluster_transitions_id'), table_name='cluster_transitions')
    op.drop_table('cluster_transitions')

    op.drop_index(op.f('ix_cluster_labels_cluster_id'), table_name='cluster_labels')
    op.drop_index(op.f('ix_cluster_labels_id'), table_name='cluster_labels')
    op.drop_table('cluster_labels')

    op.drop_index(op.f('ix_entry_cluster_memberships_snapshot_id'), table_name='entry_cluster_memberships')
    op.drop_index(op.f('ix_entry_cluster_memberships_cluster_id'), table_name='entry_cluster_memberships')
    op.drop_index(op.f('ix_entry_cluster_memberships_entry_id'), table_name='entry_cluster_memberships')
    op.drop_index(op.f('ix_entry_cluster_memberships_id'), table_name='entry_cluster_memberships')
    op.drop_table('entry_cluster_memberships')

    op.drop_index(op.f('ix_cluster_snapshots_snapshot_date'), table_name='cluster_snapshots')
    op.drop_index(op.f('ix_cluster_snapshots_user_id'), table_name='cluster_snapshots')
    op.drop_index(op.f('ix_cluster_snapshots_id'), table_name='cluster_snapshots')
    op.drop_table('cluster_snapshots')

    op.drop_index(op.f('ix_semantic_clusters_is_stale'), table_name='semantic_clusters')
    op.drop_index(op.f('ix_semantic_clusters_user_id'), table_name='semantic_clusters')
    op.drop_index(op.f('ix_semantic_clusters_id'), table_name='semantic_clusters')
    op.drop_table('semantic_clusters')


def downgrade() -> None:
    # Recreate semantic_clusters table
    op.create_table(
        'semantic_clusters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('cluster_algorithm', sa.String(50), default='hdbscan'),
        sa.Column('min_cluster_size', sa.Integer(), default=5),
        sa.Column('centroid', Vector(1024), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_semantic_clusters_id'), 'semantic_clusters', ['id'], unique=False)
    op.create_index(op.f('ix_semantic_clusters_user_id'), 'semantic_clusters', ['user_id'], unique=False)
    op.create_index(op.f('ix_semantic_clusters_is_stale'), 'semantic_clusters', ['is_stale'], unique=False)

    # Recreate cluster_snapshots table
    op.create_table(
        'cluster_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('snapshot_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('total_entries', sa.Integer(), nullable=False),
        sa.Column('total_clusters', sa.Integer(), nullable=False),
        sa.Column('noise_count', sa.Integer(), nullable=True),
        sa.Column('snapshot_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cluster_snapshots_id'), 'cluster_snapshots', ['id'], unique=False)
    op.create_index(op.f('ix_cluster_snapshots_user_id'), 'cluster_snapshots', ['user_id'], unique=False)
    op.create_index(op.f('ix_cluster_snapshots_snapshot_date'), 'cluster_snapshots', ['snapshot_date'], unique=False)

    # Recreate entry_cluster_memberships table
    op.create_table(
        'entry_cluster_memberships',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entry_id', sa.Integer(), nullable=False),
        sa.Column('cluster_id', sa.Integer(), nullable=False),
        sa.Column('membership_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('snapshot_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['entry_id'], ['entries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['cluster_id'], ['semantic_clusters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['snapshot_id'], ['cluster_snapshots.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_entry_cluster_memberships_id'), 'entry_cluster_memberships', ['id'], unique=False)
    op.create_index(op.f('ix_entry_cluster_memberships_entry_id'), 'entry_cluster_memberships', ['entry_id'], unique=False)
    op.create_index(op.f('ix_entry_cluster_memberships_cluster_id'), 'entry_cluster_memberships', ['cluster_id'], unique=False)
    op.create_index(op.f('ix_entry_cluster_memberships_snapshot_id'), 'entry_cluster_memberships', ['snapshot_id'], unique=False)

    # Recreate cluster_labels table
    op.create_table(
        'cluster_labels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cluster_id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('representative_entry_ids', postgresql.ARRAY(sa.Integer()), default=[], nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['cluster_id'], ['semantic_clusters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cluster_id')
    )
    op.create_index(op.f('ix_cluster_labels_id'), 'cluster_labels', ['id'], unique=False)
    op.create_index(op.f('ix_cluster_labels_cluster_id'), 'cluster_labels', ['cluster_id'], unique=False)

    # Recreate cluster_transitions table
    op.create_table(
        'cluster_transitions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('old_cluster_id', sa.Integer(), nullable=True),
        sa.Column('new_cluster_id', sa.Integer(), nullable=True),
        sa.Column('transition_type', sa.String(50), nullable=False),
        sa.Column('transition_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('affected_entry_count', sa.Integer(), nullable=True),
        sa.Column('transition_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['old_cluster_id'], ['semantic_clusters.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['new_cluster_id'], ['semantic_clusters.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cluster_transitions_id'), 'cluster_transitions', ['id'], unique=False)
    op.create_index(op.f('ix_cluster_transitions_user_id'), 'cluster_transitions', ['user_id'], unique=False)
    op.create_index(op.f('ix_cluster_transitions_transition_date'), 'cluster_transitions', ['transition_date'], unique=False)

    # Add clustering metadata columns back to entry_embeddings table
    op.add_column('entry_embeddings', sa.Column('last_clustered_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('entry_embeddings', sa.Column('cluster_version', sa.Integer(), default=0, nullable=True))
