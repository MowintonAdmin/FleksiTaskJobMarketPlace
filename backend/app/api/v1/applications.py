import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.database import get_db
from app.models.application import Application, ApplicationStatus
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse, ApplicationWithDetails
from app.core.deps import get_current_user
from app.core.firebase import send_application_status_notification

router = APIRouter(prefix="/applications", tags=["Applications"])


def build_user_public(user: User):
    skills = user.skills
    if isinstance(skills, str):
        skills = json.loads(skills)
    from app.schemas.user import UserPublic
    return UserPublic.model_validate({
        "id": user.id,
        "full_name": user.full_name,
        "profile_photo_url": user.profile_photo_url,
        "location": user.location,
        "skills": skills,
    })


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_task(
    payload: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One-tap task application. User must be verified."""
    if not current_user.is_verified:
        if current_user.verification_status == "submitted":
            msg = "Your profile is currently under review. Please wait for verification before applying."
        else:
            msg = "Please complete your profile first — fill in required fields, upload your selfie with ID, then submit for verification."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=msg,
        )
    if not current_user.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a phone number in your profile before applying for tasks.",
        )

    result = await db.execute(select(Task).where(Task.id == payload.task_id))
    task = result.scalar_one_or_none()
    if not task or task.status != TaskStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found or not open")

    if task.starts_at and task.starts_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Task start date has passed and is no longer accepting applications")

    existing = await db.execute(
        select(Application).where(
            and_(
                Application.task_id == payload.task_id,
                Application.worker_id == current_user.id,
                Application.status.notin_([ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN]),
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already applied for this task")

    # Count active (non-rejected, non-withdrawn) applications against the slot limit
    active_count_result = await db.execute(
        select(func.count()).select_from(Application).where(
            and_(
                Application.task_id == payload.task_id,
                Application.status.notin_([ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN]),
            )
        )
    )
    if active_count_result.scalar_one() >= task.max_applicants:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This task has already reached its maximum number of applicants")

    application = Application(
        task_id=payload.task_id,
        worker_id=current_user.id,
        cover_note=payload.cover_note,
    )
    db.add(application)
    await db.flush()
    await db.refresh(application)
    return application


@router.get("/my", response_model=list[ApplicationWithDetails])
async def get_my_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all applications for the current worker."""
    result = await db.execute(
        select(Application).where(Application.worker_id == current_user.id).order_by(Application.created_at.desc())
    )
    applications = result.scalars().all()
    response = []
    for app in applications:
        task_result = await db.execute(select(Task).where(Task.id == app.task_id))
        task = task_result.scalar_one_or_none()
        app_base = ApplicationResponse.model_validate(app)
        app_data = ApplicationWithDetails(**app_base.model_dump())
        if task:
            from app.schemas.task import TaskResponse
            count_result = await db.execute(select(func.count()).select_from(Application).where(Application.task_id == task.id))
            task_data = TaskResponse.model_validate(task)
            task_data.application_count = count_result.scalar_one()
            app_data.task = task_data
        response.append(app_data)
    return response


@router.get("/task/{task_id}", response_model=list[ApplicationWithDetails])
async def get_task_applications(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all applications for a task (employer only)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.employer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    result = await db.execute(select(Application).where(Application.task_id == task_id))
    applications = result.scalars().all()

    response = []
    for app in applications:
        worker_result = await db.execute(select(User).where(User.id == app.worker_id))
        worker = worker_result.scalar_one_or_none()
        app_base = ApplicationResponse.model_validate(app)
        app_data = ApplicationWithDetails(**app_base.model_dump())
        if worker:
            app_data.worker = build_user_public(worker)
        response.append(app_data)
    return response


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: uuid.UUID,
    payload: ApplicationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject an application (employer)."""
    result = await db.execute(select(Application).where(Application.id == application_id))
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    task_result = await db.execute(select(Task).where(Task.id == application.task_id))
    task = task_result.scalar_one_or_none()
    if task.employer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    application.status = payload.status
    application.reviewed_at = datetime.now(timezone.utc)
    db.add(application)

    # When an application is approved, check if the task has filled all its
    # required slots. Only mark it IN_PROGRESS (hiding it from the main page)
    # once the number of approved applications reaches max_applicants.
    if payload.status == ApplicationStatus.APPROVED:
        approved_count_result = await db.execute(
            select(func.count()).select_from(Application).where(
                Application.task_id == task.id,
                Application.status == ApplicationStatus.APPROVED,
            )
        )
        # autoflush already persisted the status change above, so the count
        # includes the current application — no manual +1 needed.
        approved_count = approved_count_result.scalar_one()
        if approved_count >= task.max_applicants:
            task.status = TaskStatus.IN_PROGRESS
            db.add(task)

    # If a previously-approved application is rejected, reopen the task so it
    # appears on the main page again (a slot has freed up).
    elif payload.status == ApplicationStatus.REJECTED and task.status == TaskStatus.IN_PROGRESS:
        task.status = TaskStatus.OPEN
        db.add(task)

    await db.flush()
    await db.refresh(application)

    # Send in-app message notification to the worker
    from app.models.message import Message
    worker_result = await db.execute(select(User).where(User.id == application.worker_id))
    worker = worker_result.scalar_one_or_none()
    if worker:
        status_label = payload.status.value
        if status_label == "approved":
            notif_body = f"✅ Your application for \"{task.title}\" has been approved! You can now check in and start tracking your work."
        elif status_label == "rejected":
            notif_body = f"❌ Your application for \"{task.title}\" was not selected. Keep looking for other opportunities!"
        else:
            notif_body = f"Your application for \"{task.title}\" has been updated to: {status_label}"
        db.add(Message(
            sender_id=current_user.id,
            recipient_id=application.worker_id,
            body=notif_body,
        ))
        await db.flush()

    # Also attempt FCM push notification (silently fails if Firebase not configured)
    if worker and worker.fcm_token:
        try:
            await send_application_status_notification(
                fcm_token=worker.fcm_token,
                task_title=task.title,
                status=payload.status.value,
                task_id=str(task.id),
            )
        except Exception:
            pass

    return application
