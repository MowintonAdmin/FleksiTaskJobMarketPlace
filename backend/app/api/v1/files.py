import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from app.config import get_settings
from app.core.security import decode_token
from app.core.redis_client import is_token_blacklisted
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
import uuid

router = APIRouter(prefix="/files", tags=["Files"])

from fastapi.security import OAuth2PasswordBearer

_oauth2_scheme_for_files = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


@router.get("/{path:path}")
async def serve_file(
    path: str,
    token: str | None = Query(None),
    authorization: str | None = Depends(_oauth2_scheme_for_files),
    db: AsyncSession = Depends(get_db),
):
    """Serve uploaded media files through the API path.
    Requires valid JWT authentication (via Authorization header or ?token= query param).
    Prevents public access to uploaded identity documents (NRIC, selfie, bank QR).
    """
    # Extract token from either query param or Authorization header
    jwt_token = token or authorization
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    if await is_token_blacklisted(jwt_token):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    payload = decode_token(jwt_token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    from pathlib import Path
    settings = get_settings()
    base_dir = Path(settings.MEDIA_DIR).resolve()
    clean_path = path.lstrip("/")
    target_file = (Path(settings.MEDIA_DIR) / clean_path).resolve()

    if not target_file.is_relative_to(base_dir):
        raise HTTPException(status_code=400, detail="Invalid path traversal attempt")

    if not target_file.exists() or not target_file.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(str(target_file))
