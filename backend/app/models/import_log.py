import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ImportLog(Base):
    """Tracks each historical data import operation."""
    __tablename__ = "import_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    worksheet_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    import_version: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False)
    imported_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="running", nullable=False)  # running, completed, failed
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    workers_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    workers_matched: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sessions_imported: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_rows_details: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    error_log: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)