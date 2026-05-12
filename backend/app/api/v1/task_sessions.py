import uuid
import os
import shutil
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.task_session import TaskSession, SessionStatus
from app.models.application import Application, ApplicationStatus
from app.models.task import Task
from app.schemas.task_session import CheckInRequest, CheckOutRequest, TaskSessionResponse, EarningsResponse
from app.core.deps import get_current_user
from app.models.user import User
from app.models.wallet import Wallet, Transaction, TransactionType
from app.config import get_settings

router = APIRouter(prefix="/task-sessions", tags=["Task Tracking"])
settings = get_settings()


def get_worked_minutes(session: TaskSession) -> float:
    if not session.checked_in_at or not session.checked_out_at:
        return 0.0
    return max(
        0.0,
        (session.checked_out_at.replace(tzinfo=timezone.utc) - session.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60,
    )


async def finalize_checkout(
    session: TaskSession,
    task: Task,
    current_user: User,
    db: AsyncSession,
    proof_notes: str | None,
    photo_url: str | None = None,
) -> TaskSessionResponse:
    now = datetime.now(timezone.utc)
    elapsed_minutes = (now - session.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
    earnings = round(elapsed_minutes * task.pay_rate_per_minute, 2)
    minimum_duration_met = elapsed_minutes >= task.estimated_duration_minutes

    session.checked_out_at = now
    session.earnings = earnings
    session.status = SessionStatus.COMPLETED
    session.proof_notes = proof_notes
    if photo_url:
        session.proof_photo_url = photo_url

    if minimum_duration_met:
        wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == current_user.id))
        wallet = wallet_result.scalar_one_or_none()
        if not wallet:
            wallet = Wallet(user_id=current_user.id)
            db.add(wallet)
            await db.flush()
        wallet.available_balance = round(wallet.available_balance + earnings, 2)
        txn = Transaction(
            user_id=current_user.id,
            type=TransactionType.CREDIT,
            amount=earnings,
            description=f"Earnings from task: {task.title}",
            reference_id=str(session.id),
        )
        db.add(txn)

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
        # Resume a paused session — preserve time worked so far
        worked_minutes = get_worked_minutes(previous_session)
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
        allowed_ext = {".jpg", ".jpeg", ".png", ".webp"}
        if ext not in allowed_ext:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid image type")
        size = 0
        filename = f"proof_{session_id}{ext}"
        save_path = os.path.join(settings.MEDIA_DIR, filename)
        os.makedirs(settings.MEDIA_DIR, exist_ok=True)
        with open(save_path, "wb") as f:
            while chunk := await proof_photo.read(1024 * 64):
                size += len(chunk)
                if size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
                f.write(chunk)
        photo_url = f"/media/{filename}"

    return await finalize_checkout(session, task, current_user, db, proof_notes, photo_url)


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
    """Get real-time earnings for an active session."""
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

    now = datetime.now(timezone.utc)
    ref_time = session.checked_out_at or now
    elapsed_minutes = (ref_time.replace(tzinfo=timezone.utc) - session.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
    current_earnings = session.earnings if session.status == SessionStatus.COMPLETED else round(elapsed_minutes * task.pay_rate_per_minute, 2)

    return EarningsResponse(
        session_id=session.id,
        checked_in_at=session.checked_in_at,
        elapsed_minutes=round(elapsed_minutes, 2),
        pay_rate_per_minute=task.pay_rate_per_minute,
        current_earnings=current_earnings,
        status=session.status,
    )


@router.get("/my", response_model=list[TaskSessionResponse])
async def my_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all task sessions for the current worker."""
    result = await db.execute(
        select(TaskSession)
        .where(TaskSession.worker_id == current_user.id)
        .order_by(TaskSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return [TaskSessionResponse.model_validate(s) for s in sessions]


@router.get("/active", response_model=TaskSessionResponse | None)
async def get_active_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current worker's active session, if any."""
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


# ── History & Performance ─────────────────────────────────────────────────────

@router.get("/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Completed sessions with full task details for the worker's history page."""
    result = await db.execute(
        select(TaskSession)
        .where(
            TaskSession.worker_id == current_user.id,
            TaskSession.status == SessionStatus.COMPLETED,
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

    # All completed sessions
    all_result = await db.execute(
        select(TaskSession).where(
            TaskSession.worker_id == current_user.id,
            TaskSession.status == SessionStatus.COMPLETED,
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
