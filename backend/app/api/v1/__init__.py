from fastapi import APIRouter
from app.api.v1 import auth, users, tasks, applications, task_sessions, admin, messages, wallet, files
from app.ws.router import router as ws_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(users.router)
router.include_router(tasks.router)
router.include_router(applications.router)
router.include_router(task_sessions.router)
router.include_router(admin.router)
router.include_router(messages.router)
router.include_router(wallet.router)
router.include_router(files.router)
router.include_router(ws_router)