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

    # pending_balance is always 0 — the system no longer uses live earnings.
    # Payment is only credited after admin approval (Session Approval flow).
    pending_balance = 0.0

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
    """Get saved payment account (bank or eWallet)."""
    result = await db.execute(select(BankAccount).where(BankAccount.user_id == current_user.id))
    account = result.scalar_one_or_none()
    if not account:
        return None
    # Mask all but last 4 digits for bank accounts
    if account.payment_type == "bank_transfer" and account.account_number:
        masked = "*" * (len(account.account_number) - 4) + account.account_number[-4:]
    else:
        masked = account.account_number
    return BankAccountResponse(
        id=account.id,
        payment_type=account.payment_type,
        bank_name=account.bank_name,
        account_number=masked,
        account_holder_name=account.account_holder_name,
        phone_number=account.phone_number,
        created_at=account.created_at,
    )


@router.put("/bank-account", response_model=BankAccountResponse)
async def upsert_bank_account(
    payload: BankAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add or update payment account (bank transfer or Touch 'n Go eWallet)."""
    # Cross-field length check (bank-specific digit count)
    try:
        payload.validate_account_length()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    result = await db.execute(select(BankAccount).where(BankAccount.user_id == current_user.id))
    account = result.scalar_one_or_none()
    if account:
        account.payment_type = payload.payment_type
        account.bank_name = payload.bank_name if payload.payment_type == "bank_transfer" else None
        account.account_number = payload.account_number if payload.payment_type == "bank_transfer" else None
        account.account_holder_name = payload.account_holder_name if payload.payment_type == "bank_transfer" else None
        account.phone_number = payload.phone_number if payload.payment_type == "tng_ewallet" else None
    else:
        account = BankAccount(
            user_id=current_user.id,
            payment_type=payload.payment_type,
            bank_name=payload.bank_name if payload.payment_type == "bank_transfer" else None,
            account_number=payload.account_number if payload.payment_type == "bank_transfer" else None,
            account_holder_name=payload.account_holder_name if payload.payment_type == "bank_transfer" else None,
            phone_number=payload.phone_number if payload.payment_type == "tng_ewallet" else None,
        )
        db.add(account)
    await db.flush()
    return BankAccountResponse(
        id=account.id,
        payment_type=account.payment_type,
        bank_name=account.bank_name,
        account_number=account.account_number,
        account_holder_name=account.account_holder_name,
        phone_number=account.phone_number,
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

    # Must have a payment account
    bank_result = await db.execute(select(BankAccount).where(BankAccount.user_id == current_user.id))
    bank = bank_result.scalar_one_or_none()
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add your payment account before withdrawing",
        )

    # Deduct from wallet and mark as pending
    wallet.available_balance = round(wallet.available_balance - payload.amount, 2)

    # Create withdrawal request
    withdrawal = WithdrawalRequest(
        user_id=current_user.id,
        amount=payload.amount,
        payment_type=bank.payment_type,
        bank_name=bank.bank_name,
        account_number=bank.account_number,
        account_holder_name=bank.account_holder_name,
        phone_number=bank.phone_number,
    )
    db.add(withdrawal)
    await db.flush()

    # Transaction record
    if bank.payment_type == "tng_ewallet":
        desc = f"Withdrawal request to Touch 'n Go eWallet · {bank.phone_number}"
    else:
        desc = f"Withdrawal request to {bank.bank_name} ···{bank.account_number[-4:]}"
    txn = Transaction(
        user_id=current_user.id,
        type=TransactionType.WITHDRAWAL_PENDING,
        amount=-payload.amount,
        description=desc,
        reference_id=str(withdrawal.id),
    )
    db.add(txn)
    await db.flush()
    await db.refresh(withdrawal)

    return WithdrawalResponse.model_validate(withdrawal)
