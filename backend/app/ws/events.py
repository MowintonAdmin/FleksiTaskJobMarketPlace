"""
Event emitter — helper functions that backend endpoints call to
push real-time updates to connected admin clients via WebSocket.
"""
from typing import Any

from app.ws.manager import manager


async def emit_event(event_type: str, data: dict[str, Any]):
    """
    Emit a lightweight event to all connected admin users.
    Examples:
      await emit_event("NEW_APPLICATION", {"application_id": "...", "worker_name": "..."})
      await emit_event("NEW_MESSAGE", {"sender_name": "...", "preview": "...", "unread_count": 5})
      await emit_event("WITHDRAWAL_UPDATED", {"withdrawal_id": "...", "status": "APPROVED"})
    """
    await manager.broadcast({"type": event_type, "data": data})


async def emit_new_application(application_id: str, task_id: str, worker_name: str, worker_email: str):
    """Emitted when a new task application is submitted."""
    await emit_event("NEW_APPLICATION", {
        "application_id": application_id,
        "task_id": task_id,
        "worker_name": worker_name,
        "worker_email": worker_email,
    })


async def emit_new_message(sender_id: str, sender_name: str, preview: str, unread_count: int):
    """Emitted when a new message is sent (admin receives notification)."""
    await emit_event("NEW_MESSAGE", {
        "sender_id": sender_id,
        "sender_name": sender_name,
        "preview": preview[:100],
        "unread_count": unread_count,
    })


async def emit_withdrawal_update(withdrawal_id: str, worker_name: str, amount: float, status: str):
    """Emitted when a withdrawal request is created or its status changes."""
    await emit_event("WITHDRAWAL_UPDATED", {
        "withdrawal_id": withdrawal_id,
        "worker_name": worker_name,
        "amount": amount,
        "status": status,
    })


async def emit_new_registration(user_id: str, full_name: str, email: str):
    """Emitted when a new worker registers."""
    await emit_event("NEW_REGISTRATION", {
        "user_id": user_id,
        "full_name": full_name,
        "email": email,
    })


async def emit_task_status_change(task_id: str, task_title: str, old_status: str, new_status: str):
    """Emitted when a task status changes."""
    await emit_event("TASK_STATUS_CHANGED", {
        "task_id": task_id,
        "task_title": task_title,
        "old_status": old_status,
        "new_status": new_status,
    })


async def emit_payment_update(session_id: str, worker_name: str, amount: float, status: str):
    """Emitted when a payment/session is approved or rejected."""
    await emit_event("PAYMENT_UPDATED", {
        "session_id": session_id,
        "worker_name": worker_name,
        "amount": amount,
        "status": status,
    })


async def emit_admin_notification(title: str, message: str, notification_type: str = "info"):
    """Emitted for general admin notifications."""
    await emit_event("ADMIN_NOTIFICATION", {
        "title": title,
        "message": message,
        "type": notification_type,
    })