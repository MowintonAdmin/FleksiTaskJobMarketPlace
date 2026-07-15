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
    # ── users ──────────────────────────────────────────────────────────────────
    # Add source column (APP | IMPORTED | API). Existing records default to 'APP'.
    op.add_column(
        "users",
        sa.Column("source", sa.String(20), nullable=False, server_default="APP"),
    )
    # Add legacy_participant_id for mapping imported historical workers
    op.add_column(
        "users",
        sa.Column("legacy_participant_id", sa.String(100), nullable=True),
    )
    op.create_index(
        "ix_users_legacy_participant_id", "users", ["legacy_participant_id"],
        postgresql_using="btree",
    )

    # ── task_sessions ──────────────────────────────────────────────────────────
    # Add source column. Existing records default to 'APP'.
    op.add_column(
        "task_sessions",
        sa.Column("source", sa.String(20), nullable=False, server_default="APP"),
    )
    # Add import_reference for mapping historical session codes (e.g., MW-A0194)
    op.add_column(
        "task_sessions",
        sa.Column("import_reference", sa.String(100), nullable=True),
    )
    op.create_index(
        "ix_task_sessions_import_reference", "task_sessions", ["import_reference"],
        postgresql_using="btree",
    )
    # Add duration_minutes — pre-calculated total from Excel (QC + Expected)
    op.add_column(
        "task_sessions",
        sa.Column("duration_minutes", sa.Float(), nullable=True),
    )
    # Add nature_of_work — description of the type of work (e.g., "Recycle", "Mini Mart")
    op.add_column(
        "task_sessions",
        sa.Column("nature_of_work", sa.String(255), nullable=True),
    )
    # Add work_environment — location type (e.g., "Office / Indoor desk", "Kitchen")
    op.add_column(
        "task_sessions",
        sa.Column("work_environment", sa.String(255), nullable=True),
    )
    # Add legacy_device_id — Device ID from historical tracker
    op.add_column(
        "task_sessions",
        sa.Column("legacy_device_id", sa.String(100), nullable=True),
    )
    # Add raw_import_data — full original Excel row as JSON for traceability
    op.add_column(
        "task_sessions",
        sa.Column("raw_import_data", postgresql.JSONB(), nullable=True),
    )

    # ── import_logs (new table) ────────────────────────────────────────────────
    op.create_table(
        "import_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("worksheet_name", sa.String(100), nullable=True),
        sa.Column("import_version", sa.String(20), nullable=False, server_default="1.0"),
        sa.Column(
            "imported_by_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"), nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("workers_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("workers_matched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sessions_imported", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows_details", postgresql.JSONB(), nullable=True),
        sa.Column("error_log", postgresql.JSONB(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


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