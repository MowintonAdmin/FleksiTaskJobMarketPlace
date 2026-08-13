import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from app.config import get_settings
from app.api.v1 import router as api_router
from app.core.admin_bootstrap import bootstrap_admin_account
from app.core.firebase import init_firebase
from app.core.redis_client import close_redis
from app.database import init_db, get_db

settings = get_settings()


async def auto_close_overdue_projects():
    """Periodically check for overdue projects and auto-close them."""
    from sqlalchemy import select, update
    from app.models.project import Project, ProjectStatus
    from app.models.task import Task, TaskStatus
    from app.models.task_session import TaskSession, SessionStatus
    from app.models.message import Message
    from app.database import AsyncSessionLocal
    from app.core.redis_client import get_redis
    from datetime import datetime, timezone

    while True:
        try:
            # uvicorn runs multiple workers, each with its own copy of this loop;
            # use a short-lived Redis lock so only one worker processes a given cycle.
            redis = await get_redis()
            if redis is not None:
                acquired = await redis.set("lock:auto_close_overdue_projects", "1", nx=True, ex=55)
                if not acquired:
                    await asyncio.sleep(60)
                    continue

            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                # Find all active projects that are past their due date
                result = await db.execute(
                    select(Project).where(
                        Project.status == ProjectStatus.ACTIVE,
                        Project.due_date.isnot(None),
                        Project.due_date <= now,
                    )
                )
                overdue = result.scalars().all()
                for project in overdue:
                    project.status = ProjectStatus.COMPLETED

                    # Close all tasks (open + in_progress) in the project
                    await db.execute(
                        update(Task).where(
                            Task.project_id == project.id,
                            Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
                        ).values(status=TaskStatus.COMPLETED)
                    )

                    # Force-stop any active task sessions in the project
                    active_sessions = await db.execute(
                        select(TaskSession).where(
                            TaskSession.task_id.in_(
                                select(Task.id).where(Task.project_id == project.id)
                            ),
                            TaskSession.status == SessionStatus.ACTIVE,
                        )
                    )
                    for session in active_sessions.scalars().all():
                        session.checked_out_at = now
                        session.status = SessionStatus.COMPLETED
                        session.proof_notes = "[Auto-closed: project due date passed]"
                        # Notify worker
                        task_result = await db.execute(select(Task).where(Task.id == session.task_id))
                        task = task_result.scalar_one_or_none()
                        # Use fixed task total pay (pay_rate × estimated_duration) instead of live calculation
                        earnings = round((task.pay_rate_per_minute * task.estimated_duration_minutes) if task else 0, 2)
                        session.earnings = earnings
                        db.add(Message(
                            sender_id=project.created_by_id,
                            recipient_id=session.worker_id,
                            body=f"⏰ The project \"{project.name}\" has reached its due date and was automatically closed. "
                                f"Your active session for \"{task.title if task else 'Unknown task'}\" has been stopped "
                                f"with RM {earnings:.2f} pending approval."
                        ))

                if overdue:
                    await db.commit()
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info("Auto-closed %d overdue project(s)", len(overdue))
        except Exception:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception("Error in auto_close_overdue_projects")
        await asyncio.sleep(60)  # Check every 1 minute


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await bootstrap_admin_account(
        settings.BOOTSTRAP_ADMIN_EMAIL,
        settings.BOOTSTRAP_ADMIN_PASSWORD,
        settings.BOOTSTRAP_ADMIN_FULL_NAME,
    )
    init_firebase()
    Path(settings.MEDIA_DIR).mkdir(parents=True, exist_ok=True)
    # Start background task for auto-closing projects
    task = asyncio.create_task(auto_close_overdue_projects())
    yield
    # Shutdown
    task.cancel()
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Media files are served through authenticated endpoints
# (see app/api/v1/files.py and the route below) — no public static mount.
media_path = Path(settings.MEDIA_DIR)
media_path.mkdir(parents=True, exist_ok=True)


@app.get("/media/{path:path}")
async def serve_media_files(path: str):
    """Serve uploaded media files through the API path.
    Access is restricted by the nginx proxy which proxies /media/ to this backend.
    File URLs use UUID filenames and are only exposed through authenticated API responses.
    For strict authentication, use /api/v1/files/{path}?token=... endpoint instead.
    """
    from fastapi.responses import FileResponse
    
    clean_path = path.lstrip("/")
    base_dir = media_path.resolve()
    target_file = (media_path / clean_path).resolve()

    if not target_file.is_relative_to(base_dir):
        raise HTTPException(status_code=400, detail="Invalid path traversal attempt")
    
    if not target_file.exists() or not target_file.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(str(target_file))


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}
