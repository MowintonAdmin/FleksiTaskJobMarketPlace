"""Add project_tag column to projects and tasks tables

Schema changes:
  1. projects
     - ADD COLUMN project_tag VARCHAR(100) NULL
  2. tasks
     - ADD COLUMN project_tag VARCHAR(100) NULL

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_tag VARCHAR(100)"))
    op.execute(sa.text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_tag VARCHAR(100)"))


def downgrade() -> None:
    op.drop_column("tasks", "project_tag")
    op.drop_column("projects", "project_tag")
