import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.task_session import SessionStatus


class CheckInRequest(BaseModel):
    application_id: uuid.UUID
    consent_signature: str | None = None  # required for fresh check-in; omitted on resume


class CheckOutRequest(BaseModel):
    proof_notes: str | None = None


class TaskSessionResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    worker_id: uuid.UUID
    application_id: uuid.UUID
    checked_in_at: datetime
    checked_out_at: datetime | None = None
    earnings: float | None = None
    status: SessionStatus
    proof_photo_url: str | None = None
    proof_notes: str | None = None
    rating: float | None = None
    feedback: str | None = None
    consent_signature: str | None = None
    consent_given_at: datetime | None = None

    model_config = {"from_attributes": True}


class EarningsResponse(BaseModel):
    session_id: uuid.UUID
    checked_in_at: datetime
    elapsed_minutes: float
    pay_rate_per_minute: float
    current_earnings: float
    status: SessionStatus
