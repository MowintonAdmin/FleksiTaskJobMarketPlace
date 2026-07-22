import uuid
from datetime import datetime as _datetime
from pydantic import BaseModel
from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    category: str | None = None
    location: str | None = None
    project_tag: str | None = None
    due_date: _datetime | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    location: str | None = None
    project_tag: str | None = None
    status: ProjectStatus | None = None
    due_date: _datetime | None = None


class ProjectResponse(ProjectBase):
    id: uuid.UUID
    status: ProjectStatus
    project_tag: str | None = None
    created_by_id: uuid.UUID
    company_tag: str | None = None
    task_count: int = 0
    due_date: _datetime | None = None
    created_at: _datetime
    updated_at: _datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int