import asyncio
from app.database import AsyncSessionLocal
from app.models.task import Task, TaskStatus
from app.models.task_session import TaskSession, SessionStatus
from sqlalchemy import select, func

async def check():
    async with AsyncSessionLocal() as db:
        tasks = (await db.execute(select(Task).where(Task.max_applicants >= 2))).scalars().all()
        print("=== MULTI-WORKER TASKS STATUS AUDIT ===")
        for t in tasks:
            approved_count = (await db.execute(
                select(func.count(func.distinct(TaskSession.worker_id))).where(
                    TaskSession.task_id == t.id,
                    TaskSession.status == SessionStatus.SETTLED
                )
            )).scalar_one()
            print(f"Task: '{t.title}' | Workers Needed: {t.max_applicants} | Approved Workers: {approved_count} | Status: {t.status}")

if __name__ == "__main__":
    asyncio.run(check())
