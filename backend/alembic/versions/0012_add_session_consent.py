"""Add e-consent fields to task_sessions

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('task_sessions', sa.Column('consent_signature', sa.String(255), nullable=True))
    op.add_column('task_sessions', sa.Column('consent_given_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('task_sessions', 'consent_signature')
    op.drop_column('task_sessions', 'consent_given_at')
