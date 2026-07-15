"""Pydantic schemas for historical data import preview and confirmation."""
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ImportRow(BaseModel):
    """Normalized representation of a single Excel row for import."""
    row_number: int
    participant_id: str | None = None
    nric_passport: str | None = None
    full_name: str | None = None
    short_name: str | None = None
    phone: str | None = None
    date: str | None = None
    project_id: str | None = None
    project_session: str | None = None
    body_height_cm: float | None = None
    nature_of_work: str | None = None
    activity_task: str | None = None
    environment: str | None = None
    device_id: str | None = None
    qc_duration_minutes: float | None = None
    expected_duration_minutes: float | None = None
    total_duration_minutes: float | None = None
    expected_target_minutes: float | None = None
    variance_minutes: float | None = None
    hours_worked: float | None = None
    total_payout_rm: float | None = None
    raw_data: dict = Field(default_factory=dict)
    # Validation results
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    is_valid: bool = True


class ImportPreviewRow(BaseModel):
    """Preview information for a single row in the import preview."""
    row_number: int
    participant_id: str | None = None
    full_name: str | None = None
    date: str | None = None
    project_session: str | None = None
    duration_minutes: float | None = None
    earnings: float | None = None
    status: str = "valid"  # valid, duplicate_exact, duplicate_possible, conflict, invalid
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class WorkerPreview(BaseModel):
    """Preview of a worker that will be created or matched."""
    participant_id: str
    full_name: str
    phone: str | None = None
    nric_passport: str | None = None
    status: str  # "new" or "existing"


class ImportPreviewResponse(BaseModel):
    """Response returned by the preview endpoint (no DB changes made)."""
    filename: str
    worksheet_name: str | None = None
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    exact_duplicates: int = 0
    possible_duplicates: int = 0
    conflicts: int = 0
    workers_to_create: int = 0
    workers_matched: int = 0
    sessions_to_import: int = 0
    missing_required_fields: int = 0
    validation_warnings: list[str] = Field(default_factory=list)
    validation_errors: list[str] = Field(default_factory=list)
    workers: list[WorkerPreview] = Field(default_factory=list)
    rows: list[ImportPreviewRow] = Field(default_factory=list)


class ImportConfirmResponse(BaseModel):
    """Response returned after a successful import."""
    status: str = "completed"
    filename: str
    worksheet_name: str | None = None
    total_rows: int = 0
    valid_rows: int = 0
    workers_created: int = 0
    workers_matched: int = 0
    sessions_imported: int = 0
    exact_duplicates: int = 0
    possible_duplicates: int = 0
    conflicts: int = 0
    failed_rows: int = 0
    execution_time_seconds: float = 0.0
    import_log_id: str | None = None


class ImportErrorResponse(BaseModel):
    """Response returned on import failure."""
    status: str = "failed"
    error: str
    execution_time_seconds: float = 0.0