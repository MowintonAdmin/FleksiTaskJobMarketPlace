import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.config import get_settings

router = APIRouter(prefix="/files", tags=["Files"])


@router.get("/{path:path}")
async def serve_file(path: str):
    """Serve uploaded media files through the API path (avoids nginx /media/ proxy issues)."""
    settings = get_settings()
    # Strip any leading slashes and prevent path traversal
    path = path.lstrip("/")
    if ".." in path:
        raise HTTPException(status_code=400, detail="Invalid path")
    file_path = os.path.join(settings.MEDIA_DIR, path)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
