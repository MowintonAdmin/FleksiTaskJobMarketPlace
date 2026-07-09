"""Add projects table and project_id to tasks

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the projectstatus enum type if it doesn't already exist.
    # (SQLAlchemy's create_all also creates it, but alembic runs before uvicorn starts
    # on a fresh DB so we must create it here to avoid a dependency race.)
    op.execute("DO $$ BEGIN CREATE TYPE projectstatus AS ENUM ('active', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;")

    op.create_table(
        'projects',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('status', sa.Enum('active', 'completed', 'cancelled', name='projectstatus', create_type=False), nullable=False, server_default='active'),
        sa.Column('created_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Add project_id to tasks
    op.add_column('tasks', sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'project_id')
    op.drop_table('projects')
    sa.Enum(name='projectstatus').drop(op.get_bind())