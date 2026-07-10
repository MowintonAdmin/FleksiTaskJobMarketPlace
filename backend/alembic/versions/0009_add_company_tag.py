"""Add company_tag to users, projects, and tasks tables

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('company_tag', sa.String(100), nullable=True))
    op.add_column('projects', sa.Column('company_tag', sa.String(100), nullable=True))
    op.add_column('tasks', sa.Column('company_tag', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'company_tag')
    op.drop_column('projects', 'company_tag')
    op.drop_column('users', 'company_tag')