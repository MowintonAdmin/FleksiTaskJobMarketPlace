"""
WebSocket endpoint for the admin dashboard.
Admins connect via: ws://host/api/v1/ws/admin?token=JWT_TOKEN
"""
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.ws.manager import manager, authenticate_ws

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/admin")
async def admin_websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for admin dashboard real-time updates.
    Authentication is done via JWT token in the query string.
    """
    user_id = await authenticate_ws(websocket)
    if not user_id:
        return

    await manager.connect(websocket, user_id)
    try:
        # Send a welcome/ping event so the client knows it's connected
        await websocket.send_text(json.dumps({"type": "CONNECTED", "data": {"user_id": user_id}}))
        
        # Keep the connection alive by reading (client sends pings)
        while True:
            data = await websocket.receive_text()
            # Handle client ping/pong
            try:
                msg = json.loads(data)
                if msg.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
            except (json.JSONDecodeError, TypeError):
                pass
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error("WebSocket error for user %s: %s", user_id, e)
        await manager.disconnect(websocket, user_id)