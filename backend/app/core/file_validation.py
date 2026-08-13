import os
from fastapi import HTTPException, status

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def validate_image_magic_bytes(content: bytes, filename: str | None = None) -> str:
    """Validate that file content has valid binary magic bytes for JPEG, PNG, or WEBP.
    Also validates that filename extension is allowed if provided.
    Returns detected primary extension ('.jpg', '.png', '.webp').
    Raises HTTPException(422) if validation fails.
    """
    if not content or len(content) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File content is empty or incomplete",
        )

    ext = None
    # 1. JPEG: Starts with FF D8 FF
    if content.startswith(b"\xff\xd8\xff"):
        ext = ".jpg"
    # 2. PNG: Starts with \x89PNG
    elif content.startswith(b"\x89PNG"):
        ext = ".png"
    # 3. WEBP: Starts with RIFF at offset 0 and WEBP in bytes 8..16
    elif content.startswith(b"RIFF") and b"WEBP" in content[8:16]:
        ext = ".webp"
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid image format: Binary header signature does not match valid JPEG, PNG, or WEBP",
        )

    if filename:
        fn_ext = os.path.splitext(filename)[1].lower()
        if fn_ext and fn_ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid file extension '{fn_ext}'. Allowed: jpg, jpeg, png, webp",
            )

    return ext
