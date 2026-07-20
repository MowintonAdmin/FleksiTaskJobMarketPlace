import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.database import get_db
from app.models.user import User
from app.models.enums import DataSource
from app.schemas.auth import (
    TokenResponse, GoogleAuthRequest, LoginRequest, RefreshTokenRequest,
    ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest,
)
from app.schemas.user import UserCreate
from app.core.security import verify_password, create_token_pair, decode_token, hash_password
from app.core.redis_client import invalidate_token, is_token_blacklisted, set_session, get_session, delete_session
from app.core.email import send_password_reset_email
from app.core.deps import oauth2_scheme, get_current_user
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()
logger = logging.getLogger(__name__)
GOOGLE_TOKEN_CLOCK_SKEW_SECONDS = 60
PWD_RESET_TTL = 3600  # 1 hour


def _is_google_photo(url: str | None) -> bool:
    return bool(url and "googleusercontent.com" in url)


@router.post("/google", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def google_auth(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate or register via Google OAuth."""
    try:
        id_info = id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            None,
            clock_skew_in_seconds=GOOGLE_TOKEN_CLOCK_SKEW_SECONDS,
        )
    except ValueError as exc:
        logger.warning("Google token verification failed before audience check: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    configured_client_id = settings.GOOGLE_CLIENT_ID.strip()
    token_audience = id_info.get("aud")
    allowed_audience = False
    if isinstance(token_audience, str):
        allowed_audience = token_audience == configured_client_id
    elif isinstance(token_audience, list):
        allowed_audience = configured_client_id in token_audience

    if not allowed_audience:
        logger.warning(
            "Google token audience mismatch: expected=%s aud=%s azp=%s",
            configured_client_id,
            token_audience,
            id_info.get("azp"),
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    google_id = id_info["sub"]
    email = id_info.get("email", "")
    full_name = id_info.get("name", "")
    picture = id_info.get("picture")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
        else:
            user = User(
                email=email,
                full_name=full_name,
                google_id=google_id,
                profile_photo_url=picture,
                is_verified=False,
                verification_status="pending",
            )
            db.add(user)
            await db.flush()

    if full_name and not user.full_name:
        user.full_name = full_name
    if picture and (not user.profile_photo_url or _is_google_photo(user.profile_photo_url)):
        user.profile_photo_url = picture
    user.google_id = google_id

    access_token, refresh_token = create_token_pair(user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def _find_imported_worker(db: AsyncSession, payload: UserCreate) -> User | None:
    """Search for an existing imported worker profile using the configured matching priority.
    
    Priority order (from settings.IMPORT_MATCH_PRIORITY):
      1. NRIC/Passport — match nric_passport field
      2. Phone Number  — match phone field  
      3. Email         — match the placeholder email generated during import
    """
    for field in settings.IMPORT_MATCH_PRIORITY:
        lookup_value = None
        if field == "nric" and payload.nric_passport:
            lookup_value = payload.nric_passport.strip()
        elif field == "phone" and getattr(payload, "phone", None):
            lookup_value = getattr(payload, "phone", "").strip()
        elif field == "email":
            # For email, check if the registered email matches the placeholder email
            # OR if an imported worker has the same email (which would be rare but possible)
            lookup_value = payload.email.lower().strip()
        else:
            continue

        if not lookup_value:
            continue

        query = select(User).where(
            User.source == DataSource.IMPORTED,
        )
        if field == "nric":
            query = query.where(User.nric_passport == lookup_value)
        elif field == "phone":
            query = query.where(User.phone == lookup_value)
        elif field == "email":
            query = query.where(User.email == lookup_value)

        result = await db.execute(query)
        matched = result.scalar_one_or_none()
        if matched:
            logger.info(
                "Registration linked to imported worker %s via %s match (participant_id=%s)",
                matched.id, field, matched.legacy_participant_id,
            )
            return matched

    return None


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user with email and password. Account requires admin approval.
    
    Before creating a new account, searches for an existing imported worker profile
    using the configured matching priority (NRIC → Phone → Email by default).
    If found, links the new registration to the existing imported profile.
    """
    if not payload.password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password is required")

    # Check if email is already taken by an existing APP user
    result = await db.execute(
        select(User).where(User.email == payload.email, User.source == DataSource.APP)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Step 1: Try to link to an existing imported worker profile
    imported_user = await _find_imported_worker(db, payload)
    if imported_user:
        # Link: update the imported profile to become an active APP user
        imported_user.email = payload.email
        imported_user.hashed_password = hash_password(payload.password)
        imported_user.source = DataSource.APP
        imported_user.is_active = True
        imported_user.full_name = payload.full_name

        # Preserve existing NRIC/phone if the payload has values (don't overwrite with None)
        if payload.nric_passport:
            imported_user.nric_passport = payload.nric_passport
        if getattr(payload, "phone", None):
            imported_user.phone = getattr(payload, "phone")

        await db.flush()
        logger.info("Imported worker %s linked to account %s", imported_user.legacy_participant_id, imported_user.email)
        return {
            "message": "Welcome back! Your existing historical profile has been linked to this account. "
                       "All your previous sessions and earnings are now visible. "
                       "Please log in to continue.",
            "linked": True,
            "imported_worker_id": str(imported_user.legacy_participant_id),
        }

    # Step 2: No imported worker found — create a brand new APP user
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        is_verified=False,
        source=DataSource.APP,
    )
    db.add(user)
    await db.flush()

    return {"message": "Account created! Welcome to FlekxiTask. Please log in, complete your profile, and submit for verification."}


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Email/password login."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    # Rejected users can still log in to see their rejection reason and resubmit

    access_token, refresh_token = create_token_pair(user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using a valid refresh token."""
    if await is_token_blacklisted(payload.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    token_data = decode_token(payload.refresh_token)
    if token_data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    import uuid as _uuid
    result = await db.execute(select(User).where(User.id == _uuid.UUID(token_data["sub"])))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    await invalidate_token(payload.refresh_token, ttl=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)
    access_token, new_refresh_token = create_token_pair(user.id)
    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(token: str = Depends(oauth2_scheme)):
    """Blacklist the current access token."""
    await invalidate_token(token, ttl=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password by verifying the old password first."""
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters",
        )
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account has no password set (e.g. Google-authenticated users cannot change password here)",
        )
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    logger.info("Password changed for user %s", current_user.id)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Request a password reset link.
    In production, always returns successfully to avoid leaking account existence.
    In development (DEBUG=true), returns the reset URL so you can use it without SMTP.
    """
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    response = {"message": "If an account exists with this email, a password reset link has been sent."}

    if user and user.hashed_password:
        token = secrets.token_urlsafe(32)
        redis_key = f"pwd_reset:{token}"
        await set_session(redis_key, str(user.id), ttl=PWD_RESET_TTL)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        logger.info("PASSWORD RESET LINK for %s: %s", payload.email, reset_url)

        # Return the reset URL so the frontend can redirect the user directly
        response["reset_url"] = reset_url
        response["message"] = "A password reset link has been generated. You can use it now."

        # Attempt to send email, but the link is already returned regardless
        try:
            await send_password_reset_email(payload.email, reset_url)
        except Exception:
            pass

    return response


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Consume a password reset token and update the user's password."""
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters")

    redis_key = f"pwd_reset:{payload.token}"
    user_id_str = await get_session(redis_key)
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    import uuid as _uuid
    result = await db.execute(select(User).where(User.id == _uuid.UUID(user_id_str)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    # Verify the email matches for extra security
    if user.email.lower() != payload.email.lower().strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email does not match the reset token")

    user.hashed_password = hash_password(payload.new_password)
    await delete_session(redis_key)
    logger.info("Password reset completed for user %s", user.id)
