import uuid
import logging
import os
import aiofiles
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.task_session import TaskSession, SessionStatus
from app.models.application import Application, ApplicationStatus
from app.models.task import Task, TaskStatus
from app.schemas.task_session import CheckInRequest, CheckOutRequest, TaskSessionResponse, EarningsResponse
from app.core.deps import get_current_user
from app.models.user import User
from app.models.wallet import Wallet, Transaction, TransactionType
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/task-sessions", tags=["Task Tracking"])
settings = get_settings()


def get_worked_minutes(session: TaskSession, cap_minutes: float | None = None) -> float:
    """Return the accumulated work time for a paused session.

    cap_minutes should be task.estimated_duration_minutes so that a worker who
    paused after the timer hit the limit isn't backdated past the cap on resume,
    which would otherwise cause the timer to snap straight to the cap again.
    """
    if not session.checked_in_at or not session.checked_out_at:
        return 0.0
    raw = max(
        0.0,
        (session.checked_out_at.replace(tzinfo=timezone.utc) - session.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60,
    )
    if cap_minutes and cap_minutes > 0:
        return min(raw, cap_minutes)
    return raw


async def finalize_checkout(
    session: TaskSession,
    task: Task,
    current_user: User,
    db: AsyncSession,
    proof_notes: str | None,
    photo_url: str | None = None,
) -> TaskSessionResponse:
    now = datetime.now(timezone.utc)
    # ALWAYS use fixed task total (pay_rate × estimated_duration) — never calculate per-minute
    earnings = round(task.pay_rate_per_minute * task.estimated_duration_minutes, 2)

    session.checked_out_at = now
    session.earnings = earnings
    session.status = SessionStatus.COMPLETED
    session.proof_notes = proof_notes
    if photo_url:
        session.proof_photo_url = photo_url

    # Auto-mark the task as completed when the worker checks out
    if task.status == TaskStatus.IN_PROGRESS:
        task.status = TaskStatus.COMPLETED
        db.add(task)

    await db.flush()
    await db.refresh(session)
    return TaskSessionResponse.model_validate(session)


@router.post("/checkin", response_model=TaskSessionResponse, status_code=status.HTTP_201_CREATED)
async def check_in(
    payload: CheckInRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Worker checks in to begin a task. Application must be approved."""
    # Verify application belongs to this worker and is approved
    result = await db.execute(
        select(Application).where(
            Application.id == payload.application_id,
            Application.worker_id == current_user.id,
            Application.status == ApplicationStatus.APPROVED,
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approved application not found for this worker",
        )

    task_result = await db.execute(select(Task).where(Task.id == application.task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    active_for_worker = await db.execute(
        select(TaskSession).where(
            TaskSession.worker_id == current_user.id,
            TaskSession.status == SessionStatus.ACTIVE,
            TaskSession.application_id != payload.application_id,
        )
    )
    if active_for_worker.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have another task being tracked. Finish or resume that task before starting a new one.",
        )

    # Prevent double check-in
    existing = await db.execute(
        select(TaskSession).where(
            TaskSession.application_id == payload.application_id,
            TaskSession.status == SessionStatus.ACTIVE,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already checked in for this application",
        )

    previous_result = await db.execute(
        select(TaskSession)
        .where(TaskSession.application_id == payload.application_id)
        .order_by(TaskSession.created_at.desc())
    )
    previous_session = previous_result.scalars().first()
    if previous_session and previous_session.status == SessionStatus.PAUSED:
        # Resume a paused session — preserve time worked so far, capped at the
        # task's duration limit so the backdated checked_in_at never overshoots
        # the cap and triggers an instant checkout on the next request.
        worked_minutes = get_worked_minutes(
            previous_session,
            cap_minutes=float(task.estimated_duration_minutes) if task.estimated_duration_minutes > 0 else None,
        )
        previous_session.checked_in_at = datetime.now(timezone.utc) - timedelta(minutes=worked_minutes)
        previous_session.checked_out_at = None
        previous_session.earnings = None
        previous_session.status = SessionStatus.ACTIVE
        db.add(previous_session)
        await db.flush()
        await db.refresh(previous_session)
        return TaskSessionResponse.model_validate(previous_session)

    if previous_session and previous_session.status == SessionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This task session has already been completed",
        )

    session = TaskSession(
        task_id=application.task_id,
        worker_id=current_user.id,
        application_id=payload.application_id,
    )
    db.add(session)

    # Mark task as in_progress when a worker first checks in
    if task.status == TaskStatus.OPEN:
        task.status = TaskStatus.IN_PROGRESS
        db.add(task)

    await db.flush()
    return TaskSessionResponse.model_validate(session)


@router.post("/{session_id}/checkout", response_model=TaskSessionResponse)
async def check_out(
    session_id: uuid.UUID,
    proof_notes: str | None = Form(default=None),
    proof_photo: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Worker checks out, optionally submitting a proof photo and notes."""
    result = await db.execute(
        select(TaskSession).where(
            TaskSession.id == session_id,
            TaskSession.worker_id == current_user.id,
            TaskSession.status == SessionStatus.ACTIVE,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active session not found")

    # Fetch task for pay rate
    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()

    # Save proof photo if provided
    photo_url = None
    if proof_photo and proof_photo.filename:
        ext = os.path.splitext(proof_photo.filename)[1].lower()
        if not ext:
            ext = ".jpg"  # fallback for files without extension (some mobile browsers)
        allowed_ext = {".jpg", ".jpeg", ".png", ".webp"}
        if ext not in allowed_ext:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid image type '{ext}'. Allowed: jpg, png, webp",
            )
        try:
            content = await proof_photo.read()
            if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB",
                )
            filename = f"proof_{session_id}{ext}"
            save_path = os.path.join(settings.MEDIA_DIR, filename)
            os.makedirs(settings.MEDIA_DIR, exist_ok=True)
            async with aiofiles.open(save_path, "wb") as f:
                await f.write(content)
            photo_url = f"/media/{filename}"
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to save proof photo for session %s: %s", session_id, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save proof photo: {exc}",
            )

    try:
        return await finalize_checkout(session, task, current_user, db, proof_notes, photo_url)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("finalize_checkout failed for session %s: %s", session_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Check-out processing failed: {exc}",
        )


@router.post("/{session_id}/pause", response_model=TaskSessionResponse)
async def pause_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Worker pauses an active task. Time worked is preserved for resumption."""
    result = await db.execute(
        select(TaskSession).where(
            TaskSession.id == session_id,
            TaskSession.worker_id == current_user.id,
            TaskSession.status == SessionStatus.ACTIVE,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active session not found")

    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()

    now = datetime.now(timezone.utc)
    elapsed_minutes = (now - session.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
    # Cap at task duration limit to prevent over-billing
    if task.estimated_duration_minutes > 0:
        elapsed_minutes = min(elapsed_minutes, float(task.estimated_duration_minutes))
    session.checked_out_at = now
    session.earnings = round(elapsed_minutes * task.pay_rate_per_minute, 2)
    session.status = SessionStatus.PAUSED

    await db.flush()
    await db.refresh(session)
    return TaskSessionResponse.model_validate(session)


@router.post("/{session_id}/checkout-simple", response_model=TaskSessionResponse)
async def check_out_simple(
    session_id: uuid.UUID,
    payload: CheckOutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Worker checks out without photo upload using a JSON payload."""
    result = await db.execute(
        select(TaskSession).where(
            TaskSession.id == session_id,
            TaskSession.worker_id == current_user.id,
            TaskSession.status == SessionStatus.ACTIVE,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active session not found")

    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()

    return await finalize_checkout(session, task, current_user, db, payload.proof_notes)


@router.get("/{session_id}/earnings", response_model=EarningsResponse)
async def get_earnings(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get earnings for a session — always returns fixed task total."""
    result = await db.execute(
        select(TaskSession).where(
            TaskSession.id == session_id,
            TaskSession.worker_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()

    # ALWAYS use fixed task total (pay_rate × estimated_duration)
    fixed_total = round(task.pay_rate_per_minute * task.estimated_duration_minutes, 2)

    return EarningsResponse(
        session_id=session.id,
        checked_in_at=session.checked_in_at,
        elapsed_minutes=round(task.estimated_duration_minutes, 2),
        pay_rate_per_minute=task.pay_rate_per_minute,
        current_earnings=fixed_total,
        status=session.status,
    )


@router.get("/my", response_model=list[TaskSessionResponse])
async def my_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all task sessions for the current worker."""
    try:
        result = await db.execute(
            select(TaskSession)
            .where(TaskSession.worker_id == current_user.id)
            .order_by(TaskSession.created_at.desc())
        )
        sessions = result.scalars().all()
        return [TaskSessionResponse.model_validate(s) for s in sessions]
    except Exception as e:
        logger.error("my_sessions error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch sessions: {e}")


@router.get("/active", response_model=TaskSessionResponse | None)
async def get_active_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current worker's active session, if any."""
    try:
        result = await db.execute(
            select(TaskSession).where(
                TaskSession.worker_id == current_user.id,
                TaskSession.status == SessionStatus.ACTIVE,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            return None
        return TaskSessionResponse.model_validate(session)
    except Exception as e:
        logger.error("get_active_session error: %s", e, exc_info=True)
        return None  # Non-critical — return null instead of crashing the page load


# ── History & Performance ─────────────────────────────────────────────────────

@router.get("/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Settled sessions with full task details for the worker's history page.
    Includes both completed (pending admin approval) and settled (approved & credited) sessions."""
    result = await db.execute(
        select(TaskSession)
        .where(
            TaskSession.worker_id == current_user.id,
            TaskSession.status.in_([SessionStatus.COMPLETED, SessionStatus.SETTLED]),
        )
        .order_by(TaskSession.checked_out_at.desc())
    )
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()
        elapsed = None
        if s.checked_in_at and s.checked_out_at:
            elapsed = round(
                (s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60,
                1,
            )
        out.append({
            "session_id": str(s.id),
            "task_id": str(s.task_id),
            "task_title": task.title if task else "Unknown",
            "task_location": task.location if task else "",
            "task_category": task.category if task else "",
            "task_photo_url": task.photo_url if task else None,
            "checked_in_at": s.checked_in_at.isoformat() if s.checked_in_at else None,
            "checked_out_at": s.checked_out_at.isoformat() if s.checked_out_at else None,
            "elapsed_minutes": elapsed,
            "earnings": s.earnings,
            "rating": s.rating,
            "feedback": s.feedback,
            "proof_notes": s.proof_notes,
            "proof_photo_url": s.proof_photo_url,
        })
    return out


@router.get("/stats")
async def get_performance_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Monthly performance stats: hours, earnings, average rating, counts."""
    from calendar import monthrange
    from datetime import date

    today = date.today()
    month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc)
    last_day = monthrange(today.year, today.month)[1]
    month_end = datetime(today.year, today.month, last_day, 23, 59, 59, tzinfo=timezone.utc)

    # All completed and settled sessions
    all_result = await db.execute(
        select(TaskSession).where(
            TaskSession.worker_id == current_user.id,
            TaskSession.status.in_([SessionStatus.COMPLETED, SessionStatus.SETTLED]),
        )
    )
    all_sessions = all_result.scalars().all()

    # This month's completed sessions
    month_sessions = [
        s for s in all_sessions
        if s.checked_out_at and month_start <= s.checked_out_at.replace(tzinfo=timezone.utc) <= month_end
    ]

    # Monthly totals
    month_minutes = sum(
        (s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
        for s in month_sessions
        if s.checked_in_at and s.checked_out_at
    )
    month_earnings = sum(s.earnings or 0 for s in month_sessions)

    # All-time totals
    total_minutes = sum(
        (s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
        for s in all_sessions
        if s.checked_in_at and s.checked_out_at
    )
    total_earnings = sum(s.earnings or 0 for s in all_sessions)

    # Ratings
    rated = [s for s in all_sessions if s.rating is not None]
    avg_rating = round(sum(s.rating for s in rated) / len(rated), 2) if rated else None

    return {
        "this_month": {
            "sessions": len(month_sessions),
            "hours": round(month_minutes / 60, 1),
            "minutes": round(month_minutes, 0),
            "earnings": round(month_earnings, 2),
        },
        "all_time": {
            "sessions": len(all_sessions),
            "hours": round(total_minutes / 60, 1),
            "earnings": round(total_earnings, 2),
        },
        "rating": {
            "average": avg_rating,
            "count": len(rated),
        },
    }


@router.post("/{session_id}/rate")
async def rate_session(
    session_id: uuid.UUID,
    rating: float,
    feedback: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rate a completed session (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    if not (1.0 <= rating <= 5.0):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Rating must be 1.0–5.0")

    result = await db.execute(
        select(TaskSession).where(
            TaskSession.id == session_id,
            TaskSession.status == SessionStatus.COMPLETED,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Completed session not found")

    session.rating = round(rating, 1)
    session.feedback = feedback
    await db.flush()
    return {"session_id": str(session.id), "rating": session.rating, "feedback": session.feedback}
