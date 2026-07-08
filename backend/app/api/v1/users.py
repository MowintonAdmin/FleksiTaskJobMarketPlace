import os
import uuid
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from datetime import datetime, timezone
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, FCMTokenUpdate
from app.core.deps import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/users", tags=["Users"])
settings = get_settings()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTERNAL_PHOTO_HOSTS = ("googleusercontent.com", "google.com")
PHOTO_PROXY_TIMEOUT_SECONDS = 10
PHOTO_PROXY_MAX_BYTES = 5 * 1024 * 1024


def _is_allowed_external_photo_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme in {"http", "https"} and bool(host) and any(
        host == allowed_host or host.endswith(f".{allowed_host}")
        for allowed_host in ALLOWED_EXTERNAL_PHOTO_HOSTS
    )


@router.get("/photo-proxy")
async def proxy_profile_photo(url: str = Query(..., min_length=1)):
    if not _is_allowed_external_photo_url(url):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid external photo URL")

    request = Request(url, headers={"User-Agent": "FlekxiTask/1.0"})
    try:
        with urlopen(request, timeout=PHOTO_PROXY_TIMEOUT_SECONDS) as upstream:
            content_type = upstream.headers.get_content_type()
            if not content_type.startswith("image/"):
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid external photo content type")

            content = upstream.read(PHOTO_PROXY_MAX_BYTES + 1)
            if len(content) > PHOTO_PROXY_MAX_BYTES:
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="External photo exceeds size limit")

            return Response(
                content=content,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=3600"},
            )
    except HTTPException:
        raise
    except (HTTPError, URLError, TimeoutError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch external photo") from exc


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = payload.model_dump(exclude_unset=True)

    # Validate mandatory fields
    errors = []
    if "full_name" in update_data and not update_data["full_name"]:
        errors.append("Full name is required")
    if "phone" in update_data and not update_data["phone"]:
        errors.append("Phone number is required")
    if "nric_passport" in update_data and not update_data["nric_passport"]:
        errors.append("NRIC/Passport number is required")
    if "body_height_cm" in update_data and (update_data["body_height_cm"] is None or update_data["body_height_cm"] <= 0):
        errors.append("Body height must be greater than 0")
    if errors:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=errors)

    if "skills" in update_data and update_data["skills"] is not None:
        update_data["skills"] = json.dumps(update_data["skills"])
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.add(current_user)
    return current_user


@router.post("/me/photo", response_model=UserResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG, PNG, and WebP images are allowed")

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    media_path = Path(settings.MEDIA_DIR) / "profiles"
    media_path.mkdir(parents=True, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.id}.{ext}"
    file_path = media_path / filename

    with open(file_path, "wb") as f:
        f.write(content)

    current_user.profile_photo_url = f"/media/profiles/{filename}"
    db.add(current_user)
    return current_user


@router.post("/me/bank-qr", response_model=UserResponse)
async def upload_bank_qr(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a Bank QR code image for payment processing."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG, PNG, and WebP images are allowed")

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    media_path = Path(settings.MEDIA_DIR) / "bank-qr"
    media_path.mkdir(parents=True, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.id}_bank_qr.{ext}"
    file_path = media_path / filename

    with open(file_path, "wb") as f:
        f.write(content)

    current_user.bank_qr_code_url = f"/media/bank-qr/{filename}"
    db.add(current_user)
    return current_user


@router.post("/me/id-photo-front", response_model=UserResponse)
async def upload_id_photo_front(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a photo of the front of your NRIC/Passport."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG, PNG, and WebP images are allowed")

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    media_path = Path(settings.MEDIA_DIR) / "id-photos"
    media_path.mkdir(parents=True, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.id}_id_front.{ext}"
    file_path = media_path / filename

    with open(file_path, "wb") as f:
        f.write(content)

    current_user.id_photo_front_url = f"/media/id-photos/{filename}"
    db.add(current_user)
    return current_user


@router.post("/me/selfie", response_model=UserResponse)
async def upload_selfie(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a selfie with ID for identity verification."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG, PNG, and WebP images are allowed")

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    media_path = Path(settings.MEDIA_DIR) / "selfies"
    media_path.mkdir(parents=True, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.id}_selfie.{ext}"
    file_path = media_path / filename

    with open(file_path, "wb") as f:
        f.write(content)

    current_user.selfie_with_id_url = f"/media/selfies/{filename}"
    db.add(current_user)
    return current_user


@router.post("/me/submit-verification", response_model=UserResponse)
async def submit_for_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit your profile for admin verification.
    Once submitted, the admin will review your information and approve or reject it.
    """
    if current_user.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your account is already verified")
    if current_user.verification_status == "submitted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your verification is already pending review")
    # Rejected users can resubmit

    current_user.verification_status = "submitted"
    current_user.verification_submitted_at = datetime.now(timezone.utc)
    db.add(current_user)
    return current_user


@router.put("/me/fcm-token", status_code=status.HTTP_204_NO_CONTENT)
async def update_fcm_token(
    payload: FCMTokenUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.fcm_token = payload.fcm_token
    db.add(current_user)


@router.get("/admins", response_model=list[UserResponse])
async def list_admin_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all admin users so workers can initiate a conversation with support."""
    result = await db.execute(
        select(User).where(User.is_admin == True).order_by(User.full_name)  # noqa: E712
    )
    return [UserResponse.model_validate(u) for u in result.scalars().all()]
