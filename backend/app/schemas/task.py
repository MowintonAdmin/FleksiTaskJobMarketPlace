import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, field_validator
from app.models.task import TaskStatus


class TaskBase(BaseModel):
    title: str
    description: str
    requirements: str | None = None
    location: str
    latitude: float | None = None
    longitude: float | None = None
    pay_rate_per_minute: float
    estimated_duration_minutes: int
    category: str
    max_applicants: int = 1
    starts_at: datetime | None = None

    @field_validator("pay_rate_per_minute")
    @classmethod
    def validate_pay_rate(cls, v):
        if v <= 0:
            raise ValueError("Pay rate must be positive")
        return v

    @field_validator("estimated_duration_minutes")
    @classmethod
    def validate_duration(cls, v):
        if v <= 0:
            raise ValueError("Duration must be positive")
        return v


class TaskCreate(TaskBase):
    @field_validator("starts_at")
    @classmethod
    def validate_starts_at(cls, v):
        if v is None:
            return v
        # Ensure timezone-aware comparison
        now = datetime.now(timezone.utc)
        v_aware = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        if v_aware < now:
            raise ValueError("Start date cannot be in the past")
        return v


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    requirements: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    pay_rate_per_minute: float | None = None
    estimated_duration_minutes: int | None = None
    category: str | None = None
    max_applicants: int | None = None
    starts_at: datetime | None = None
    status: TaskStatus | None = None
    photo_url: str | None = None

    @field_validator("starts_at")
    @classmethod
    def validate_starts_at(cls, v):
        if v is None:
            return v
        now = datetime.now(timezone.utc)
        v_aware = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        if v_aware < now:
            raise ValueError("Start date cannot be in the past")
        return v


class TaskResponse(TaskBase):
    id: uuid.UUID
    employer_id: uuid.UUID
    status: TaskStatus
    photo_url: str | None = None
    application_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    tasks: list[TaskResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
