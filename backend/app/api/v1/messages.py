import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.message import Message
from app.models.user import User
from app.core.deps import get_current_user

router = APIRouter(prefix="/messages", tags=["Messages"])


class MessageCreate(BaseModel):
    recipient_id: uuid.UUID
    body: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    sender_name: str | None = None
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationSummary(BaseModel):
    user_id: uuid.UUID
    user_name: str | None = None
    user_photo: str | None = None
    last_message: str
    last_message_at: datetime
    unread_count: int


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return one summary entry per conversation partner, ordered by latest message."""
    result = await db.execute(
        select(Message).where(
            or_(
                Message.sender_id == current_user.id,
                Message.recipient_id == current_user.id,
            )
        ).order_by(Message.created_at.desc())
    )
    all_msgs = result.scalars().all()

    # Deduplicate: keep only the latest message per partner
    seen: dict[uuid.UUID, Message] = {}
    for msg in all_msgs:
        partner_id = msg.recipient_id if msg.sender_id == current_user.id else msg.sender_id
        if partner_id not in seen:
            seen[partner_id] = msg

    if not seen:
        return []

    # Fetch unread counts per partner in one query
    unread_result = await db.execute(
        select(Message.sender_id, func.count().label("cnt"))
        .where(
            Message.recipient_id == current_user.id,
            Message.is_read == False,  # noqa: E712
        )
        .group_by(Message.sender_id)
    )
    unread_map: dict[uuid.UUID, int] = {row.sender_id: row.cnt for row in unread_result}

    # Fetch partner user rows
    partner_ids = list(seen.keys())
    users_result = await db.execute(select(User).where(User.id.in_(partner_ids)))
    user_map: dict[uuid.UUID, User] = {u.id: u for u in users_result.scalars().all()}

    out: list[ConversationSummary] = []
    for partner_id, last_msg in seen.items():
        partner = user_map.get(partner_id)
        out.append(ConversationSummary(
            user_id=partner_id,
            user_name=partner.full_name if partner else "Unknown",
            user_photo=partner.profile_photo_url if partner else None,
            last_message=last_msg.body,
            last_message_at=last_msg.created_at,
            unread_count=unread_map.get(partner_id, 0),
        ))

    out.sort(key=lambda c: c.last_message_at, reverse=True)
    return out


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.body.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message body cannot be empty")
    recipient = await db.execute(select(User).where(User.id == payload.recipient_id))
    if not recipient.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    msg = Message(sender_id=current_user.id, recipient_id=payload.recipient_id, body=payload.body.strip())
    db.add(msg)
    await db.flush()
    resp = MessageResponse.model_validate(msg)
    resp.sender_name = current_user.full_name
    return resp


@router.get("/conversation/{user_id}", response_model=list[MessageResponse])
async def get_conversation(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages between current user and a specific user."""
    result = await db.execute(
        select(Message).where(
            or_(
                and_(Message.sender_id == current_user.id, Message.recipient_id == user_id),
                and_(Message.sender_id == user_id, Message.recipient_id == current_user.id),
            )
        ).order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    # Mark as read
    for msg in messages:
        if msg.recipient_id == current_user.id and not msg.is_read:
            msg.is_read = True
    await db.flush()

    out = []
    for msg in messages:
        sender_result = await db.execute(select(User).where(User.id == msg.sender_id))
        sender = sender_result.scalar_one_or_none()
        resp = MessageResponse.model_validate(msg)
        resp.sender_name = sender.full_name if sender else "Unknown"
        out.append(resp)
    return out


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count()).select_from(Message).where(
            Message.recipient_id == current_user.id,
            Message.is_read == False,  # noqa: E712
        )
    )
    return {"count": result.scalar_one()}

    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.body.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message body cannot be empty")
    recipient = await db.execute(select(User).where(User.id == payload.recipient_id))
    if not recipient.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    msg = Message(sender_id=current_user.id, recipient_id=payload.recipient_id, body=payload.body.strip())
    db.add(msg)
    await db.flush()
    resp = MessageResponse.model_validate(msg)
    resp.sender_name = current_user.full_name
    return resp


@router.get("/conversation/{user_id}", response_model=list[MessageResponse])
async def get_conversation(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages between current user and a specific user."""
    result = await db.execute(
        select(Message).where(
            or_(
                and_(Message.sender_id == current_user.id, Message.recipient_id == user_id),
                and_(Message.sender_id == user_id, Message.recipient_id == current_user.id),
            )
        ).order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    # Mark as read
    for msg in messages:
        if msg.recipient_id == current_user.id and not msg.is_read:
            msg.is_read = True
    await db.flush()

    out = []
    for msg in messages:
        sender_result = await db.execute(select(User).where(User.id == msg.sender_id))
        sender = sender_result.scalar_one_or_none()
        resp = MessageResponse.model_validate(msg)
        resp.sender_name = sender.full_name if sender else "Unknown"
        out.append(resp)
    return out


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    result = await db.execute(
        select(func.count()).select_from(Message).where(
            Message.recipient_id == current_user.id,
            Message.is_read == False,  # noqa: E712
        )
    )
    return {"count": result.scalar_one()}
