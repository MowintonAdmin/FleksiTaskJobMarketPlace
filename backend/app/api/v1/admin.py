import json
import os
import subprocess
import tempfile
import urllib.parse
import uuid
import io
import csv
import math
from calendar import monthrange
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models.application import Application, ApplicationStatus
from app.models.import_log import ImportLog
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.models.task_session import TaskSession, SessionStatus
from app.models.enums import DataSource
from app.models.wallet import Wallet, WithdrawalRequest, WithdrawalStatus, Transaction, TransactionType
from app.schemas.application import ApplicationResponse, ApplicationWithDetails
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate, ProjectListResponse
from app.schemas.user import UserResponse, UserPublic
from app.schemas.task import TaskResponse, TaskListResponse
from app.schemas.data_import import ImportPreviewResponse, ImportConfirmResponse
from app.core.deps import get_current_user
from app.core.security import hash_password
from app.config import get_settings
from app.services.data_import import ImportService

settings = get_settings()

router = APIRouter(prefix="/admin", tags=["Admin"])


def build_user_public(user: User) -> UserPublic:
    skills = user.skills
    if skills is None:
        skills = []
    elif isinstance(skills, str):
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


async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return current_user


async def get_accessible_task_ids(db: AsyncSession, current_user: User) -> list[uuid.UUID] | None:
    """Return task IDs this admin can see. None = super admin (no filter).
    Includes the placeholder task used by imported historical sessions so that
    normal admins can see historical data alongside their own project data.
    """
    if current_user.is_super_admin:
        return None
    from app.services.data_import import PLACEHOLDER_TASK_ID
    result = await db.execute(
        select(Task.id).join(Project, Task.project_id == Project.id)
        .where(Project.created_by_id == current_user.id)
    )
    task_ids = [r[0] for r in result.all()]
    # Always include the placeholder task so imported sessions are visible to all admins
    if PLACEHOLDER_TASK_ID not in task_ids:
        task_ids.append(PLACEHOLDER_TASK_ID)
    return task_ids


async def get_accessible_worker_ids(db: AsyncSession, current_user: User, task_ids: list[uuid.UUID] | None) -> list[uuid.UUID] | None:
    """Return worker IDs that have participated in this admin's tasks. None = super admin (no filter)."""
    if current_user.is_super_admin:
        return None
    if not task_ids:
        return []
    result = await db.execute(
        select(Application.worker_id)
        .where(Application.task_id.in_(task_ids), Application.status == "approved")
    )
    app_workers = [r[0] for r in result.all()]
    result2 = await db.execute(
        select(TaskSession.worker_id)
        .where(TaskSession.task_id.in_(task_ids))
    )
    session_workers = [r[0] for r in result2.all()]
    return list(set(app_workers + session_workers))


async def get_accessible_user_ids(db: AsyncSession, current_user: User) -> list[uuid.UUID] | None:
    """Return user IDs this admin can see. None = super admin (no filter)."""
    if current_user.is_super_admin:
        return None
    accessible = await get_accessible_task_ids(db, current_user)
    return await get_accessible_worker_ids(db, current_user, accessible)


# ── Historical Data Import ─────────────────────────────────────────────────

