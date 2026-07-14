"""Add payment_type and phone_number to bank_accounts and withdrawal_requests

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Bank accounts
    op.add_column('bank_accounts', sa.Column('payment_type', sa.String(20), server_default='bank_transfer', nullable=False))
    op.add_column('bank_accounts', sa.Column('phone_number', sa.String(20), nullable=True))
    op.alter_column('bank_accounts', 'bank_name', existing_type=sa.String(100), nullable=True)
    op.alter_column('bank_accounts', 'account_number', existing_type=sa.String(50), nullable=True)
    op.alter_column('bank_accounts', 'account_holder_name', existing_type=sa.String(255), nullable=True)

    # Withdrawal requests
    op.add_column('withdrawal_requests', sa.Column('payment_type', sa.String(20), server_default='bank_transfer', nullable=False))
    op.add_column('withdrawal_requests', sa.Column('phone_number', sa.String(20), nullable=True))
    op.alter_column('withdrawal_requests', 'bank_name', existing_type=sa.String(100), nullable=True)
    op.alter_column('withdrawal_requests', 'account_number', existing_type=sa.String(50), nullable=True)
    op.alter_column('withdrawal_requests', 'account_holder_name', existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    # Bank accounts
    op.drop_column('bank_accounts', 'payment_type')
    op.drop_column('bank_accounts', 'phone_number')

    # Withdrawal requests
    op.drop_column('withdrawal_requests', 'payment_type')
    op.drop_column('withdrawal_requests', 'phone_number')