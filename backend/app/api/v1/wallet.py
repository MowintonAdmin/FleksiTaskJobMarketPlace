import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.wallet import Wallet, Transaction, BankAccount, WithdrawalRequest, TransactionType, WithdrawalStatus
from app.models.task_session import TaskSession, SessionStatus
from app.models.task import Task
from app.schemas.wallet import (
    WalletResponse, TransactionResponse, BankAccountRequest, BankAccountResponse,
    WithdrawalRequestCreate, WithdrawalResponse,
)

router = APIRouter(prefix="/wallet", tags=["Wallet"])


async def get_or_create_wallet(user_id: uuid.UUID, db: AsyncSession) -> Wallet:
    """Return the user's wallet, creating one if it doesn't exist."""
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(user_id=user_id)
        db.add(wallet)
        await db.flush()
    return wallet


# ── GET /wallet ───────────────────────────────────────────────────────────────

@router.get("", response_model=WalletResponse)
async def get_wallet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get wallet balance (available + pending from active sessions)."""
    wallet = await get_or_create_wallet(current_user.id, db)

    # Pending = earnings currently accumulating in active sessions
    active_sessions_result = await db.execute(
        select(TaskSession).where(
            TaskSession.worker_id == current_user.id,
            TaskSession.status == SessionStatus.ACTIVE,
        )
    )
    active_sessions = active_sessions_result.scalars().all()
    pending_balance = 0.0
    now = datetime.now(timezone.utc)
    for s in active_sessions:
        task_result = await db.execute(select(Task).where(Task.id == s.task_id))
        task = task_result.scalar_one_or_none()
        if task:
            elapsed = (now - s.checked_in_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
            pending_balance += elapsed * task.pay_rate_per_minute

    # Build response manually (pending_balance is computed, not stored)
    resp = WalletResponse(
        id=wallet.id,
        user_id=wallet.user_id,
        available_balance=round(wallet.available_balance, 2),
        pending_balance=round(pending_balance, 2),
        updated_at=wallet.updated_at,
    )
    return resp


# ── GET /wallet/transactions ──────────────────────────────────────────────────

@router.get("/transactions", response_model=list[TransactionResponse])
async def get_transactions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full transaction history for the current user."""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
    )
    return [TransactionResponse.model_validate(t) for t in result.scalars().all()]


# ── Bank account ──────────────────────────────────────────────────────────────

@router.get("/bank-account", response_model=BankAccountResponse | None)
async def get_bank_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get saved bank account (account number masked)."""
    result = await db.execute(select(BankAccount).where(BankAccount.user_id == current_user.id))
    account = result.scalar_one_or_none()
    if not account:
        return None
    # Mask all but last 4 digits
    masked = "*" * (len(account.account_number) - 4) + account.account_number[-4:]
    return BankAccountResponse(
        id=account.id,
        bank_name=account.bank_name,
        account_number=masked,
        account_holder_name=account.account_holder_name,
        created_at=account.created_at,
    )


@router.put("/bank-account", response_model=BankAccountResponse)
async def upsert_bank_account(
    payload: BankAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add or update bank account details."""
    result = await db.execute(select(BankAccount).where(BankAccount.user_id == current_user.id))
    account = result.scalar_one_or_none()
    if account:
        account.bank_name = payload.bank_name
        account.account_number = payload.account_number
        account.account_holder_name = payload.account_holder_name
    else:
        account = BankAccount(
            user_id=current_user.id,
            bank_name=payload.bank_name,
            account_number=payload.account_number,
            account_holder_name=payload.account_holder_name,
        )
        db.add(account)
    await db.flush()
    masked = "*" * (len(account.account_number) - 4) + account.account_number[-4:]
    return BankAccountResponse(
        id=account.id,
        bank_name=account.bank_name,
        account_number=masked,
        account_holder_name=account.account_holder_name,
        created_at=account.created_at,
    )


# ── Withdrawals ───────────────────────────────────────────────────────────────

@router.get("/withdrawals", response_model=list[WithdrawalResponse])
async def list_withdrawals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all withdrawal requests by the current user."""
    result = await db.execute(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.user_id == current_user.id)
        .order_by(WithdrawalRequest.created_at.desc())
    )
    return [WithdrawalResponse.model_validate(w) for w in result.scalars().all()]


@router.post("/withdraw", response_model=WithdrawalResponse, status_code=status.HTTP_201_CREATED)
async def request_withdrawal(
    payload: WithdrawalRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a withdrawal. Deducts from available_balance immediately (held pending)."""
    if payload.amount < 10:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Minimum withdrawal amount is RM 10.00")

    wallet = await get_or_create_wallet(current_user.id, db)
    if payload.amount > wallet.available_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. Available: RM {wallet.available_balance:.2f}",
        )

    # Must have a bank account
    bank_result = await db.execute(select(BankAccount).where(BankAccount.user_id == current_user.id))
    bank = bank_result.scalar_one_or_none()
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add your bank account before withdrawing",
        )

    # Deduct from wallet and mark as pending
    wallet.available_balance = round(wallet.available_balance - payload.amount, 2)

    # Create withdrawal request
    withdrawal = WithdrawalRequest(
        user_id=current_user.id,
        amount=payload.amount,
        bank_name=bank.bank_name,
        account_number=bank.account_number,
        account_holder_name=bank.account_holder_name,
    )
    db.add(withdrawal)
    await db.flush()

    # Transaction record
    txn = Transaction(
        user_id=current_user.id,
        type=TransactionType.WITHDRAWAL_PENDING,
        amount=-payload.amount,
        description=f"Withdrawal request to {bank.bank_name} ···{bank.account_number[-4:]}",
        reference_id=str(withdrawal.id),
    )
    db.add(txn)
    await db.flush()

    return WithdrawalResponse.model_validate(withdrawal)
