"""
WebSocket connection manager for the admin dashboard.
Authenticates admins via JWT, manages connections, and broadcasts events.
"""
import json
import logging
from typing import Any
from fastapi import WebSocket, WebSocketDisconnect, status
from jose import jwt as jose_jwt, JWTError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ConnectionManager:
    """
    Manages multiple WebSocket connections from admin users.
    Each connection is tied to an admin user_id.
    """

    def __init__(self):
        # {user_id: list[WebSocket]}
        self._connections: dict[str, list[WebSocket]] = {}
        # {user_id: set[str]} — list of active user IDs for quick check
        self._active_users: set[str] = set()

    async def connect(self, websocket: WebSocket, user_id: str) -> bool:
        """Accept a WebSocket connection and register it under user_id."""
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        self._active_users.add(user_id)
        logger.info("WebSocket connected: user=%s total_connections=%d", user_id, self.count())
        return True

    async def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection for the given user."""
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
                self._active_users.discard(user_id)
        logger.info("WebSocket disconnected: user=%s total_connections=%d", user_id, self.count())

    async def broadcast(self, event: dict[str, Any]):
        """Send an event to ALL connected admin users."""
        message = json.dumps(event)
        disconnected = []
        for user_id, sockets in list(self._connections.items()):
            for ws in sockets:
                try:
                    await ws.send_text(message)
                except Exception:
                    disconnected.append((user_id, ws))
        for uid, ws in disconnected:
            await self.disconnect(ws, uid)

    async def broadcast_to_admins(self, event: dict[str, Any]):
        """Alias for broadcast — sends to all connected admins."""
        await self.broadcast(event)

    def count(self) -> int:
        """Return the total number of connected WebSocket clients."""
        return sum(len(socks) for socks in self._connections.values())

    def is_user_connected(self, user_id: str) -> bool:
        """Check if a specific admin has an active connection."""
        return user_id in self._active_users


# Singleton instance
manager = ConnectionManager()


async def authenticate_ws(websocket: WebSocket) -> str | None:
    """
    Extract and validate the JWT token from the WebSocket query string.
    Returns the user_id (as string) if valid, or None.
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    try:
        payload = jose_jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_sub": False},
        )
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None
        return str(user_id)
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None