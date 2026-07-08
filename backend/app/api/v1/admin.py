import json
import os
import subprocess
import tempfile
import urllib.parse
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_db
from app.models.application import Application, ApplicationStatus
from app.models.task import Task
from app.models.user import User
from app.models.task_session import TaskSession, SessionStatus
from app.schemas.application import ApplicationResponse, ApplicationWithDetails
from app.schemas.user import UserResponse, UserPublic
from app.schemas.task import TaskResponse
from app.core.deps import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])


def build_user_public(user: User) -> UserPublic:
    skills = user.skills
    if isinstance(skills, str):
        skills = json.loads(skills)
    return UserPublic.model_validate({
        "id": user.id,
        "full_name": user.full_name,
        "profile_photo_url": user.profile_photo_url,
        "location": user.location,
        "skills": skills,
    })


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ── Applications ──────────────────────────────────────────────────────────────

@router.get("/applications", response_model=list[ApplicationWithDetails])
async def admin_list_applications(
    task_id: uuid.UUID | None = Query(None),
    app_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all applications, optionally filtered by task or status."""
    filters = []
    if task_id:
        filters.append(Application.task_id == task_id)
    if app_status:
        filters.append(Application.status == app_status)

    q = select(Application).order_by(Application.created_at.desc())
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    applications = result.scalars().all()

    response = []
    for app in applications:
        app_base = ApplicationResponse.model_validate(app)
        app_data = ApplicationWithDetails(**app_base.model_dump())
        task_result = await db.execute(select(Task).where(Task.id == app.task_id))
        task = task_result.scalar_one_or_none()
        if task:
            count_result = await db.execute(select(func.count()).select_from(Application).where(Application.task_id == task.id))
            td = TaskResponse.model_validate(task)
            td.application_count = count_result.scalar_one()
            app_data.task = td
        worker_result = await db.execute(select(User).where(User.id == app.worker_id))
        worker = worker_result.scalar_one_or_none()
        if worker:
            app_data.worker = build_user_public(worker)
        response.append(app_data)
    return response


# ── Users / Workers ───────────────────────────────────────────────────────────

class WorkerStats(BaseModel):
    total_sessions: int
    completed_sessions: int
    total_earnings: float


class UserWithStats(UserResponse):
    stats: WorkerStats | None = None


# ⚠️ MUST be registered BEFORE /users/{user_id} so FastAPI matches "unverified" first
@router.get("/users/unverified")
async def admin_unverified_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all unverified users awaiting admin approval."""
    result = await db.execute(
        select(User)
        .where(User.is_verified == False, User.is_admin == False)
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    out = []
    for u in users:
        sessions_result = await db.execute(
            select(TaskSession).where(TaskSession.worker_id == u.id)
        )
        sessions = sessions_result.scalars().all()
        completed = [s for s in sessions if s.status == SessionStatus.COMPLETED]
        out.append({
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "profile_photo_url": u.profile_photo_url,
            "location": u.location,
            "nationality": u.nationality,
            "race": u.race,
            "nric_passport": u.nric_passport,
            "academic_qualification": u.academic_qualification,
            "body_height_cm": u.body_height_cm,
            "bank_qr_code_url": u.bank_qr_code_url,
            "total_sessions": len(sessions),
            "completed_sessions": len(completed),
            "created_at": u.created_at.isoformat(),
        })
    return out


@router.get("/users", response_model=list[UserResponse])
async def admin_list_users(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all users."""
    q = select(User).order_by(User.created_at.desc())
    result = await db.execute(q)
    users = result.scalars().all()
    if search:
        s = search.lower()
        users = [u for u in users if s in u.full_name.lower() or s in u.email.lower()]
    return [UserResponse.model_validate(u) for u in users]


@router.get("/users/{user_id}", response_model=UserWithStats)
async def admin_get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Get a user's profile with session performance stats."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    sessions_result = await db.execute(select(TaskSession).where(TaskSession.worker_id == user_id))
    sessions = sessions_result.scalars().all()
    completed = [s for s in sessions if s.status == SessionStatus.COMPLETED]
    total_earnings = sum(s.earnings or 0 for s in completed)

    user_data = UserWithStats.model_validate(user)
    user_data.stats = WorkerStats(
        total_sessions=len(sessions),
        completed_sessions=len(completed),
        total_earnings=round(total_earnings, 2),
    )
    return user_data


@router.get("/users/{user_id}/sessions")
async def admin_get_user_sessions(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Get all task sessions for a worker (past performance)."""
    sessions_result = await db.execute(
        select(TaskSession).where(TaskSession.worker_id == user_id).order_by(TaskSession.created_at.desc())
    )
    sessions = sessions_result.scalars().all()
    out = []
    for s in sessions:
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()
        elapsed = None
        if s.checked_in_at and s.checked_out_at:
            elapsed = round((s.checked_out_at - s.checked_in_at).total_seconds() / 60, 1)
        out.append({
            "id": str(s.id),
            "task_title": task.title if task else "Unknown",
            "task_location": task.location if task else "",
            "checked_in_at": s.checked_in_at.isoformat() if s.checked_in_at else None,
            "checked_out_at": s.checked_out_at.isoformat() if s.checked_out_at else None,
            "elapsed_minutes": elapsed,
            "earnings": s.earnings,
            "status": s.status,
            "proof_notes": s.proof_notes,
            "proof_photo_url": s.proof_photo_url,
        })
    return out


class UserVerificationAction(BaseModel):
    action: str  # "approve" or "reject"


@router.post("/users/{user_id}/verify")
async def admin_verify_user(
    user_id: uuid.UUID,
    payload: UserVerificationAction,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Approve or reject a user registration."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    action = payload.action.lower()
    if action == "approve":
        user.is_verified = True
        user.is_active = True
        await db.flush()
        return {"status": "approved", "user_id": str(user.id)}
    elif action == "reject":
        await db.delete(user)
        await db.flush()
        return {"status": "rejected", "user_id": str(user.id)}

    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="action must be 'approve' or 'reject'")


# ── Active Workers ────────────────────────────────────────────────────────────

@router.get("/workers/active")
async def admin_active_workers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all workers currently checked in (active sessions)."""
    result = await db.execute(
        select(TaskSession).where(TaskSession.status == SessionStatus.ACTIVE)
        .order_by(TaskSession.checked_in_at.asc())
    )
    sessions = result.scalars().all()
    out = []
    from datetime import timezone
    now = datetime.now(timezone.utc)
    for s in sessions:
        worker_result = await db.execute(select(User).where(User.id == s.worker_id))
        worker = worker_result.scalar_one_or_none()
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()
        elapsed = round((now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1)
        cap = float(task.estimated_duration_minutes) if task and task.estimated_duration_minutes > 0 else None
        capped_elapsed = round(min(elapsed, cap), 1) if cap else elapsed
        current_earnings = round(capped_elapsed * (task.pay_rate_per_minute if task else 0), 2)
        out.append({
            "session_id": str(s.id),
            "worker_id": str(s.worker_id),
            "worker_name": worker.full_name if worker else "Unknown",
            "worker_email": worker.email if worker else "",
            "worker_photo": worker.profile_photo_url if worker else None,
            "task_id": str(s.task_id),
            "task_title": task.title if task else "Unknown",
            "task_location": task.location if task else "",
            "checked_in_at": s.checked_in_at.isoformat(),
            "elapsed_minutes": capped_elapsed,
            "current_earnings": current_earnings,
        })
    return out


@router.post("/sessions/{session_id}/force-stop")
async def admin_force_stop_session(
    session_id: uuid.UUID,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Force-terminate an active session. Credits the worker for time already worked."""
    from app.models.wallet import Wallet, Transaction, TransactionType
    from app.models.message import Message

    result = await db.execute(
        select(TaskSession).where(
            TaskSession.id == session_id,
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
    earnings = round(elapsed_minutes * task.pay_rate_per_minute, 2)

    session.checked_out_at = now
    session.earnings = earnings
    session.status = SessionStatus.COMPLETED
    session.proof_notes = f"[Admin force-stopped by {admin_user.full_name or admin_user.email}]"
    db.add(session)

    # Credit wallet regardless of minimum duration (worker did work)
    wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == session.worker_id))
    wallet = wallet_result.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(user_id=session.worker_id)
        db.add(wallet)
        await db.flush()
    wallet.available_balance = round(wallet.available_balance + earnings, 2)
    db.add(Transaction(
        user_id=session.worker_id,
        type=TransactionType.CREDIT,
        amount=earnings,
        description=f"Earnings from task: {task.title} (admin force-stopped)",
        reference_id=str(session.id),
    ))

    # Notify worker
    db.add(Message(
        sender_id=admin_user.id,
        recipient_id=session.worker_id,
        body=(
            f"⚠️ Your active session for \"{task.title}\" was stopped by an admin. "
            f"You have been credited RM {earnings:.2f} for {elapsed_minutes:.0f} minutes worked."
        ),
    ))

    await db.flush()
    return {
        "session_id": str(session.id),
        "elapsed_minutes": round(elapsed_minutes, 1),
        "earnings_credited": earnings,
        "status": session.status,
    }


# ── Withdrawal Management ─────────────────────────────────────────────────────

from app.models.wallet import Wallet, WithdrawalRequest, WithdrawalStatus, Transaction, TransactionType
from app.schemas.wallet import WithdrawalResponse
from app.models.message import Message


class WithdrawalAction(BaseModel):
    action: str   # "approve" or "reject"
    notes: str | None = None


@router.get("/withdrawals", response_model=list[dict])
async def admin_list_withdrawals(
    req_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all withdrawal requests with worker info."""
    q = select(WithdrawalRequest).order_by(WithdrawalRequest.created_at.desc())
    if req_status:
        q = q.where(WithdrawalRequest.status == req_status)
    result = await db.execute(q)
    withdrawals = result.scalars().all()
    out = []
    for w in withdrawals:
        worker_result = await db.execute(select(User).where(User.id == w.user_id))
        worker = worker_result.scalar_one_or_none()
        out.append({
            "id": str(w.id),
            "user_id": str(w.user_id),
            "worker_name": worker.full_name if worker else "Unknown",
            "worker_email": worker.email if worker else "",
            "amount": w.amount,
            "status": w.status,
            "bank_name": w.bank_name,
            "account_number": "*" * (len(w.account_number) - 4) + w.account_number[-4:],
            "account_holder_name": w.account_holder_name,
            "admin_notes": w.admin_notes,
            "processed_at": w.processed_at.isoformat() if w.processed_at else None,
            "created_at": w.created_at.isoformat(),
        })
    return out


@router.patch("/withdrawals/{withdrawal_id}")
async def admin_process_withdrawal(
    withdrawal_id: uuid.UUID,
    payload: WithdrawalAction,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a withdrawal request."""
    result = await db.execute(select(WithdrawalRequest).where(WithdrawalRequest.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Withdrawal not found")
    if withdrawal.status != WithdrawalStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Withdrawal already processed")

    now = datetime.now(timezone.utc)
    action = payload.action.lower()

    if action == "approve":
        withdrawal.status = WithdrawalStatus.APPROVED
        withdrawal.processed_at = now
        withdrawal.admin_notes = payload.notes
        txn = Transaction(
            user_id=withdrawal.user_id,
            type=TransactionType.WITHDRAWAL_COMPLETED,
            amount=-withdrawal.amount,
            description=f"Withdrawal approved to {withdrawal.bank_name} ···{withdrawal.account_number[-4:]}",
            reference_id=str(withdrawal.id),
        )
        db.add(txn)
        # Notify worker via message
        notif = Message(
            sender_id=admin_user.id,
            recipient_id=withdrawal.user_id,
            body=f"✅ Your withdrawal of RM {withdrawal.amount:.2f} has been approved and transferred to {withdrawal.bank_name} ···{withdrawal.account_number[-4:]}. Please allow 1-3 business days.",
        )
        db.add(notif)

    elif action == "reject":
        withdrawal.status = WithdrawalStatus.REJECTED
        withdrawal.processed_at = now
        withdrawal.admin_notes = payload.notes
        # Refund the amount back to wallet
        wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == withdrawal.user_id))
        wallet = wallet_result.scalar_one_or_none()
        if wallet:
            wallet.available_balance = round(wallet.available_balance + withdrawal.amount, 2)
        txn = Transaction(
            user_id=withdrawal.user_id,
            type=TransactionType.WITHDRAWAL_REJECTED,
            amount=withdrawal.amount,
            description=f"Withdrawal rejected — RM {withdrawal.amount:.2f} refunded to wallet",
            reference_id=str(withdrawal.id),
        )
        db.add(txn)
        # Notify worker via message
        reason = f" Reason: {payload.notes}" if payload.notes else ""
        notif = Message(
            sender_id=admin_user.id,
            recipient_id=withdrawal.user_id,
            body=f"❌ Your withdrawal of RM {withdrawal.amount:.2f} was rejected and has been refunded to your wallet.{reason}",
        )
        db.add(notif)
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="action must be 'approve' or 'reject'")

    await db.flush()
    return {"status": withdrawal.status, "id": str(withdrawal.id)}


# ── Time Logs (all sessions, filterable) ─────────────────────────────────────

@router.get("/time-logs")
async def admin_time_logs(
    task_id: uuid.UUID | None = Query(None),
    worker_id: uuid.UUID | None = Query(None),
    log_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """All task sessions (active + completed) with full cost details."""
    q = select(TaskSession).order_by(TaskSession.checked_in_at.desc())
    if task_id:
        q = q.where(TaskSession.task_id == task_id)
    if worker_id:
        q = q.where(TaskSession.worker_id == worker_id)
    if log_status:
        q = q.where(TaskSession.status == log_status)
    result = await db.execute(q)
    sessions = result.scalars().all()

    now = datetime.now(timezone.utc)
    out = []
    for s in sessions:
        worker_result = await db.execute(select(User).where(User.id == s.worker_id))
        worker = worker_result.scalar_one_or_none()
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()

        if s.status == SessionStatus.ACTIVE:
            elapsed = round((now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1)
            cost = round(elapsed * (task.pay_rate_per_minute if task else 0), 2)
        else:
            if s.checked_in_at and s.checked_out_at:
                elapsed = round(
                    (s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1
                )
            else:
                elapsed = None
            cost = s.earnings

        out.append({
            "session_id": str(s.id),
            "worker_id": str(s.worker_id),
            "worker_name": worker.full_name if worker else "Unknown",
            "worker_email": worker.email if worker else "",
            "task_id": str(s.task_id),
            "task_title": task.title if task else "Unknown",
            "task_location": task.location if task else "",
            "pay_rate_per_minute": task.pay_rate_per_minute if task else 0,
            "checked_in_at": s.checked_in_at.isoformat() if s.checked_in_at else None,
            "checked_out_at": s.checked_out_at.isoformat() if s.checked_out_at else None,
            "elapsed_minutes": elapsed,
            "cost": cost,
            "status": s.status,
            "rating": s.rating,
        })
    return out


# ── Manual Time Adjustment ────────────────────────────────────────────────────

class TimeAdjustment(BaseModel):
    checked_in_at: datetime
    checked_out_at: datetime | None = None
    reason: str | None = None


@router.patch("/sessions/{session_id}/adjust")
async def admin_adjust_session_time(
    session_id: uuid.UUID,
    payload: TimeAdjustment,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually adjust check-in / check-out times. Recalculates earnings and updates wallet."""
    result = await db.execute(select(TaskSession).where(TaskSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()

    old_earnings = session.earnings or 0.0

    # Apply new times
    session.checked_in_at = payload.checked_in_at.replace(tzinfo=timezone.utc) if payload.checked_in_at.tzinfo is None else payload.checked_in_at

    if payload.checked_out_at:
        co = payload.checked_out_at.replace(tzinfo=timezone.utc) if payload.checked_out_at.tzinfo is None else payload.checked_out_at
        session.checked_out_at = co
        elapsed = (co - session.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
        new_earnings = round(elapsed * task.pay_rate_per_minute, 2)
        session.earnings = new_earnings
        session.status = SessionStatus.COMPLETED

        # Adjust wallet balance by the diff
        diff = new_earnings - old_earnings
        wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == session.worker_id))
        wallet = wallet_result.scalar_one_or_none()
        if wallet and diff != 0:
            wallet.available_balance = round(wallet.available_balance + diff, 2)
            # Record adjustment transaction
            reason_note = f" Reason: {payload.reason}" if payload.reason else ""
            db.add(Transaction(
                user_id=session.worker_id,
                type=TransactionType.CREDIT if diff > 0 else TransactionType.WITHDRAWAL_PENDING,
                amount=abs(diff),
                description=f"Time adjustment by admin (session {str(session_id)[:8]}…){reason_note}",
                reference_id=str(session_id),
            ))
        # Notify worker
        reason_note = f" Reason: {payload.reason}" if payload.reason else ""
        db.add(Message(
            sender_id=admin_user.id,
            recipient_id=session.worker_id,
            body=f"⏱ Your work session time was adjusted by an admin. New earnings: RM {new_earnings:.2f}.{reason_note}",
        ))
    else:
        # Only check-in adjustment (active session)
        new_earnings = None

    await db.flush()
    return {
        "session_id": str(session.id),
        "checked_in_at": session.checked_in_at.isoformat(),
        "checked_out_at": session.checked_out_at.isoformat() if session.checked_out_at else None,
        "old_earnings": old_earnings,
        "new_earnings": session.earnings,
        "status": session.status,
    }


import math

# ── Task Listing (Admin) ──────────────────────────────────────────────────────

@router.get("/tasks")
async def admin_list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    task_status: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all tasks regardless of status, with optional status/search filter."""
    from app.models.task import TaskStatus
    from app.schemas.task import TaskListResponse
    filters = []
    if task_status:
        filters.append(Task.status == task_status)
    if search:
        filters.append(Task.title.ilike(f"%{search}%"))

    q = select(Task).order_by(Task.created_at.desc())
    if filters:
        q = q.where(and_(*filters))

    count_q = select(func.count()).select_from(Task)
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(q.offset(offset).limit(page_size))
    tasks = result.scalars().all()

    task_responses = []
    for task in tasks:
        count_result = await db.execute(
            select(func.count()).select_from(Application).where(Application.task_id == task.id)
        )
        task_data = TaskResponse.model_validate(task)
        task_data.application_count = count_result.scalar_one()
        task_responses.append(task_data)

    return TaskListResponse(
        tasks=task_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ── Task Cost Summary ─────────────────────────────────────────────────────────

@router.get("/tasks/{task_id}/cost")
async def admin_task_cost(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Breakdown of total cost for a task across all sessions."""
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    sessions_result = await db.execute(select(TaskSession).where(TaskSession.task_id == task_id))
    sessions = sessions_result.scalars().all()

    now = datetime.now(timezone.utc)
    completed = [s for s in sessions if s.status == SessionStatus.COMPLETED]
    active = [s for s in sessions if s.status == SessionStatus.ACTIVE]

    paid_cost = sum(s.earnings or 0 for s in completed)
    live_cost = sum(
        round((now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60 * task.pay_rate_per_minute, 2)
        for s in active
    )
    estimated_total = task.pay_rate_per_minute * task.estimated_duration_minutes

    return {
        "task_id": str(task_id),
        "task_title": task.title,
        "pay_rate_per_minute": task.pay_rate_per_minute,
        "estimated_duration_minutes": task.estimated_duration_minutes,
        "estimated_total_cost": round(estimated_total, 2),
        "paid_cost": round(paid_cost, 2),
        "live_accruing_cost": round(live_cost, 2),
        "total_projected_cost": round(paid_cost + live_cost, 2),
        "completed_sessions": len(completed),
        "active_sessions": len(active),
    }


@router.get("/tasks/costs")
async def admin_all_task_costs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cost summary for every task (for budget overview table)."""
    tasks_result = await db.execute(select(Task).order_by(Task.created_at.desc()))
    tasks = tasks_result.scalars().all()

    sessions_result = await db.execute(select(TaskSession))
    all_sessions = sessions_result.scalars().all()

    now = datetime.now(timezone.utc)
    out = []
    for t in tasks:
        t_sessions = [s for s in all_sessions if s.task_id == t.id]
        paid = sum(s.earnings or 0 for s in t_sessions if s.status == SessionStatus.COMPLETED)
        live = sum(
            (now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60 * t.pay_rate_per_minute
            for s in t_sessions if s.status == SessionStatus.ACTIVE
        )
        estimated = t.pay_rate_per_minute * t.estimated_duration_minutes
        out.append({
            "task_id": str(t.id),
            "task_title": t.title,
            "status": t.status,
            "pay_rate_per_minute": t.pay_rate_per_minute,
            "estimated_cost": round(estimated, 2),
            "paid_cost": round(paid, 2),
            "live_cost": round(live, 2),
            "total_cost": round(paid + live, 2),
            "session_count": len(t_sessions),
        })
    return out


# ── Reporting & Analytics ─────────────────────────────────────────────────────

import io
import csv
from calendar import monthrange
from fastapi.responses import StreamingResponse


@router.get("/analytics/dashboard")
async def analytics_dashboard(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Key metrics for the admin dashboard overview."""
    from app.models.wallet import WithdrawalRequest, WithdrawalStatus

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Counts
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_tasks = (await db.execute(select(func.count()).select_from(Task))).scalar_one()
    total_apps = (await db.execute(select(func.count()).select_from(Application))).scalar_one()
    active_workers = (await db.execute(
        select(func.count()).select_from(TaskSession).where(TaskSession.status == SessionStatus.ACTIVE)
    )).scalar_one()

    # Tasks by status
    tasks_result = await db.execute(select(Task))
    all_tasks = tasks_result.scalars().all()
    open_tasks = sum(1 for t in all_tasks if t.status == "open")
    completed_tasks = sum(1 for t in all_tasks if t.status == "completed")
    cancelled_tasks = sum(1 for t in all_tasks if t.status == "cancelled")

    # Sessions
    sessions_result = await db.execute(select(TaskSession))
    all_sessions = sessions_result.scalars().all()
    completed_sessions = [s for s in all_sessions if s.status == SessionStatus.COMPLETED]

    # Revenue (total paid out)
    total_revenue = sum(s.earnings or 0 for s in completed_sessions)

    # Active accruing cost
    live_cost = sum(
        (now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60 *
        next((t.pay_rate_per_minute for t in all_tasks if t.id == s.task_id), 0)
        for s in all_sessions if s.status == SessionStatus.ACTIVE
    )

    # Today's sessions
    today_sessions = [
        s for s in completed_sessions
        if s.checked_out_at and s.checked_out_at.replace(tzinfo=timezone.utc) >= today_start
    ]
    today_revenue = sum(s.earnings or 0 for s in today_sessions)

    # Pending withdrawals
    pend_wd = (await db.execute(
        select(func.count()).select_from(WithdrawalRequest).where(WithdrawalRequest.status == "PENDING")
    )).scalar_one()

    # Applications by status
    apps_result = await db.execute(select(Application))
    all_apps = apps_result.scalars().all()

    # Task completion rate
    completion_rate = round(completed_tasks / total_tasks * 100, 1) if total_tasks else 0

    # Average rating
    rated = [s for s in completed_sessions if s.rating is not None]
    avg_rating = round(sum(s.rating for s in rated) / len(rated), 2) if rated else None

    return {
        "users": {"total": total_users},
        "tasks": {
            "total": total_tasks,
            "open": open_tasks,
            "completed": completed_tasks,
            "cancelled": cancelled_tasks,
            "completion_rate": completion_rate,
        },
        "applications": {
            "total": total_apps,
            "pending": sum(1 for a in all_apps if a.status == "pending"),
            "approved": sum(1 for a in all_apps if a.status == "approved"),
        },
        "sessions": {
            "total": len(all_sessions),
            "completed": len(completed_sessions),
            "active_now": active_workers,
        },
        "revenue": {
            "total_paid": round(total_revenue, 2),
            "live_accruing": round(live_cost, 2),
            "today": round(today_revenue, 2),
        },
        "withdrawals": {"pending": pend_wd},
        "rating": {"average": avg_rating, "count": len(rated)},
    }


@router.get("/analytics/monthly")
async def analytics_monthly(
    year: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Monthly spending/earnings breakdown for the last 12 months (or given year)."""
    now = datetime.now(timezone.utc)
    target_year = year or now.year

    sessions_result = await db.execute(
        select(TaskSession).where(TaskSession.status == SessionStatus.COMPLETED)
    )
    sessions = sessions_result.scalars().all()

    monthly = []
    for month in range(1, 13):
        last_day = monthrange(target_year, month)[1]
        m_start = datetime(target_year, month, 1, tzinfo=timezone.utc)
        m_end = datetime(target_year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
        m_sessions = [
            s for s in sessions
            if s.checked_out_at and m_start <= s.checked_out_at.replace(tzinfo=timezone.utc) <= m_end
        ]
        spending = sum(s.earnings or 0 for s in m_sessions)
        hours = sum(
            (s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
            for s in m_sessions if s.checked_in_at and s.checked_out_at
        )
        monthly.append({
            "month": month,
            "month_name": m_start.strftime("%b"),
            "year": target_year,
            "sessions": len(m_sessions),
            "spending": round(spending, 2),
            "hours": round(hours, 1),
        })
    return {"year": target_year, "months": monthly}


@router.get("/analytics/task-completion")
async def analytics_task_completion(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Task completion rates by category."""
    tasks_result = await db.execute(select(Task))
    all_tasks = tasks_result.scalars().all()

    # By category
    categories: dict[str, dict] = {}
    for t in all_tasks:
        cat = t.category or "Other"
        if cat not in categories:
            categories[cat] = {"total": 0, "completed": 0, "cancelled": 0, "open": 0}
        categories[cat]["total"] += 1
        if t.status == "completed":
            categories[cat]["completed"] += 1
        elif t.status == "cancelled":
            categories[cat]["cancelled"] += 1
        else:
            categories[cat]["open"] += 1

    result = []
    for cat, counts in sorted(categories.items()):
        rate = round(counts["completed"] / counts["total"] * 100, 1) if counts["total"] else 0
        result.append({
            "category": cat,
            "total": counts["total"],
            "completed": counts["completed"],
            "cancelled": counts["cancelled"],
            "open": counts["open"],
            "completion_rate": rate,
        })

    total = len(all_tasks)
    completed = sum(1 for t in all_tasks if t.status == "completed")
    return {
        "overall_rate": round(completed / total * 100, 1) if total else 0,
        "by_category": result,
    }


@router.get("/analytics/export/workers")
async def export_workers_csv(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Export all worker data to CSV (Excel-compatible)."""
    users_result = await db.execute(select(User).where(User.is_admin == False).order_by(User.created_at.desc()))
    users = users_result.scalars().all()

    sessions_result = await db.execute(select(TaskSession).where(TaskSession.status == SessionStatus.COMPLETED))
    all_sessions = sessions_result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Full Name", "Email", "Location", "Joined",
        "Total Sessions", "Total Hours", "Total Earnings (RM)",
        "Average Rating", "Is Verified",
    ])

    for u in users:
        u_sessions = [s for s in all_sessions if s.worker_id == u.id]
        hours = sum(
            (s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
            for s in u_sessions if s.checked_in_at and s.checked_out_at
        )
        earnings = sum(s.earnings or 0 for s in u_sessions)
        rated = [s for s in u_sessions if s.rating is not None]
        avg_r = round(sum(s.rating for s in rated) / len(rated), 2) if rated else ""
        writer.writerow([
            u.full_name,
            u.email,
            u.location or "",
            u.created_at.strftime("%Y-%m-%d"),
            len(u_sessions),
            round(hours, 1),
            round(earnings, 2),
            avg_r,
            "Yes" if u.is_verified else "No",
        ])

    output.seek(0)
    filename = f"workers_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Enhanced Worker Export CSV ───────────────────────────────────────────────

@router.get("/export/workers-detailed")
async def export_workers_detailed_csv(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Export detailed worker data with NRIC, bank QR, per-task earnings, and payment status."""
    from app.models.wallet import WithdrawalRequest, Wallet

    users_result = await db.execute(select(User).where(User.is_admin == False).order_by(User.created_at.desc()))
    users = users_result.scalars().all()

    sessions_result = await db.execute(select(TaskSession).order_by(TaskSession.created_at.desc()))
    all_sessions = sessions_result.scalars().all()

    withdrawals_result = await db.execute(select(WithdrawalRequest))
    all_withdrawals = withdrawals_result.scalars().all()

    now = datetime.now(timezone.utc)
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Full Name", "Email", "Phone", "Location",
        "Nationality", "Race", "Academic Qualification",
        "Body Height (cm)", "NRIC / Passport",
        "Bank QR Image URL",
        "Is Verified", "Joined Date",
        "Task Title", "Task Category", "Task Location",
        "Check-In", "Check-Out", "Duration (min)",
        "Earnings (RM)", "Payment Status",
        "Withdrawal Status", "Withdrawal Amount (RM)", "Withdrawal Date",
        "Rating", "Feedback",
    ])

    for u in users:
        u_sessions = [s for s in all_sessions if s.worker_id == u.id]
        u_withdrawals = [w for w in all_withdrawals if w.user_id == u.id]

        if not u_sessions:
            # User with no sessions — write one row with user info only
            writer.writerow([
                u.full_name, u.email, "", u.location or "",
                u.nationality or "", u.race or "", u.academic_qualification or "",
                u.body_height_cm or "", u.nric_passport or "",
                u.bank_qr_code_url or "",
                "Yes" if u.is_verified else "No",
                u.created_at.strftime("%Y-%m-%d %H:%M"),
                "", "", "", "", "", "", "", "", "", "", "", "",
            ])
        else:
            for s in u_sessions:
                task_result = await db.execute(select(Task).where(Task.id == s.task_id))
                task = task_result.scalar_one_or_none()

                elapsed = None
                if s.checked_in_at and s.checked_out_at:
                    elapsed = round(
                        (s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1
                    )

                # Check if this session's earnings have been withdrawn
                withdrawal = next((w for w in u_withdrawals if w.reference_id == str(s.id)), None)
                payment_status = "Pending Approval"
                withdrawal_status = ""
                withdrawal_amount = ""
                withdrawal_date = ""

                if s.earnings and s.earnings > 0:
                    # Check wallet transactions for this session
                    wallet_result = await db.execute(
                        select(Wallet).where(Wallet.user_id == u.id)
                    )
                    wallet = wallet_result.scalar_one_or_none()
                    if wallet:
                        from app.models.wallet import Transaction as Txn
                        txn_result = await db.execute(
                            select(Txn).where(
                                Txn.reference_id == str(s.id),
                                Txn.type == "CREDIT"
                            )
                        )
                        txn = txn_result.scalar_one_or_none()
                        if txn:
                            payment_status = "Approved & Credited"

                if withdrawal:
                    withdrawal_status = withdrawal.status
                    withdrawal_amount = withdrawal.amount
                    withdrawal_date = withdrawal.processed_at.strftime("%Y-%m-%d %H:%M") if withdrawal.processed_at else ""

                writer.writerow([
                    u.full_name, u.email, "", u.location or "",
                    u.nationality or "", u.race or "", u.academic_qualification or "",
                    u.body_height_cm or "", u.nric_passport or "",
                    u.bank_qr_code_url or "",
                    "Yes" if u.is_verified else "No",
                    u.created_at.strftime("%Y-%m-%d %H:%M"),
                    task.title if task else "Unknown",
                    task.category if task else "",
                    task.location if task else "",
                    s.checked_in_at.strftime("%Y-%m-%d %H:%M") if s.checked_in_at else "",
                    s.checked_out_at.strftime("%Y-%m-%d %H:%M") if s.checked_out_at else "",
                    elapsed or "",
                    s.earnings if s.earnings else "",
                    payment_status,
                    withdrawal_status,
                    withdrawal_amount,
                    withdrawal_date,
                    s.rating if s.rating else "",
                    s.feedback or "",
                ])

    output.seek(0)
    filename = f"workers_detailed_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Database Backup & Restore ─────────────────────────────────────────────────

def _parse_db_url(database_url: str) -> dict:
    """Parse a SQLAlchemy DATABASE_URL into pg_dump/psql-compatible parts."""
    # Strip driver suffix: postgresql+asyncpg:// → postgresql://
    normalized = database_url.split("+")[0] + "://" + database_url.split("://", 1)[1]
    parsed = urllib.parse.urlparse(normalized)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "dbname": (parsed.path or "/postgres").lstrip("/"),
    }


@router.get("/database/backup")
async def database_backup(
    _: User = Depends(require_admin),
):
    """
    Stream a full pg_dump of the database as a .sql file download.
    The dump uses --clean --if-exists so it can be used to fully restore later.
    """
    from app.config import get_settings as _get_settings
    settings = _get_settings()
    db_parts = _parse_db_url(settings.DATABASE_URL)

    env = {**os.environ, "PGPASSWORD": db_parts["password"]}
    args = [
        "pg_dump",
        "-h", db_parts["host"],
        "-p", db_parts["port"],
        "-U", db_parts["user"],
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        db_parts["dbname"],
    ]

    try:
        proc = subprocess.run(args, capture_output=True, env=env, timeout=300)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="pg_dump not found. Ensure postgresql-client is installed in the backend container.",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="pg_dump timed out")

    if proc.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"pg_dump failed: {proc.stderr.decode(errors='replace')[:500]}",
        )

    dump_bytes = proc.stdout
    filename = f"fleksitask_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.sql"
    return StreamingResponse(
        iter([dump_bytes]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/database/restore")
async def database_restore(
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
):
    """
    Restore the database from a pg_dump .sql file.
    WARNING: This drops and recreates all tables. All existing data will be replaced.
    """
    if not (file.filename or "").lower().endswith(".sql"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .sql files are accepted")

    content = await file.read()
    if len(content) < 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File appears to be empty or too small")

    # Sanity check: pg_dump files start with a comment or SET statement
    preview = content[:200].decode(errors="replace").lstrip()
    if not (preview.startswith("--") or preview.startswith("SET") or preview.startswith("/*")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not appear to be a valid pg_dump SQL file",
        )

    from app.config import get_settings as _get_settings
    settings = _get_settings()
    db_parts = _parse_db_url(settings.DATABASE_URL)

    # Write to a temp file and run psql
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".sql")
    try:
        os.write(tmp_fd, content)
        os.close(tmp_fd)

        env = {**os.environ, "PGPASSWORD": db_parts["password"]}
        args = [
            "psql",
            "-h", db_parts["host"],
            "-p", db_parts["port"],
            "-U", db_parts["user"],
            "-d", db_parts["dbname"],
            "--single-transaction",
            "-f", tmp_path,
        ]

        try:
            proc = subprocess.run(args, capture_output=True, env=env, timeout=600)
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="psql not found. Ensure postgresql-client is installed in the backend container.",
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="psql restore timed out")

        if proc.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Restore failed: {proc.stderr.decode(errors='replace')[:500]}",
            )

        return {
            "message": "Database restored successfully",
            "filename": file.filename,
            "size_bytes": len(content),
        }
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Session Approval (Admin validates & credits worker) ──────────────────────

from app.models.task_session import TaskSession as _TaskSessionForApproval
from app.models.task import TaskStatus as _TaskStatusForApproval
from app.models.wallet import Wallet as _WalletForApproval, Transaction as _TransactionForApproval, TransactionType as _TransactionTypeForApproval
from app.models.message import Message as _MessageForApproval


@router.get("/sessions/pending-approval")
async def admin_pending_sessions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all completed sessions awaiting admin approval/credit."""
    result = await db.execute(
        select(_TaskSessionForApproval)
        .where(_TaskSessionForApproval.status == SessionStatus.COMPLETED)
        .order_by(_TaskSessionForApproval.checked_out_at.desc())
    )
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        worker_result = await db.execute(select(User).where(User.id == s.worker_id))
        worker = worker_result.scalar_one_or_none()
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()
        out.append({
            "session_id": str(s.id),
            "worker_id": str(s.worker_id),
            "worker_name": worker.full_name if worker else "Unknown",
            "worker_email": worker.email if worker else "",
            "task_id": str(s.task_id),
            "task_title": task.title if task else "Unknown",
            "task_location": task.location if task else "",
            "checked_in_at": s.checked_in_at.isoformat() if s.checked_in_at else None,
            "checked_out_at": s.checked_out_at.isoformat() if s.checked_out_at else None,
            "earnings": s.earnings,
            "proof_notes": s.proof_notes,
            "proof_photo_url": s.proof_photo_url,
            "status": s.status,
        })
    return out


class SessionApprovalAction(BaseModel):
    action: str  # "approve" or "reject"
    notes: str | None = None


@router.post("/sessions/{session_id}/approve")
async def admin_approve_session(
    session_id: uuid.UUID,
    payload: SessionApprovalAction,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a completed session and credit the worker's wallet."""
    result = await db.execute(
        select(_TaskSessionForApproval).where(
            _TaskSessionForApproval.id == session_id,
            _TaskSessionForApproval.status == SessionStatus.COMPLETED,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Completed session not found")

    if not session.earnings or session.earnings <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session has no calculable earnings")

    action = payload.action.lower()
    if action == "approve":
        wallet_result = await db.execute(select(_WalletForApproval).where(_WalletForApproval.user_id == session.worker_id))
        wallet = wallet_result.scalar_one_or_none()
        if not wallet:
            wallet = _WalletForApproval(user_id=session.worker_id)
            db.add(wallet)
            await db.flush()
        wallet.available_balance = round(wallet.available_balance + session.earnings, 2)

        task_result = await db.execute(select(Task).where(Task.id == session.task_id))
        task = task_result.scalar_one()
        db.add(_TransactionForApproval(
            user_id=session.worker_id,
            type=_TransactionTypeForApproval.CREDIT,
            amount=session.earnings,
            description=f"Earnings approved for task: {task.title}",
            reference_id=str(session.id),
        ))

        if task.status != _TaskStatusForApproval.COMPLETED:
            task.status = _TaskStatusForApproval.COMPLETED

        reason = f" Notes: {payload.notes}" if payload.notes else ""
        db.add(_MessageForApproval(
            sender_id=admin_user.id,
            recipient_id=session.worker_id,
            body=f"✅ Your task \"{task.title}\" has been approved! RM {session.earnings:.2f} has been credited to your wallet.{reason}",
        ))

        await db.flush()
        return {"status": "approved", "session_id": str(session.id), "amount_credited": session.earnings}

    elif action == "reject":
        task_result = await db.execute(select(Task).where(Task.id == session.task_id))
        task = task_result.scalar_one()
        reason = f" Reason: {payload.notes}" if payload.notes else ""
        db.add(_MessageForApproval(
            sender_id=admin_user.id,
            recipient_id=session.worker_id,
            body=f"❌ Your task \"{task.title}\" was not approved. Please contact support for more details.{reason}",
        ))
        await db.flush()
        return {"status": "rejected", "session_id": str(session.id)}

    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="action must be 'approve' or 'reject'")