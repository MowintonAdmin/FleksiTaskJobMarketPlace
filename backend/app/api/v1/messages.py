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


class ReactionRequest(BaseModel):
    reaction: str | None  # emoji string or null to remove


class MessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    sender_name: str | None = None
    body: str
    is_read: bool
    reaction: str | None = None
    reply_to_id: uuid.UUID | None = None
    reply_to_body: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationSummary(BaseModel):
    user_id: uuid.UUID
    user_name: str | None = None
    user_photo: str | None = None
    last_message: str
    last_message_at: datetime
    unread_count: int


# Quick reply templates for admin
QUICK_REPLIES = [
    {"text": "Thanks for your message! We'll review and get back to you.", "label": "Acknowledge"},
    {"text": "Please provide more details about the task.", "label": "Request Details"},
    {"text": "Your task has been approved. You can start work now.", "label": "Task Approved"},
    {"text": "Your application has been received. We'll review it shortly.", "label": "App Received"},
    {"text": "Thank you for your patience. We're looking into this.", "label": "Patient Reply"},
    {"text": "Please upload a clearer photo of your ID.", "label": "Re-upload ID"},
]


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
    await db.refresh(msg)
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


@router.get("/conversation/{user_id}/read-statuses")
async def get_read_statuses(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return IDs of messages sent by current_user to user_id that are still unread."""
    result = await db.execute(
        select(Message.id).where(
            Message.sender_id == current_user.id,
            Message.recipient_id == user_id,
            Message.is_read == False,  # noqa: E712
        )
    )
    return {"unread_ids": [str(row.id) for row in result.all()]}


@router.get("/quick-replies")
async def get_quick_replies():
    """Return admin quick reply templates."""
    return QUICK_REPLIES


@router.post("/reaction/{message_id}", response_model=MessageResponse)
async def react_to_message(
    message_id: uuid.UUID,
    payload: ReactionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """React to a message (add/change/remove emoji reaction)."""
    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    # Only sender or recipient can react
    if message.sender_id != current_user.id and message.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised to react to this message")

    message.reaction = payload.reaction if payload.reaction else None
    await db.flush()
    await db.refresh(message)
    resp = MessageResponse.model_validate(message)
    if message.sender:
        resp.sender_name = message.sender.full_name
    return resp


@router.post("/typing/{user_id}")
async def typing_indicator(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    """Simple typing indicator — frontend polls to check if user is typing.
    Stores the typing state in Redis with a short TTL.
    """
    from app.core.redis_client import set_session, get_session, delete_session

    key = f"typing:{current_user.id}:{user_id}"
    await set_session(key, "1", ttl=3)  # auto-expires after 3s
    return {"status": "ok"}


@router.get("/typing/{user_id}")
async def check_typing(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    """Check if user user_id is currently typing to the current user."""
    from app.core.redis_client import get_session

    key = f"typing:{user_id}:{current_user.id}"
    val = await get_session(key)
    return {"typing": val is not None}


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a message. Only the original sender or an admin may delete."""
    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.sender_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised to delete this message")
    await db.delete(message)
    await db.flush()
