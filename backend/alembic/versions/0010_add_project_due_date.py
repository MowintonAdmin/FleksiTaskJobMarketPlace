"""Add due_date to projects table

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('due_date', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'due_date')
