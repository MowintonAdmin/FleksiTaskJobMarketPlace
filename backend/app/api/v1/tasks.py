import uuid
import math
import os
import logging
import aiofiles
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.task import Task, TaskStatus
from app.models.application import Application
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
from app.core.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    location: str | None = Query(None),
    category: str | None = Query(None),
    min_pay: float | None = Query(None),
    max_pay: float | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all open tasks with optional filters."""
    now = datetime.now(timezone.utc)
    filters = [
        Task.status == TaskStatus.OPEN,
        or_(Task.starts_at == None, Task.starts_at >= now),
    ]
    if location:
        filters.append(Task.location.ilike(f"%{location}%"))
    if category:
        filters.append(Task.category == category)
    if min_pay is not None:
        filters.append(Task.pay_rate_per_minute >= min_pay / 60.0)
    if max_pay is not None:
        filters.append(Task.pay_rate_per_minute <= max_pay / 60.0)

    count_q = await db.execute(select(func.count()).select_from(Task).where(and_(*filters)))
    total = count_q.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        select(Task).where(and_(*filters)).order_by(Task.created_at.desc()).offset(offset).limit(page_size)
    )
    tasks = result.scalars().all()

    task_responses = []
    for task in tasks:
        count_result = await db.execute(select(func.count()).select_from(Application).where(Application.task_id == task.id))
        app_count = count_result.scalar_one()
        task_data = TaskResponse.model_validate(task)
        task_data.application_count = app_count
        task_responses.append(task_data)

    return TaskListResponse(
        tasks=task_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size),
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    count_result = await db.execute(select(func.count()).select_from(Application).where(Application.task_id == task.id))
    task_data = TaskResponse.model_validate(task)
    task_data.application_count = count_result.scalar_one()
    return task_data


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = Task(**payload.model_dump(), employer_id=current_user.id, company_tag=current_user.company_tag if current_user.is_admin else None)
    db.add(task)
    await db.flush()
    await db.refresh(task)
    task_data = TaskResponse.model_validate(task)
    task_data.application_count = 0
    return task_data


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.employer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Track old status before update
    old_status = task.status

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.add(task)
    await db.flush()
    await db.refresh(task)

    # If task is being completed or cancelled, auto-checkout active workers
    from app.models.task_session import TaskSession, SessionStatus
    from app.models.message import Message

    if (task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED) and
            old_status in (TaskStatus.OPEN, TaskStatus.IN_PROGRESS)):
        # Find all active sessions for this task
        sessions_result = await db.execute(
            select(TaskSession).where(
                TaskSession.task_id == task.id,
                TaskSession.status.in_([SessionStatus.ACTIVE, SessionStatus.PAUSED]),
            )
        )
        active_sessions = sessions_result.scalars().all()

        for session in active_sessions:
            fixed_earnings = round(task.pay_rate_per_minute * task.estimated_duration_minutes, 2)

            # Auto-checkout — leave in COMPLETED state so Session Approval can process it.
            # Do NOT credit the wallet here; payment is issued only upon admin approval.
            now = datetime.now(timezone.utc)
            session.checked_out_at = now
            session.earnings = fixed_earnings
            session.status = SessionStatus.COMPLETED
            session.proof_notes = f"[Auto-checked-out — task {task.status}]"
            db.add(session)

            # Notify worker that their session is pending approval
            db.add(Message(
                sender_id=current_user.id,
                recipient_id=session.worker_id,
                body=f"⏳ Your session for \"{task.title}\" has been checked out automatically. Payment of RM {fixed_earnings:.2f} will be credited once the session is approved.",
            ))

        if active_sessions:
            await db.flush()

    count_result = await db.execute(select(func.count()).select_from(Application).where(Application.task_id == task.id))
    task_data = TaskResponse.model_validate(task)
    task_data.application_count = count_result.scalar_one()
    return task_data


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.employer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Delete associated task sessions first to avoid FK violations
    # when applications are cascade-deleted (task_sessions.application_id references applications.id)
    from app.models.task_session import TaskSession
    await db.execute(
        sa.delete(TaskSession).where(TaskSession.task_id == task.id)
    )

    await db.delete(task)


@router.post("/{task_id}/photo", response_model=TaskResponse)
async def upload_task_photo(
    task_id: uuid.UUID,
    photo: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace a task photo."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.employer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    from app.config import get_settings
    _settings = get_settings()

    ext = os.path.splitext(photo.filename or "")[1].lower()
    if not ext:
        ext = ".jpg"  # fallback for mobile browsers that omit filename extension
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid image type '{ext}'. Allowed: jpg, png, webp")

    try:
        content = await photo.read()
        if len(content) > _settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {_settings.MAX_UPLOAD_SIZE_MB}MB",
            )
        filename = f"task_{task_id}{ext}"
        save_path = os.path.join(_settings.MEDIA_DIR, filename)
        os.makedirs(_settings.MEDIA_DIR, exist_ok=True)
        async with aiofiles.open(save_path, "wb") as f:
            await f.write(content)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to save task photo for task %s: %s", task_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save photo: {exc}",
        )

    task.photo_url = f"/media/{filename}"
    db.add(task)
    await db.flush()
    await db.refresh(task)

    count_result = await db.execute(select(func.count()).select_from(Application).where(Application.task_id == task.id))
    task_data = TaskResponse.model_validate(task)
    task_data.application_count = count_result.scalar_one()
    return task_data
