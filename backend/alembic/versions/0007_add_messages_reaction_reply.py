"""Ensure messages table exists and has reaction/reply_to_id columns

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-09

The messages table was originally created by SQLAlchemy's create_all() rather
than a migration, so it may be missing columns (reaction, reply_to_id) that
were added to the model after the initial deployment.

This migration is fully idempotent:
- Creates the table if it does not exist (fresh DB without prior create_all).
- Adds the two columns with IF NOT EXISTS so it is a no-op on DBs that
  already have them.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the messages table if it does not already exist.
    # On databases where create_all() already ran this is a no-op.
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS messages (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sender_id   UUID NOT NULL REFERENCES users(id),
            recipient_id UUID NOT NULL REFERENCES users(id),
            body        TEXT NOT NULL,
            is_read     BOOLEAN NOT NULL DEFAULT false,
            reaction    VARCHAR(10),
            reply_to_id UUID REFERENCES messages(id),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))

    # Add columns that were added to the model after the initial deployment.
    # IF NOT EXISTS makes these safe to run against any DB state.
    op.execute(sa.text(
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction VARCHAR(10)"
    ))
    op.execute(sa.text(
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id)"
    ))


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE messages DROP COLUMN IF EXISTS reply_to_id"))
    op.execute(sa.text("ALTER TABLE messages DROP COLUMN IF EXISTS reaction"))
