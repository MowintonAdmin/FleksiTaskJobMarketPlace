"""Ensure projects table and projectstatus enum are correctly set up

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-10

The projects table may have been created by SQLAlchemy's create_all() instead
of by migration 0005 (which failed on fresh DBs). Depending on the SQLAlchemy
version, create_all() may have created the projectstatus ENUM with uppercase
member names ('ACTIVE', 'COMPLETED', 'CANCELLED') instead of the lowercase
values ('active', 'completed', 'cancelled') used by the Python enum.

This migration:
1. Creates the projects table if it doesn't exist.
2. Converts the status column from a possibly-wrong ENUM type to VARCHAR(20).
   This is always safe because VARCHAR accepts any string the ENUM would.
3. Drops the old projectstatus ENUM type (if it exists) to remove confusion.
4. Re-creates the projectstatus ENUM with the correct lowercase values and
   casts the column back to use it.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create the projects table if it doesn't already exist.
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS projects (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name          VARCHAR(255) NOT NULL,
            description   TEXT,
            category      VARCHAR(100),
            location      VARCHAR(255),
            status        VARCHAR(20) NOT NULL DEFAULT 'active',
            created_by_id UUID NOT NULL REFERENCES users(id),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))

    # 2. If the status column is still backed by a PostgreSQL ENUM type,
    #    convert it to VARCHAR(20) so we can fix the values safely.
    #    The USING clause handles both lowercase and uppercase stored values.
    op.execute(sa.text("""
        DO $$ BEGIN
            -- Only alter if column type is an enum (not already varchar)
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'projects'
                  AND column_name = 'status'
                  AND udt_name = 'projectstatus'
            ) THEN
                ALTER TABLE projects
                    ALTER COLUMN status TYPE VARCHAR(20)
                    USING LOWER(status::text);
            END IF;
        END $$
    """))

    # 3. Normalise any uppercase values that may have been inserted already.
    op.execute(sa.text(
        "UPDATE projects SET status = LOWER(status) WHERE status != LOWER(status)"
    ))

    # 4. Drop the column DEFAULT (which references the enum type) so we can
    #    drop the type without hitting DependentObjectsStillExistError.
    op.execute(sa.text(
        "ALTER TABLE projects ALTER COLUMN status DROP DEFAULT"
    ))

    # 5. Re-add the default as a plain string literal (no type dependency).
    op.execute(sa.text(
        "ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'active'"
    ))

    # 6. Now drop the ENUM type — no objects depend on it any more.
    op.execute(sa.text("DROP TYPE IF EXISTS projectstatus CASCADE"))


def downgrade() -> None:
    # Recreate the ENUM and cast back (best-effort)
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE projectstatus AS ENUM ('active', 'completed', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))
    op.execute(sa.text("""
        ALTER TABLE projects
            ALTER COLUMN status TYPE projectstatus
            USING status::projectstatus
    """))
