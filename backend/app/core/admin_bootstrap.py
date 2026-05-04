import logging

from sqlalchemy import select

from app.core.security import hash_password
from app.database import AsyncSessionLocal
from app.models.user import User

logger = logging.getLogger(__name__)


async def create_or_update_admin(
    email: str,
    password: str,
    full_name: str,
    *,
    reset_password: bool,
) -> str:
    normalized_email = email.strip().lower()
    normalized_full_name = full_name.strip() or "Platform Admin"

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                email=normalized_email,
                full_name=normalized_full_name,
                hashed_password=hash_password(password),
                is_admin=True,
                is_verified=True,
                is_active=True,
            )
            session.add(user)
            action = "created"
        else:
            if reset_password or not user.hashed_password:
                user.hashed_password = hash_password(password)
            if not user.full_name:
                user.full_name = normalized_full_name
            user.is_admin = True
            user.is_active = True
            user.is_verified = True
            action = "updated"

        await session.commit()
        return action


async def bootstrap_admin_account(email: str | None, password: str | None, full_name: str | None) -> None:
    if not email or not password:
        return

    action = await create_or_update_admin(
        email=email,
        password=password,
        full_name=full_name or "Platform Admin",
        reset_password=False,
    )
    logger.info("Admin bootstrap %s account for %s", action, email.strip().lower())