"""Add phone, verification and ID photo fields to users

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('phone_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('bank_qr_code_url', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('id_photo_front_url', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('id_photo_back_url', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('selfie_with_id_url', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('verification_status', sa.String(20), nullable=False, server_default='pending'))
    op.add_column('users', sa.Column('rejection_reason', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('verification_submitted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'verification_submitted_at')
    op.drop_column('users', 'rejection_reason')
    op.drop_column('users', 'verification_status')
    op.drop_column('users', 'selfie_with_id_url')
    op.drop_column('users', 'id_photo_back_url')
    op.drop_column('users', 'id_photo_front_url')
    op.drop_column('users', 'bank_qr_code_url')
    op.drop_column('users', 'phone_verified')
    op.drop_column('users', 'phone')
