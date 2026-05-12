"""Add paused value to sessionstatus enum

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-12
"""
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'paused'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # A full recreation would be required; intentionally left as no-op.
    pass
