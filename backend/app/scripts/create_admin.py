import argparse
import asyncio

from sqlalchemy import select

import app.models  # noqa: F401
from app.core.security import hash_password
from app.database import AsyncSessionLocal
from app.models.user import User


async def create_or_update_admin(email: str, password: str, full_name: str) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
                is_admin=True,
                is_verified=True,
                is_active=True,
            )
            session.add(user)
            action = "created"
        else:
            user.full_name = full_name or user.full_name
            user.hashed_password = hash_password(password)
            user.is_admin = True
            user.is_active = True
            user.is_verified = True
            action = "updated"

        await session.commit()
        print(f"Admin account {action}: {email}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update an admin user.")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--full-name", default="Platform Admin", help="Display name for the admin account")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(create_or_update_admin(args.email.strip().lower(), args.password, args.full_name.strip()))


if __name__ == "__main__":
    main()