@router.post("/import/preview", response_model=ImportPreviewResponse)
async def import_preview(
    file: UploadFile = File(...),
    worksheet_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Preview an Excel import without making any database changes.
    Returns a detailed summary of rows, workers, duplicates, and validation issues.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .xlsx or .xls files are accepted")

    content = await file.read()
    if len(content) < 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File appears to be empty or invalid")
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    try:
        service = ImportService(db)
        preview = await service.preview(
            file_content=content,
            filename=file.filename,
            worksheet_name=worksheet_name,
        )
        return preview
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Failed to parse workbook: {e}")


@router.post("/import/confirm", response_model=ImportConfirmResponse)
async def import_confirm(
    file: UploadFile = File(...),
    worksheet_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Execute a historical data import after preview and confirmation.
    All database changes happen in a single transaction.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .xlsx or .xls files are accepted")

    content = await file.read()
    if len(content) < 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File appears to be empty or invalid")
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    try:
        service = ImportService(db)
        result = await service.confirm(
            file_content=content,
            filename=file.filename,
            admin_user=current_user,
            worksheet_name=worksheet_name,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {e}",
        )


@router.get("/import/logs")
async def import_list_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all historical data import logs."""
    q = select(ImportLog).order_by(ImportLog.started_at.desc())
    if not current_user.is_super_admin:
        q = q.where(ImportLog.imported_by_id == current_user.id)
    result = await db.execute(q)
    logs = result.scalars().all()
    out = []
    for log in logs:
        out.append({
            "id": str(log.id),
            "filename": log.filename,
            "worksheet_name": log.worksheet_name,
            "import_version": log.import_version,
            "imported_by": str(log.imported_by_id),
            "status": log.status,
            "total_rows": log.total_rows,
            "valid_rows": log.valid_rows,
            "duplicate_rows": log.duplicate_rows,
            "workers_created": log.workers_created,
            "workers_matched": log.workers_matched,
            "sessions_imported": log.sessions_imported,
            "started_at": log.started_at.isoformat() if log.started_at else None,
            "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            "failed_rows_details": log.failed_rows_details,
            "error_log": log.error_log,
        })
    return out


# ── Create Admin Account (Super Admin Only) ─────────────────────────────────────


class CreateAdminRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    company_tag: str | None = None


@router.post("/users/create-admin", status_code=status.HTTP_201_CREATED)
async def admin_create_admin(
    payload: CreateAdminRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Create a new normal admin account. Super admin only."""
    result = await db.execute(select(User).where(User.email == payload.email.strip().lower()))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email already exists")

    if len(payload.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")

    user = User(
        email=payload.email.strip().lower(),
        full_name=payload.full_name.strip() if payload.full_name else "Admin User",
        hashed_password=hash_password(payload.password),
        is_admin=True,
        is_super_admin=False,
        is_verified=True,
        is_active=True,
        company_tag=payload.company_tag.strip() if payload.company_tag else None,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return {"message": f"Admin account created for {user.email}", "user_id": str(user.id), "email": user.email, "full_name": user.full_name}


# ── Applications ──────────────────────────────────────────────────────────────

@router.get("/applications", response_model=list[ApplicationWithDetails])
async def admin_list_applications(
    task_id: uuid.UUID | None = Query(None),
    app_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all applications, optionally filtered by task or status."""
    filters = []
    if task_id:
        filters.append(Application.task_id == task_id)
    if app_status:
        filters.append(Application.status == app_status)
    accessible = await get_accessible_task_ids(db, current_user)
    if accessible is not None:
        filters.append(Application.task_id.in_(accessible))

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


@router.get("/users/unverified")
async def admin_unverified_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all unverified users."""
    result = await db.execute(
        select(User)
        .where(User.is_verified == False, User.is_admin == False, User.verification_status == "submitted")
        .order_by(User.verification_submitted_at.desc().nulls_last(), User.created_at.desc())
    )
    users = result.scalars().all()
    out = []
    for u in users:
        sessions_result = await db.execute(select(TaskSession).where(TaskSession.worker_id == u.id))
        sessions = sessions_result.scalars().all()
        completed = [s for s in sessions if s.status == SessionStatus.COMPLETED]
        out.append({
            "id": str(u.id), "email": u.email, "full_name": u.full_name,
            "profile_photo_url": u.profile_photo_url, "phone": u.phone, "location": u.location,
            "nationality": u.nationality, "race": u.race, "nric_passport": u.nric_passport,
            "academic_qualification": u.academic_qualification, "body_height_cm": u.body_height_cm,
            "bank_qr_code_url": u.bank_qr_code_url, "selfie_with_id_url": u.selfie_with_id_url,
            "total_sessions": len(sessions), "completed_sessions": len(completed),
            "created_at": u.created_at.isoformat(),
        })
    return out


@router.get("/users/admins", response_model=list[UserResponse])
async def admin_list_admins(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List admin users."""
    if current_user.is_super_admin:
        q = select(User).where(User.is_admin == True).order_by(User.created_at.desc())
    else:
        q = select(User).where(User.is_admin == True, User.company_tag == current_user.company_tag).order_by(User.created_at.desc())
    result = await db.execute(q)
    admins = result.scalars().all()
    if search:
        s = search.lower()
        admins = [u for u in admins if s in u.full_name.lower() or s in u.email.lower()]
    return [UserResponse.model_validate(u) for u in admins]


@router.get("/users", response_model=list[UserResponse])
async def admin_list_users(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all users."""
    accessible = await get_accessible_user_ids(db, current_user)
    if accessible is None:
        q = select(User).order_by(User.created_at.desc())
        result = await db.execute(q)
        users = result.scalars().all()
    else:
        if not accessible:
            return []
        q = select(User).where(User.id.in_(accessible)).order_by(User.created_at.desc())
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
    current_user: User = Depends(require_admin),
):
    """Get a user's profile with session performance stats."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not current_user.is_super_admin:
        accessible = await get_accessible_user_ids(db, current_user)
        if accessible is not None and user.id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view users from your own projects")

    sessions_result = await db.execute(select(TaskSession).where(TaskSession.worker_id == user_id))
    sessions = sessions_result.scalars().all()
    completed = [s for s in sessions if s.status == SessionStatus.COMPLETED]
    total_earnings = sum(s.earnings or 0 for s in completed)
    user_data = UserWithStats.model_validate(user)
    user_data.stats = WorkerStats(total_sessions=len(sessions), completed_sessions=len(completed), total_earnings=round(total_earnings, 2))
    return user_data


@router.get("/users/{user_id}/sessions")
async def admin_get_user_sessions(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get all task sessions for a worker (past performance)."""
    if not current_user.is_super_admin:
        accessible = await get_accessible_user_ids(db, current_user)
        if accessible is not None and user_id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view users from your own projects")

    sessions_result = await db.execute(select(TaskSession).where(TaskSession.worker_id == user_id).order_by(TaskSession.created_at.desc()))
    sessions = sessions_result.scalars().all()
    out = []
    for s in sessions:
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()
        elapsed = None
        if s.checked_in_at and s.checked_out_at:
            elapsed = round((s.checked_out_at - s.checked_in_at).total_seconds() / 60, 1)
        # Show real activity name for imported sessions
        display_title = task.title if task else "Unknown"
        try:
            src = str(s.source.value if s.source else "APP").upper()
        except:
            src = "APP"
        if src == "IMPORTED" and s.nature_of_work:
            display_title = str(s.nature_of_work)
        elif src == "IMPORTED" and s.proof_notes and "Work:" in str(s.proof_notes):
            display_title = str(s.proof_notes).split(" | ")[0].replace("Work: ", "").strip()
        out.append({"id": str(s.id), "task_title": display_title, "task_location": task.location if task else "",
            "checked_in_at": s.checked_in_at.isoformat() if s.checked_in_at else None,
            "checked_out_at": s.checked_out_at.isoformat() if s.checked_out_at else None,
            "elapsed_minutes": elapsed, "earnings": s.earnings, "status": s.status,
            "proof_notes": s.proof_notes, "proof_photo_url": s.proof_photo_url, "source": src})
    return out


class UserVerificationAction(BaseModel):
    action: str
    reason: str | None = None


@router.post("/users/{user_id}/verify")
async def admin_verify_user(
    user_id: uuid.UUID,
    payload: UserVerificationAction,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    from app.models.message import Message
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    action = payload.action.lower()
    if action == "approve":
        user.is_verified = True; user.is_active = True; user.verification_status = "approved"
        db.add(Message(sender_id=admin_user.id, recipient_id=user.id, body="✅ Your account has been verified! You can now apply for tasks and start earning."))
        await db.flush()
        return {"status": "approved", "user_id": str(user.id)}
    elif action == "reject":
        user.verification_status = "rejected"; user.rejection_reason = payload.reason or "No specific reason provided"; user.is_active = True
        db.add(Message(sender_id=admin_user.id, recipient_id=user.id, body=f"❌ Your verification was rejected. Reason: {payload.reason or 'No specific reason provided'}. Please update your information and resubmit."))
        await db.flush()
        return {"status": "rejected", "reason": user.rejection_reason, "user_id": str(user.id)}
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="action must be 'approve' or 'reject'")


# ── Active Workers ────────────────────────────────────────────────────────────

@router.get("/workers/active")
async def admin_active_workers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    accessible = await get_accessible_task_ids(db, current_user)
    filters = [
        TaskSession.status == SessionStatus.ACTIVE,
        Task.status != TaskStatus.CANCELLED,
    ]
    if accessible is not None:
        filters.append(TaskSession.task_id.in_(accessible))
    result = await db.execute(
        select(TaskSession)
        .join(Task, TaskSession.task_id == Task.id)
        .where(and_(*filters))
        .order_by(TaskSession.checked_in_at.asc())
    )
    sessions = result.scalars().all()
    out = []
    now = datetime.now(timezone.utc)
    for s in sessions:
        worker_result = await db.execute(select(User).where(User.id == s.worker_id))
        worker = worker_result.scalar_one_or_none()
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()
        elapsed = round((now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1)
        cap = float(task.estimated_duration_minutes) if task and task.estimated_duration_minutes > 0 else None
        capped_elapsed = round(min(elapsed, cap), 1) if cap else elapsed
        fixed_earnings = round((task.pay_rate_per_minute * task.estimated_duration_minutes) if task else 0, 2)
        out.append({"session_id": str(s.id), "worker_id": str(s.worker_id), "worker_name": worker.full_name if worker else "Unknown",
            "worker_email": worker.email if worker else "", "worker_photo": worker.profile_photo_url if worker else None,
            "task_id": str(s.task_id), "task_title": task.title if task else "Unknown", "task_location": task.location if task else "",
            "checked_in_at": s.checked_in_at.isoformat(), "elapsed_minutes": capped_elapsed, "current_earnings": fixed_earnings, "total_pay": fixed_earnings})
    return out


@router.post("/sessions/{session_id}/force-stop")
async def admin_force_stop_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.message import Message
    result = await db.execute(select(TaskSession).where(TaskSession.id == session_id, TaskSession.status.in_([SessionStatus.ACTIVE, SessionStatus.PAUSED, SessionStatus.COMPLETED])))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or already settled")

    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None and session.task_id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage sessions from your own projects")

    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()
    now = datetime.now(timezone.utc)
    elapsed_minutes = (now - session.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
    earnings = round(elapsed_minutes * task.pay_rate_per_minute, 2)
    session.checked_out_at = now; session.earnings = earnings; session.status = SessionStatus.COMPLETED
    session.proof_notes = f"[Admin force-stopped by {current_user.full_name or current_user.email}]"
    db.add(session)
    db.add(Message(sender_id=current_user.id, recipient_id=session.worker_id,
        body=f"⚠️ Your active session for \"{task.title}\" was stopped by an admin. The total amount will be credited upon approval from the session approval page."))
    await db.flush()
    return {"session_id": str(session.id), "elapsed_minutes": round(elapsed_minutes, 1), "pending_earnings": earnings, "status": session.status}


# ── Withdrawal Management ─────────────────────────────────────────────────────

class WithdrawalAction(BaseModel):
    action: str
    notes: str | None = None


@router.get("/withdrawals", response_model=list[dict])
async def admin_list_withdrawals(
    req_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List withdrawal requests."""
    from app.models.message import Message
    q = select(WithdrawalRequest).order_by(WithdrawalRequest.created_at.desc())
    accessible = await get_accessible_user_ids(db, current_user)
    if accessible is not None:
        if accessible:
            q = q.where(WithdrawalRequest.user_id.in_(accessible))
        else:
            return []
    if req_status:
        q = q.where(WithdrawalRequest.status == req_status)
    result = await db.execute(q)
    withdrawals = result.scalars().all()
    out = []
    for w in withdrawals:
        worker_result = await db.execute(select(User).where(User.id == w.user_id))
        worker = worker_result.scalar_one_or_none()
        out.append({"id": str(w.id), "user_id": str(w.user_id), "worker_name": worker.full_name if worker else "Unknown",
            "worker_email": worker.email if worker else "", "amount": w.amount, "status": w.status,
            "payment_type": w.payment_type,
            "bank_name": w.bank_name, "account_number": "*" * (len(w.account_number) - 4) + w.account_number[-4:] if w.account_number else "",
            "account_holder_name": w.account_holder_name, "phone_number": w.phone_number,
            "admin_notes": w.admin_notes,
            "processed_at": w.processed_at.isoformat() if w.processed_at else None, "created_at": w.created_at.isoformat(),
            "worker_bank_qr_url": worker.bank_qr_code_url if worker else None,
            "worker_profile_photo": worker.profile_photo_url if worker else None})
    return out


@router.patch("/withdrawals/{withdrawal_id}")
async def admin_process_withdrawal(
    withdrawal_id: uuid.UUID,
    payload: WithdrawalAction,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.message import Message
    result = await db.execute(select(WithdrawalRequest).where(WithdrawalRequest.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Withdrawal not found")
    if withdrawal.status != WithdrawalStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Withdrawal already processed")

    if not current_user.is_super_admin:
        accessible = await get_accessible_user_ids(db, current_user)
        if accessible is not None and withdrawal.user_id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only process withdrawals from your own workers")

    now = datetime.now(timezone.utc)
    action = payload.action.lower()
    if action == "approve":
        withdrawal.status = WithdrawalStatus.APPROVED; withdrawal.processed_at = now; withdrawal.admin_notes = payload.notes
        if withdrawal.payment_type == "tng_ewallet":
            txn_desc = f"Withdrawal approved to Touch 'n Go eWallet · {withdrawal.phone_number}"
            msg_body = f"✅ Your withdrawal of RM {withdrawal.amount:.2f} has been approved and transferred to your Touch 'n Go eWallet ({withdrawal.phone_number}). Please allow 1-3 business days."
        else:
            txn_desc = f"Withdrawal approved to {withdrawal.bank_name} ···{withdrawal.account_number[-4:]}"
            msg_body = f"✅ Your withdrawal of RM {withdrawal.amount:.2f} has been approved and transferred to {withdrawal.bank_name} ···{withdrawal.account_number[-4:]}. Please allow 1-3 business days."
        db.add(Transaction(user_id=withdrawal.user_id, type=TransactionType.WITHDRAWAL_COMPLETED, amount=-withdrawal.amount,
            description=txn_desc, reference_id=str(withdrawal.id)))
        db.add(Message(sender_id=current_user.id, recipient_id=withdrawal.user_id, body=msg_body))
    elif action == "reject":
        withdrawal.status = WithdrawalStatus.REJECTED; withdrawal.processed_at = now; withdrawal.admin_notes = payload.notes
        wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == withdrawal.user_id))
        wallet = wallet_result.scalar_one_or_none()
        if wallet:
            wallet.available_balance = round(wallet.available_balance + withdrawal.amount, 2)
        db.add(Transaction(user_id=withdrawal.user_id, type=TransactionType.WITHDRAWAL_REJECTED, amount=withdrawal.amount,
            description=f"Withdrawal rejected — RM {withdrawal.amount:.2f} refunded to wallet", reference_id=str(withdrawal.id)))
        reason = f" Reason: {payload.notes}" if payload.notes else ""
        db.add(Message(sender_id=current_user.id, recipient_id=withdrawal.user_id,
            body=f"❌ Your withdrawal of RM {withdrawal.amount:.2f} was rejected and has been refunded to your wallet.{reason}"))
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="action must be 'approve' or 'reject'")
    await db.flush()
    return {"status": withdrawal.status, "id": str(withdrawal.id)}


# ── Time Logs ─────────────────────────────────────────────────────────────

@router.get("/time-logs")
async def admin_time_logs(
    task_id: uuid.UUID | None = Query(None),
    worker_id: uuid.UUID | None = Query(None),
    log_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    filters = []
    if task_id:
        filters.append(TaskSession.task_id == task_id)
    if worker_id:
        filters.append(TaskSession.worker_id == worker_id)
    if log_status:
        filters.append(TaskSession.status == log_status)
    accessible = await get_accessible_task_ids(db, current_user)
    if accessible is not None:
        filters.append(TaskSession.task_id.in_(accessible))

    q = select(TaskSession).order_by(TaskSession.checked_in_at.desc())
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q)
    sessions = result.scalars().all()
    now = datetime.now(timezone.utc)

    out = []
    # build worker & task lookup maps for performance
    worker_ids = []
    task_ids = []
    for s in sessions:
        worker_ids.append(s.worker_id)
        task_ids.append(s.task_id)
    worker_ids = list(set(worker_ids))
    task_ids = list(set(task_ids))

    workers_map = {}
    tasks_map = {}
    if worker_ids and len(worker_ids) > 0:
        wr = await db.execute(select(User).where(User.id.in_(worker_ids)))
        for u in wr.scalars().all():
            workers_map[u.id] = u
    if task_ids and len(task_ids) > 0:
        tr = await db.execute(select(Task).where(Task.id.in_(task_ids)))
        for t in tr.scalars().all():
            tasks_map[t.id] = t

    for s in sessions:
        worker = workers_map.get(s.worker_id)
        task = tasks_map.get(s.task_id)
        total_cost = round((task.pay_rate_per_minute * task.estimated_duration_minutes) if task else 0, 2)
        if s.status == SessionStatus.ACTIVE:
            elapsed = round((now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1)
        else:
            if s.checked_in_at and s.checked_out_at:
                elapsed = round((s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1)
            else:
                elapsed = None
        cost = s.earnings if s.earnings else total_cost
        # For imported sessions, display the real activity from nature_of_work / proof_notes
        display_title = task.title if task else "Unknown"
        src_raw = None
        try:
            src_raw = s.source.value if s.source else "APP"
        except:
            src_raw = "APP"
        src = str(src_raw).upper()
        if src == "IMPORTED":
            if s.nature_of_work:
                display_title = str(s.nature_of_work)
            elif s.proof_notes and "Work:" in str(s.proof_notes):
                display_title = str(s.proof_notes).split(" | ")[0].replace("Work: ", "").strip()
        out.append({"session_id": str(s.id), "worker_id": str(s.worker_id), "worker_name": worker.full_name if worker else "Unknown",
            "worker_email": worker.email if worker else "", "task_id": str(s.task_id), "task_title": display_title,
            "task_location": task.location if task else "", "pay_rate_per_minute": task.pay_rate_per_minute if task else 0,
            "checked_in_at": s.checked_in_at.isoformat() if s.checked_in_at else None,
            "checked_out_at": s.checked_out_at.isoformat() if s.checked_out_at else None, "elapsed_minutes": elapsed, "cost": cost,
            "status": s.status, "rating": s.rating, "source": src,
            "nature_of_work": str(s.nature_of_work) if s.nature_of_work else None,
            "proof_notes": str(s.proof_notes) if s.proof_notes else None})
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
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TaskSession).where(TaskSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None and session.task_id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only adjust sessions from your own projects")

    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()
    old_earnings = session.earnings or 0.0

    from app.models.message import Message as _Msg

    # 1. Update check-in time (record-keeping only - does not affect payment)
    session.checked_in_at = payload.checked_in_at.replace(tzinfo=timezone.utc) if payload.checked_in_at.tzinfo is None else payload.checked_in_at

    if payload.checked_out_at:
        co = payload.checked_out_at.replace(tzinfo=timezone.utc) if payload.checked_out_at.tzinfo is None else payload.checked_out_at
        session.checked_out_at = co

        if (co - session.checked_in_at).total_seconds() < 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Check-out time must be after check-in time")

        # 2. Set earnings to the FIXED task total — NOT pro-rated by time.
        #    The check-in/check-out times are for record-keeping only.
        #    The worker always receives the full fixed task amount upon Session Approval.
        fixed_total = round(task.pay_rate_per_minute * task.estimated_duration_minutes, 2)
        session.earnings = fixed_total

        # 3. Mark as COMPLETED so it appears in Session Approval for admin to approve.
        #    IMPORTANT: Money is ONLY credited when admin clicks "Approve" on Session Approval page.
        #    This does NOT credit the wallet or create a transaction.
        #    The session will be moved to SETTLED only after approval/rejection on the Session Approval page.
        session.status = SessionStatus.COMPLETED

        # 4. Notify the worker about the adjustment — informs them the fixed amount will be credited upon approval
        reason_text = f" Reason: {payload.reason}" if payload.reason else ""
        db.add(_Msg(
            sender_id=current_user.id,
            recipient_id=session.worker_id,
            body=f"⏱ Your session for \"{task.title}\" has been time-adjusted.{reason_text} "
                 f"The fixed amount of RM {fixed_total:.2f} is pending approval and will be credited once approved.",
        ))

    await db.flush()
    return {"session_id": str(session.id), "checked_in_at": session.checked_in_at.isoformat(),
        "checked_out_at": session.checked_out_at.isoformat() if session.checked_out_at else None,
        "old_earnings": old_earnings, "new_earnings": session.earnings, "status": session.status}


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=ProjectListResponse)
async def admin_list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = select(Project).order_by(Project.created_at.desc())
    if not current_user.is_super_admin:
        q = q.where(Project.created_by_id == current_user.id)
    result = await db.execute(q)
    projects = result.scalars().all()
    out = []
    for p in projects:
        task_count = await db.execute(select(func.count()).select_from(Task).where(Task.project_id == p.id))
        pd = ProjectResponse.model_validate(p)
        pd.task_count = task_count.scalar_one()
        out.append(pd)
    return ProjectListResponse(projects=out, total=len(out))


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db), admin_user: User = Depends(require_admin)):
    data = payload.model_dump()
    if data.get("due_date"):
        from datetime import timezone as _tz
        data["due_date"] = data["due_date"].replace(tzinfo=_tz.utc) if data["due_date"].tzinfo is None else data["due_date"]
    project = Project(**data, created_by_id=admin_user.id, company_tag=admin_user.company_tag)
    db.add(project); await db.flush(); await db.refresh(project)
    pd = ProjectResponse.model_validate(project); pd.task_count = 0
    return pd


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def admin_update_project(project_id: uuid.UUID, payload: ProjectUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("due_date"):
        from datetime import timezone as _tz
        update_data["due_date"] = update_data["due_date"].replace(tzinfo=_tz.utc) if update_data["due_date"].tzinfo is None else update_data["due_date"]
    for field, value in update_data.items():
        setattr(project, field, value)

    # If a new future due_date is set and the project was previously completed, reactivate it
    from datetime import timezone as _tz2
    if (project.due_date and project.due_date > datetime.now(_tz2.utc)
            and project.status == ProjectStatus.COMPLETED
            and "status" not in update_data):
        project.status = ProjectStatus.ACTIVE

    db.add(project); await db.flush(); await db.refresh(project)
    task_count = await db.execute(select(func.count()).select_from(Task).where(Task.project_id == project.id))
    pd = ProjectResponse.model_validate(project); pd.task_count = task_count.scalar_one()
    return pd


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    task_count = await db.execute(select(func.count()).select_from(Task).where(Task.project_id == project.id))
    if task_count.scalar_one() > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete project with tasks. Remove tasks first.")
    await db.delete(project)


# ── Task Listing (Admin) ──────────────────────────────────────────────────────

@router.get("/tasks/export")
async def export_tasks_csv(current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    q = select(Task).order_by(Task.created_at.desc())
    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None:
            q = q.where(Task.id.in_(accessible))
    result = await db.execute(q)
    tasks = result.scalars().all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Title", "Description", "Location", "Category", "Pay Rate (RM/min)", "Est. Duration (min)", "Max Applicants", "Status", "Start Date", "Created At"])
    for t in tasks:
        writer.writerow([str(t.id), t.title, t.description, t.location, t.category, t.pay_rate_per_minute, t.estimated_duration_minutes, t.max_applicants, t.status, t.starts_at.isoformat() if t.starts_at else "", t.created_at.isoformat()])
    output.seek(0)
    filename = f"tasks_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/tasks")
async def admin_list_tasks(page: int = Query(1, ge=1), page_size: int = Query(15, ge=1, le=100),
    task_status: str | None = Query(None, alias="status"), search: str | None = Query(None),
    project_id: uuid.UUID | None = Query(None), db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    filters = []
    if task_status:
        filters.append(Task.status == task_status)
    if search:
        filters.append(Task.title.ilike(f"%{search}%"))
    if project_id:
        filters.append(Task.project_id == project_id)
    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None:
            filters.append(Task.id.in_(accessible))
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
        count_result = await db.execute(select(func.count()).select_from(Application).where(Application.task_id == task.id))
        task_data = TaskResponse.model_validate(task)
        task_data.application_count = count_result.scalar_one()
        task_responses.append(task_data)
    return TaskListResponse(tasks=task_responses, total=total, page=page, page_size=page_size, total_pages=math.ceil(total / page_size) if total else 1)


@router.get("/tasks/{task_id}/cost")
async def admin_task_cost(task_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None and task.id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view costs for your own tasks")
    sessions_result = await db.execute(select(TaskSession).where(TaskSession.task_id == task_id))
    sessions = sessions_result.scalars().all()
    now = datetime.now(timezone.utc)
    completed = [s for s in sessions if s.status == SessionStatus.COMPLETED]
    active = [s for s in sessions if s.status == SessionStatus.ACTIVE]
    paid_cost = sum(s.earnings or 0 for s in completed)
    live_cost = sum(round((now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60 * task.pay_rate_per_minute, 2) for s in active)
    estimated_total = task.pay_rate_per_minute * task.estimated_duration_minutes
    return {"task_id": str(task_id), "task_title": task.title, "pay_rate_per_minute": task.pay_rate_per_minute,
        "estimated_duration_minutes": task.estimated_duration_minutes, "estimated_total_cost": round(estimated_total, 2),
        "paid_cost": round(paid_cost, 2), "live_accruing_cost": round(live_cost, 2),
        "total_projected_cost": round(paid_cost + live_cost, 2), "completed_sessions": len(completed), "active_sessions": len(active)}


@router.get("/tasks/costs")
async def admin_all_task_costs(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    q = select(Task).order_by(Task.created_at.desc())
    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None:
            q = q.where(Task.id.in_(accessible))
    tasks_result = await db.execute(q)
    tasks = tasks_result.scalars().all()
    sessions_result = await db.execute(select(TaskSession))
    all_sessions = sessions_result.scalars().all()
    now = datetime.now(timezone.utc)
    out = []
    # Reference placeholder task ID for historical import grouping
    _PH_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
    for t in tasks:
        t_sessions = [s for s in all_sessions if s.task_id == t.id]
        # For the placeholder historical task, group by nature_of_work instead
        if t.id == _PH_ID:
            work_groups = {}
            for s in t_sessions:
                g = (str(s.nature_of_work) if s.nature_of_work else "Other").strip()
                if g not in work_groups:
                    work_groups[g] = {"sessions": 0, "paid": 0.0, "live": 0.0}
                work_groups[g]["sessions"] += 1
                work_groups[g]["paid"] += s.earnings or 0
            for work_name, wg in sorted(work_groups.items()):
                out.append({"task_id": str(t.id), "task_title": work_name, "status": "completed",
                    "pay_rate_per_minute": 0, "estimated_cost": 0, "paid_cost": round(wg["paid"], 2),
                    "live_cost": 0, "total_cost": round(wg["paid"], 2), "session_count": wg["sessions"]})
        else:
            paid = sum(s.earnings or 0 for s in t_sessions if s.status == SessionStatus.COMPLETED)
            live = sum((now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60 * t.pay_rate_per_minute for s in t_sessions if s.status == SessionStatus.ACTIVE)
            estimated = t.pay_rate_per_minute * t.estimated_duration_minutes
            out.append({"task_id": str(t.id), "task_title": t.title, "status": t.status, "pay_rate_per_minute": t.pay_rate_per_minute,
                "estimated_cost": round(estimated, 2), "paid_cost": round(paid, 2), "live_cost": round(live, 2), "total_cost": round(paid + live, 2), "session_count": len(t_sessions)})
    return out


# ── Reporting & Analytics ─────────────────────────────────────────────────────

@router.get("/analytics/dashboard")
async def analytics_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    from app.models.wallet import WithdrawalRequest as _WD, WithdrawalStatus as _WDS

    accessible = await get_accessible_user_ids(db, current_user)
    accessible_tasks = await get_accessible_task_ids(db, current_user)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if current_user.is_super_admin:
        total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        total_tasks = (await db.execute(select(func.count()).select_from(Task))).scalar_one()
        total_apps = (await db.execute(select(func.count()).select_from(Application))).scalar_one()
        active_workers = (await db.execute(
            select(func.count()).select_from(TaskSession)
            .join(Task, TaskSession.task_id == Task.id)
            .where(TaskSession.status == SessionStatus.ACTIVE, Task.status != TaskStatus.CANCELLED)
        )).scalar_one()
        tasks_result = await db.execute(select(Task))
        all_tasks = tasks_result.scalars().all()
        all_apps_raw = await db.execute(select(Application))
        all_apps = all_apps_raw.scalars().all()
        sessions_result = await db.execute(select(TaskSession))
        all_sessions = sessions_result.scalars().all()
        pend_wd = (await db.execute(select(func.count()).select_from(_WD).where(_WD.status == "PENDING"))).scalar_one()
    else:
        total_users = 0
        if accessible_tasks is not None:
            total_tasks = (await db.execute(select(func.count()).select_from(Task).where(Task.id.in_(accessible_tasks)))).scalar_one() if accessible_tasks else 0
            all_tasks_raw = await db.execute(select(Task).where(Task.id.in_(accessible_tasks)))
        else:
            total_tasks = 0
            all_tasks_raw = await db.execute(select(Task))
        all_tasks = all_tasks_raw.scalars().all()

        if accessible_tasks is not None:
            total_apps = (await db.execute(select(func.count()).select_from(Application).where(Application.task_id.in_(accessible_tasks)))).scalar_one() if accessible_tasks else 0
        else:
            total_apps = 0

        if accessible_tasks is not None:
            active_workers = (await db.execute(
                select(func.count()).select_from(TaskSession)
                .join(Task, TaskSession.task_id == Task.id)
                .where(TaskSession.status == SessionStatus.ACTIVE, Task.status != TaskStatus.CANCELLED, TaskSession.task_id.in_(accessible_tasks))
            )).scalar_one() if accessible_tasks else 0
        else:
            active_workers = 0

        if accessible_tasks is not None:
            all_apps_raw = await db.execute(select(Application).where(Application.task_id.in_(accessible_tasks))) if accessible_tasks else select(Application).where(Application.task_id == -1)
            all_apps = all_apps_raw.scalars().all() if accessible_tasks else []
        else:
            all_apps_raw = await db.execute(select(Application))
            all_apps = all_apps_raw.scalars().all()

        sessions_q = select(TaskSession)
        if accessible_tasks is not None:
            sessions_q = sessions_q.where(TaskSession.task_id.in_(accessible_tasks))
        sessions_result = await db.execute(sessions_q)
        all_sessions = sessions_result.scalars().all()

        if accessible is not None and accessible:
            pend_wd = (await db.execute(select(func.count()).select_from(_WD).where(_WD.status == "PENDING", _WD.user_id.in_(accessible)))).scalar_one()
        elif accessible is not None:
            pend_wd = 0
        else:
            pend_wd = (await db.execute(select(func.count()).select_from(_WD).where(_WD.status == "PENDING"))).scalar_one()

    open_tasks = sum(1 for t in all_tasks if t.status == "open")
    completed_tasks = sum(1 for t in all_tasks if t.status == "completed")
    cancelled_tasks = sum(1 for t in all_tasks if t.status == "cancelled")
    settled_sessions = [s for s in all_sessions if s.status in (SessionStatus.COMPLETED, SessionStatus.SETTLED)]
    total_revenue = sum(s.earnings or 0 for s in settled_sessions)
    live_cost = sum((now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60 * next((t.pay_rate_per_minute for t in all_tasks if t.id == s.task_id), 0) for s in all_sessions if s.status == SessionStatus.ACTIVE)
    today_sessions = [s for s in settled_sessions if s.checked_out_at and s.checked_out_at.replace(tzinfo=timezone.utc) >= today_start]
    today_revenue = sum(s.earnings or 0 for s in today_sessions)
    completion_rate = round(completed_tasks / total_tasks * 100, 1) if total_tasks else 0
    rated = [s for s in settled_sessions if s.rating is not None]
    avg_rating = round(sum(s.rating for s in rated) / len(rated), 2) if rated else None

    return {"users": {"total": total_users}, "tasks": {"total": total_tasks, "open": open_tasks, "completed": completed_tasks, "cancelled": cancelled_tasks, "completion_rate": completion_rate},
        "applications": {"total": total_apps, "pending": sum(1 for a in all_apps if a.status == "pending"), "approved": sum(1 for a in all_apps if a.status == "approved")},
        "sessions": {"total": len(all_sessions), "completed": len(settled_sessions), "active_now": active_workers},
        "revenue": {"total_paid": round(total_revenue, 2), "live_accruing": round(live_cost, 2), "today": round(today_revenue, 2)},
        "withdrawals": {"pending": pend_wd}, "rating": {"average": avg_rating, "count": len(rated)}}


@router.get("/analytics/monthly")
async def analytics_monthly(year: int | None = Query(None), db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    target_year = year or now.year

    sessions_q = select(TaskSession).where(TaskSession.status.in_([SessionStatus.COMPLETED, SessionStatus.SETTLED]))
    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None:
            sessions_q = sessions_q.where(TaskSession.task_id.in_(accessible))
    sessions_result = await db.execute(sessions_q)
    sessions = sessions_result.scalars().all()

    monthly = []
    for month in range(1, 13):
        last_day = monthrange(target_year, month)[1]
        m_start = datetime(target_year, month, 1, tzinfo=timezone.utc)
        m_end = datetime(target_year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
        m_sessions = [s for s in sessions if s.checked_out_at and m_start <= s.checked_out_at.replace(tzinfo=timezone.utc) <= m_end]
        spending = sum(s.earnings or 0 for s in m_sessions)
        hours = sum((s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600 for s in m_sessions if s.checked_in_at and s.checked_out_at)
        monthly.append({"month": month, "month_name": m_start.strftime("%b"), "year": target_year, "sessions": len(m_sessions), "spending": round(spending, 2), "hours": round(hours, 1)})
    return {"year": target_year, "months": monthly}


@router.get("/analytics/task-completion")
async def analytics_task_completion(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    q = select(Task)
    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None:
            q = q.where(Task.id.in_(accessible))
    tasks_result = await db.execute(q)
    all_tasks = tasks_result.scalars().all()
    categories = {}
    for t in all_tasks:
        cat = t.category or "Other"
        if cat not in categories:
            categories[cat] = {"total": 0, "completed": 0, "cancelled": 0, "open": 0}
        categories[cat]["total"] += 1
        if t.status == "completed": categories[cat]["completed"] += 1
        elif t.status == "cancelled": categories[cat]["cancelled"] += 1
        else: categories[cat]["open"] += 1
    result = []
    for cat, counts in sorted(categories.items()):
        rate = round(counts["completed"] / counts["total"] * 100, 1) if counts["total"] else 0
        result.append({"category": cat, "total": counts["total"], "completed": counts["completed"], "cancelled": counts["cancelled"], "open": counts["open"], "completion_rate": rate})
    total = len(all_tasks); completed = sum(1 for t in all_tasks if t.status == "completed")
    return {"overall_rate": round(completed / total * 100, 1) if total else 0, "by_category": result}


@router.get("/analytics/export/workers")
async def export_workers_csv(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    from app.models.wallet import WithdrawalRequest as _WD

    users_q = select(User).where(User.is_admin == False).order_by(User.created_at.desc())
    if not current_user.is_super_admin:
        accessible = await get_accessible_user_ids(db, current_user)
        if accessible is not None:
            if not accessible:
                return StreamingResponse(iter([""]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=no_data.csv"})
            users_q = users_q.where(User.id.in_(accessible))
    users_result = await db.execute(users_q)
    users = users_result.scalars().all()

    # Include both COMPLETED (app) and SETTLED (imported) sessions in worker exports
    sessions_q = select(TaskSession).where(TaskSession.status.in_([SessionStatus.COMPLETED, SessionStatus.SETTLED]))
    if not current_user.is_super_admin:
        accessible_tasks = await get_accessible_task_ids(db, current_user)
        if accessible_tasks is not None:
            sessions_q = sessions_q.where(TaskSession.task_id.in_(accessible_tasks))
    sessions_result = await db.execute(sessions_q)
    all_sessions = sessions_result.scalars().all()

    output = io.StringIO(); writer = csv.writer(output)
    writer.writerow(["Full Name", "Email", "Location", "Joined", "Total Sessions", "Total Hours", "Total Earnings (RM)", "Average Rating", "Is Verified", "Source"])
    for u in users:
        u_sessions = [s for s in all_sessions if s.worker_id == u.id]
        hours = sum(
            (s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
            for s in u_sessions if s.checked_in_at and s.checked_out_at
        ) if u_sessions else 0
        earnings = sum(s.earnings or 0 for s in u_sessions)
        rated = [s for s in u_sessions if s.rating is not None]
        avg_r = round(sum(s.rating for s in rated) / len(rated), 2) if rated else ""
        source_str = str(u.source) if u.source else "APP"
        writer.writerow([u.full_name or "", u.email or "", u.location or "", u.created_at.strftime("%Y-%m-%d") if u.created_at else "",
            len(u_sessions), round(hours, 1), round(earnings, 2), avg_r, "Yes" if u.is_verified else "No", source_str])
    output.seek(0)
    filename = f"workers_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/export/sessions-detailed")
async def export_sessions_detailed_csv(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    """Export every session row-by-row with all Time & Payment details.
    Each row is one session, showing worker info, task info, check-in/out,
    duration, earnings, nature of work, environment, status, rating.
    """
    users_q = select(User).where(User.is_admin == False).order_by(User.full_name.asc())
    if not current_user.is_super_admin:
        accessible = await get_accessible_user_ids(db, current_user)
        if accessible is not None:
            if not accessible:
                return StreamingResponse(iter([""]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=no_data.csv"})
            users_q = users_q.where(User.id.in_(accessible))
    users_result = await db.execute(users_q)
    users = users_result.scalars().all()

    sessions_q = select(TaskSession).order_by(TaskSession.checked_in_at.desc())
    if not current_user.is_super_admin:
        accessible_tasks = await get_accessible_task_ids(db, current_user)
        if accessible_tasks is not None:
            sessions_q = sessions_q.where(TaskSession.task_id.in_(accessible_tasks))
    sessions_result = await db.execute(sessions_q)
    all_sessions = sessions_result.scalars().all()

    output = io.StringIO(); writer = csv.writer(output)
    writer.writerow(["Worker Name","Worker Email","Worker Phone","NRIC/Passport","Participant ID","Body Height (cm)",
        "Task Title","Task Location","Category","Check-In","Check-Out","Duration (min)","Hours Worked",
        "Earnings (RM)","Nature of Work","Work Environment","Activity/Task","Source","Status","Rating","Feedback"])
    for u in users:
        u_sessions = [s for s in all_sessions if s.worker_id == u.id]
        if not u_sessions:
            continue  # skip workers with no sessions
        for s in u_sessions:
            task_result = await db.execute(select(Task).where(Task.id == s.task_id))
            task = task_result.scalar_one_or_none()
            elapsed = None
            if s.checked_in_at and s.checked_out_at:
                elapsed = round((s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1)
            hours = round(elapsed / 60, 2) if elapsed else 0
            import re
            activity_text = ""
            if s.proof_notes:
                parts = s.proof_notes.split(" | ")
                for part in parts:
                    if part.startswith("Activity:"):
                        activity_text = part.replace("Activity:", "").strip()
            src = str(s.source).upper() if s.source else "APP"
            writer.writerow([u.full_name or "", u.email or "", u.phone or "", u.nric_passport or "",
                u.legacy_participant_id or "", u.body_height_cm or "",
                task.title if task else "Unknown", task.location if task else "", task.category if task else "",
                s.checked_in_at.strftime("%Y-%m-%d %H:%M") if s.checked_in_at else "",
                s.checked_out_at.strftime("%Y-%m-%d %H:%M") if s.checked_out_at else "",
                elapsed or "", hours,
                s.earnings or "",
                s.nature_of_work or "", s.work_environment or "", activity_text or "",
                src, str(s.status) if s.status else "", s.rating or "", s.feedback or ""])
    output.seek(0)
    filename = f"flekxitask_sessions_detailed_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/export/workers-detailed")
async def export_workers_detailed_csv(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    """Export all worker data in the same format as the Feb-June Tracker Excel sheet.
    Includes: Participant ID, NRIC, Date, Project Session, Body Height, Nature of Work,
    Activity/Task, Environment, Duration, Hours Worked, Total Payout, Phone, Full Name.
    Newly registered workers and new sessions are automatically included.
    """
    from app.models.wallet import WithdrawalRequest, Wallet, Transaction as Txn

    users_q = select(User).where(User.is_admin == False).order_by(User.created_at.desc())
    if not current_user.is_super_admin:
        accessible = await get_accessible_user_ids(db, current_user)
        if accessible is not None:
            if not accessible:
                return StreamingResponse(iter([""]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=no_data.csv"})
            users_q = users_q.where(User.id.in_(accessible))
    users_result = await db.execute(users_q)
    users = users_result.scalars().all()

    sessions_q = select(TaskSession).order_by(TaskSession.created_at.desc())
    if not current_user.is_super_admin:
        accessible_tasks = await get_accessible_task_ids(db, current_user)
        if accessible_tasks is not None:
            sessions_q = sessions_q.where(TaskSession.task_id.in_(accessible_tasks))
    sessions_result = await db.execute(sessions_q)
    all_sessions = sessions_result.scalars().all()

    withdrawals_result = await db.execute(select(WithdrawalRequest))
    all_withdrawals = withdrawals_result.scalars().all()

    output = io.StringIO(); writer = csv.writer(output)

    # ── Header row matching the Feb-June Tracker Excel format ──
    writer.writerow([
        "Participant ID",           # legacy_participant_id
        "NRIC/Passport",            # nric_passport
        "Date",                     # check_in date
        "No.",                      # sequential row number (auto-generated)
        "Project ID",               # from task / proof_notes
        "Project Session",          # from task / proof_notes
        "Body Height (cm)",         # user.body_height_cm
        "Nature of Work",           # s.nature_of_work
        "Activity/Task",            # s.proof_notes or natures
        "Environment",              # s.work_environment
        "Device ID",                # from proof_notes or session
        "",                         # (spacer column)
        "QC Duration (minutes)",    # computed or blank
        "Expected Duration (minutes)",  # task pay / rate
        "Total Duration (minutes)", # elapsed
        "Expected Total (minutes)", # task estimate
        "Variance (minutes)",       # total - expected
        "",                         # (spacer)
        "Name",                     # abbreviated name
        "Full Name",                # user.full_name
        "Hours Worked",             # elapsed_hours
        "Total Payout (RM)",        # s.earnings
        "Phone Number",             # user.phone
    ])

    row_num = 1
    for u in users:
        u_sessions = [s for s in all_sessions if s.worker_id == u.id]
        u_withdrawals = [w for w in all_withdrawals if w.user_id == u.id]

        if not u_sessions:
            writer.writerow([
                u.legacy_participant_id or "",   # Participant ID
                u.nric_passport or "",            # NRIC/Passport
                u.created_at.strftime("%Y-%m-%d") if u.created_at else "",  # Date (joined)
                row_num,
                "", "",                           # Project ID, Session
                u.body_height_cm or "",           # Body Height
                "", "", "",                       # Nature, Activity, Environment
                "",                               # Device ID
                "",                               # spacer
                "", "", "", "", "",               # QC, Expected, Total, Expected Total, Variance
                "",                               # spacer
                u.full_name.split()[0] if u.full_name else "",  # Short Name
                u.full_name or "",                # Full Name
                "",                               # Hours
                "",                               # Payout
                u.phone or "",                    # Phone
            ])
            row_num += 1
        else:
            for s in u_sessions:
                task_result = await db.execute(select(Task).where(Task.id == s.task_id))
                task = task_result.scalar_one_or_none()
                elapsed = None
                if s.checked_in_at and s.checked_out_at:
                    elapsed = round((s.checked_out_at.replace(tzinfo=timezone.utc) - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60, 1)
                elapsed_hours = round(elapsed / 60, 2) if elapsed else 0

                task_expected = round(task.estimated_duration_minutes) if task and task.estimated_duration_minutes else 0
                variance = round(elapsed - task_expected, 1) if elapsed and task_expected else 0

                # Extract project info from proof_notes
                # Format: Work: {nature} | Activity: {activity} | Ref: {ref}
                activity_text = ""
                project_ref = ""
                if s.proof_notes:
                    parts = s.proof_notes.split(" | ")
                    for part in parts:
                        if part.startswith("Activity:"):
                            activity_text = part.replace("Activity:", "").strip()
                        elif part.startswith("Ref:"):
                            project_ref = part.replace("Ref:", "").strip()
                        elif part.startswith("Work:"):
                            pass  # nature_of_work already has this
                # Use nature_of_work and work_environment directly from the DB

                writer.writerow([
                    u.legacy_participant_id or "",
                    u.nric_passport or "",
                    s.checked_in_at.strftime("%Y-%m-%d") if s.checked_in_at else "",
                    row_num,
                    project_ref or "",            # Project ID / Ref
                    activity_text or "",           # Project Session / Activity
                    u.body_height_cm or "",
                    s.nature_of_work or "",
                    activity_text or "",           # Activity/Task
                    s.work_environment or "",
                    "",                            # Device ID
                    "",
                    "",                            # QC Duration
                    round(task.estimated_duration_minutes) if task and task.estimated_duration_minutes else "",  # Expected Duration
                    round(elapsed, 1) if elapsed else "",
                    task_expected if task_expected else "",
                    variance if variance else "",
                    "",
                    u.full_name.split()[0] if u.full_name else "",
                    u.full_name or "",
                    elapsed_hours if elapsed_hours else "",
                    round(s.earnings, 2) if s.earnings else "",
                    u.phone or "",
                ])
                row_num += 1

    output.seek(0)
    filename = f"flekxitask_workers_detailed_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"})


# ── Database Backup & Restore ─────────────────────────────────────────────────

def _parse_db_url(database_url: str) -> dict:
    normalized = database_url.split("+")[0] + "://" + database_url.split("://", 1)[1]
    parsed = urllib.parse.urlparse(normalized)
    return {"host": parsed.hostname or "localhost", "port": str(parsed.port or 5432), "user": parsed.username or "postgres",
        "password": parsed.password or "", "dbname": (parsed.path or "/postgres").lstrip("/")}


@router.get("/database/backup")
async def database_backup(_: User = Depends(require_super_admin)):
    """Backup entire database. Super admin only."""
    from app.config import get_settings as _get_settings
    settings = _get_settings(); db_parts = _parse_db_url(settings.DATABASE_URL)
    env = {**os.environ, "PGPASSWORD": db_parts["password"]}
    args = ["pg_dump", "-h", db_parts["host"], "-p", db_parts["port"], "-U", db_parts["user"], "--clean", "--if-exists", "--no-owner", "--no-privileges", db_parts["dbname"]]
    try:
        proc = subprocess.run(args, capture_output=True, env=env, timeout=300)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="pg_dump not found")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="pg_dump timed out")
    if proc.returncode != 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"pg_dump failed: {proc.stderr.decode(errors='replace')[:500]}")
    filename = f"fleksitask_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.sql"
    return StreamingResponse(iter([proc.stdout]), media_type="application/octet-stream", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.post("/database/restore")
async def database_restore(file: UploadFile = File(...), _: User = Depends(require_super_admin)):
    """Restore database from backup. Super admin only."""
    if not (file.filename or "").lower().endswith(".sql"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .sql files are accepted")
    content = await file.read()
    if len(content) < 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File appears to be empty")
    preview = content[:200].decode(errors="replace").lstrip()
    if not (preview.startswith("--") or preview.startswith("SET") or preview.startswith("/*")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File does not appear to be a valid pg_dump SQL file")
    from app.config import get_settings as _get_settings
    settings = _get_settings(); db_parts = _parse_db_url(settings.DATABASE_URL)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".sql")
    try:
        os.write(tmp_fd, content); os.close(tmp_fd)
        env = {**os.environ, "PGPASSWORD": db_parts["password"]}
        args = ["psql", "-h", db_parts["host"], "-p", db_parts["port"], "-U", db_parts["user"], "-d", db_parts["dbname"], "--single-transaction", "-f", tmp_path]
        try:
            proc = subprocess.run(args, capture_output=True, env=env, timeout=600)
        except FileNotFoundError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="psql not found")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="psql restore timed out")
        if proc.returncode != 0:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Restore failed: {proc.stderr.decode(errors='replace')[:500]}")
        return {"message": "Database restored successfully", "filename": file.filename, "size_bytes": len(content)}
    finally:
        if os.path.exists(tmp_path): os.unlink(tmp_path)


# ── Session Approval ──────────────────────────────────────────────────────

@router.get("/sessions/pending-approval")
async def admin_pending_sessions(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    accessible = await get_accessible_task_ids(db, current_user)
    filters = [TaskSession.status == SessionStatus.COMPLETED]
    if accessible is not None:
        filters.append(TaskSession.task_id.in_(accessible))
    result = await db.execute(select(TaskSession).where(and_(*filters)).order_by(TaskSession.checked_out_at.desc()))
    sessions = result.scalars().all()
    from app.models.wallet import BankAccount as _BankAccountForApproval
    out = []
    for s in sessions:
        worker_result = await db.execute(select(User).where(User.id == s.worker_id))
        worker = worker_result.scalar_one_or_none()
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()
        fixed_earnings = round((task.pay_rate_per_minute * task.estimated_duration_minutes) if task else 0, 2)
        if fixed_earnings <= 0: continue
        bank_result = await db.execute(select(_BankAccountForApproval).where(_BankAccountForApproval.user_id == s.worker_id))
        bank = bank_result.scalar_one_or_none()
        out.append({"session_id": str(s.id), "worker_id": str(s.worker_id), "worker_name": worker.full_name if worker else "Unknown",
            "worker_email": worker.email if worker else "", "task_id": str(s.task_id), "task_title": task.title if task else "Unknown",
            "task_location": task.location if task else "", "checked_in_at": s.checked_in_at.isoformat() if s.checked_in_at else None,
            "checked_out_at": s.checked_out_at.isoformat() if s.checked_out_at else None, "earnings": fixed_earnings, "proof_notes": s.proof_notes,
            "proof_photo_url": s.proof_photo_url, "status": s.status,
            "worker_bank_qr_url": worker.bank_qr_code_url if worker else None,
            "worker_id_photo_front_url": worker.id_photo_front_url if worker else None,
            "worker_selfie_url": worker.selfie_with_id_url if worker else None,
            "worker_payment_type": bank.payment_type if bank else None,
            "worker_bank_name": bank.bank_name if bank else None,
            "worker_account_number": bank.account_number if bank else None,
            "worker_account_holder": bank.account_holder_name if bank else None,
            "worker_phone_number": bank.phone_number if bank else None})
    return out


class SessionApprovalAction(BaseModel):
    action: str
    notes: str | None = None
    rating: float | None = None
    feedback: str | None = None


@router.post("/sessions/{session_id}/reject")
async def admin_reject_session(session_id: uuid.UUID, payload: SessionApprovalAction, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Reject a completed session without crediting the wallet."""
    from app.models.message import Message as _Msg
    result = await db.execute(select(TaskSession).where(TaskSession.id == session_id, TaskSession.status == SessionStatus.COMPLETED))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Completed session not found")

    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None and session.task_id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only reject sessions from your own projects")

    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()
    reason = f" Reason: {payload.notes}" if payload.notes else ""
    session.earnings = 0.0; session.status = SessionStatus.SETTLED; db.add(session)
    db.add(_Msg(sender_id=current_user.id, recipient_id=session.worker_id,
        body=f"❌ Your task \"{task.title}\" was not approved. Please contact support for more details.{reason}"))
    await db.flush()
    return {"status": "rejected", "session_id": str(session.id)}


@router.post("/sessions/{session_id}/approve")
async def admin_approve_session(session_id: uuid.UUID, payload: SessionApprovalAction, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Approve a completed session — credits the wallet and marks as SETTLED."""
    from app.models.wallet import BankAccount as _BA, Wallet as _W, Transaction as _Txn, TransactionType as _TT
    from app.models.message import Message as _Msg
    result = await db.execute(select(TaskSession).where(TaskSession.id == session_id, TaskSession.status == SessionStatus.COMPLETED))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Completed session not found")

    if not current_user.is_super_admin:
        accessible = await get_accessible_task_ids(db, current_user)
        if accessible is not None and session.task_id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only approve sessions from your own projects")

    if payload.rating is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Rating is required (1-5) to approve a session")
    if not (1.0 <= payload.rating <= 5.0):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Rating must be between 1 and 5")

    task_result = await db.execute(select(Task).where(Task.id == session.task_id))
    task = task_result.scalar_one()
    fixed_earnings = round(task.pay_rate_per_minute * task.estimated_duration_minutes, 2)
    if fixed_earnings <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session has no calculable earnings")
    session.earnings = fixed_earnings

    wallet_result = await db.execute(select(_W).where(_W.user_id == session.worker_id))
    wallet = wallet_result.scalar_one_or_none()
    if not wallet:
        wallet = _W(user_id=session.worker_id); db.add(wallet); await db.flush()
    wallet.available_balance = round(wallet.available_balance + fixed_earnings, 2)
    db.add(_Txn(user_id=session.worker_id, type=_TT.CREDIT, amount=fixed_earnings,
        description=f"Earnings approved for task: {task.title}", reference_id=str(session.id)))
    if task.status != TaskStatus.COMPLETED: task.status = TaskStatus.COMPLETED

    session.rating = round(payload.rating, 1)
    session.feedback = payload.feedback or None

    reason = f" Notes: {payload.notes}" if payload.notes else ""
    db.add(_Msg(sender_id=current_user.id, recipient_id=session.worker_id,
        body=f"✅ Your task \"{task.title}\" has been approved! RM {fixed_earnings:.2f} has been credited to your wallet.{reason}"))
    session.status = SessionStatus.SETTLED; db.add(session); await db.flush(); await db.refresh(session)
    return {"status": "approved", "session_id": str(session.id), "amount_credited": fixed_earnings, "rating": session.rating, "feedback": session.feedback}
