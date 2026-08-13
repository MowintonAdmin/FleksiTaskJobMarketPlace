import asyncio
from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as session:
        # Update all super admin / admin users with full_name 'Eng Hoo' or default to 'Admin'
        stmt = (
            update(User)
            .where((User.is_admin == True) | (User.is_super_admin == True))
            .values(full_name="Admin")
        )
        result = await session.execute(stmt)
        await session.commit()
        print(f"Updated {result.rowcount} admin user(s) full_name to 'Admin'")

if __name__ == "__main__":
    asyncio.run(main())
