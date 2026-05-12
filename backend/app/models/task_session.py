import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Float, DateTime, ForeignKey, Text, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", foreign_keys=[task_id])
    worker = relationship("User", foreign_keys=[worker_id])
    application = relationship("Application", foreign_keys=[application_id])
