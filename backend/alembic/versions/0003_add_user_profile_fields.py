"""Add academic_qualification, body_height_cm, nationality, race, nric_passport to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('academic_qualification', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('body_height_cm', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('nationality', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('race', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('nric_passport', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'nric_passport')
    op.drop_column('users', 'race')
    op.drop_column('users', 'nationality')
    op.drop_column('users', 'body_height_cm')
    op.drop_column('users', 'academic_qualification')
