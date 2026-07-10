import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    category: str | None = None
    location: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    location: str | None = None
    status: ProjectStatus | None = None


class ProjectResponse(ProjectBase):
    id: uuid.UUID
    status: ProjectStatus
    created_by_id: uuid.UUID
    company_tag: str | None = None
    task_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int