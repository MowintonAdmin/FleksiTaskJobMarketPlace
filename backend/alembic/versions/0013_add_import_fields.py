"""Add import-related fields (source, legacy_participant_id, import_reference, etc.) and import_logs table

Schema changes:
  1. users
     - ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'APP'
     - ADD COLUMN legacy_participant_id VARCHAR(100) NULL, with index
  2. task_sessions
     - ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'APP'
     - ADD COLUMN import_reference VARCHAR(100) NULL, with index
     - ADD COLUMN duration_minutes FLOAT NULL
     - ADD COLUMN nature_of_work VARCHAR(255) NULL
     - ADD COLUMN work_environment VARCHAR(255) NULL
     - ADD COLUMN legacy_device_id VARCHAR(100) NULL
     - ADD COLUMN raw_import_data JSONB NULL
  3. import_logs (new table)
     - id UUID PRIMARY KEY
     - filename VARCHAR(255) NOT NULL
     - worksheet_name VARCHAR(100) NULL
     - import_version VARCHAR(20) NOT NULL DEFAULT '1.0'
     - imported_by_id UUID FK -> users.id NOT NULL
     - status VARCHAR(20) NOT NULL DEFAULT 'running'
     - total_rows INTEGER NOT NULL DEFAULT 0
     - valid_rows INTEGER NOT NULL DEFAULT 0
     - duplicate_rows INTEGER NOT NULL DEFAULT 0
     - workers_created INTEGER NOT NULL DEFAULT 0
     - workers_matched INTEGER NOT NULL DEFAULT 0
     - sessions_imported INTEGER NOT NULL DEFAULT 0
     - failed_rows_details JSONB NULL
     - error_log JSONB NULL
     - started_at TIMESTAMPTZ NOT NULL DEFAULT now()
     - completed_at TIMESTAMPTZ NULL

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS / DO NOTHING so the migration is idempotent
    # regardless of what was manually applied to the DB beforehand.

    # ── users ──────────────────────────────────────────────────────────────────
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'APP'"))
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_participant_id VARCHAR(100)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_users_legacy_participant_id ON users(legacy_participant_id)"))

    # ── task_sessions ──────────────────────────────────────────────────────────
    op.execute(sa.text("ALTER TABLE task_sessions ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'APP'"))
    op.execute(sa.text("ALTER TABLE task_sessions ADD COLUMN IF NOT EXISTS import_reference VARCHAR(100)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_task_sessions_import_reference ON task_sessions(import_reference)"))
    op.execute(sa.text("ALTER TABLE task_sessions ADD COLUMN IF NOT EXISTS duration_minutes FLOAT"))
    op.execute(sa.text("ALTER TABLE task_sessions ADD COLUMN IF NOT EXISTS nature_of_work VARCHAR(255)"))
    op.execute(sa.text("ALTER TABLE task_sessions ADD COLUMN IF NOT EXISTS work_environment VARCHAR(255)"))
    op.execute(sa.text("ALTER TABLE task_sessions ADD COLUMN IF NOT EXISTS legacy_device_id VARCHAR(100)"))
    op.execute(sa.text("ALTER TABLE task_sessions ADD COLUMN IF NOT EXISTS raw_import_data JSONB"))

    # ── import_logs (new table) ────────────────────────────────────────────────
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS import_logs (
            id UUID NOT NULL,
            filename VARCHAR(255) NOT NULL,
            worksheet_name VARCHAR(100),
            import_version VARCHAR(20) DEFAULT '1.0' NOT NULL,
            imported_by_id UUID NOT NULL,
            status VARCHAR(20) DEFAULT 'running' NOT NULL,
            total_rows INTEGER DEFAULT '0' NOT NULL,
            valid_rows INTEGER DEFAULT '0' NOT NULL,
            duplicate_rows INTEGER DEFAULT '0' NOT NULL,
            workers_created INTEGER DEFAULT '0' NOT NULL,
            workers_matched INTEGER DEFAULT '0' NOT NULL,
            sessions_imported INTEGER DEFAULT '0' NOT NULL,
            failed_rows_details JSONB,
            error_log JSONB,
            started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            completed_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY (imported_by_id) REFERENCES users (id)
        )
    """))


def downgrade() -> None:
    # ── import_logs ────────────────────────────────────────────────────────────
    op.drop_table("import_logs")

    # ── task_sessions ──────────────────────────────────────────────────────────
    op.drop_column("task_sessions", "raw_import_data")
    op.drop_column("task_sessions", "legacy_device_id")
    op.drop_column("task_sessions", "work_environment")
    op.drop_column("task_sessions", "nature_of_work")
    op.drop_column("task_sessions", "duration_minutes")
    op.drop_index("ix_task_sessions_import_reference", table_name="task_sessions")
    op.drop_column("task_sessions", "import_reference")
    op.drop_column("task_sessions", "source")

    # ── users ──────────────────────────────────────────────────────────────────
    op.drop_index("ix_users_legacy_participant_id", table_name="users")
    op.drop_column("users", "legacy_participant_id")
    op.drop_column("users", "source")