import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Float, DateTime, ForeignKey, Text, String, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.enums import DataSource


class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    SETTLED = "settled"  # Admin approved and wallet credited


class TaskSession(Base):
    __tablename__ = "task_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False)
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    earnings: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[SessionStatus] = mapped_column(String(20), default=SessionStatus.ACTIVE, nullable=False)
    proof_photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proof_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)        # 1.0 – 5.0
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    # E-Consent fields (from previous commit)
    consent_signature: Mapped[str | None] = mapped_column(String(255), nullable=True)  # typed name e-signature
    consent_given_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Import-related fields (Excel data import)
    source: Mapped[DataSource] = mapped_column(String(20), default=DataSource.APP, nullable=False)
    import_reference: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    duration_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    nature_of_work: Mapped[str | None] = mapped_column(String(255), nullable=True)
    work_environment: Mapped[str | None] = mapped_column(String(255), nullable=True)
    legacy_device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    raw_import_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", foreign_keys=[task_id])
    worker = relationship("User", foreign_keys=[worker_id])
    application = relationship("Application", foreign_keys=[application_id])