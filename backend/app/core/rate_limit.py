"""Simple Redis-based rate limiter for auth endpoints.
Uses existing Redis connection — no additional packages required."""

from app.core.redis_client import set_session, get_session, delete_session

MAX_LOGIN_ATTEMPTS = 5
BLOCK_DURATION_SECONDS = 900  # 15 minutes
ATTEMPT_WINDOW_SECONDS = 300  # 5 minutes


async def check_login_rate_limit(ip: str, email: str) -> tuple[bool, str | None]:
    """Check if this IP+email combination is rate limited.
    Returns (is_allowed, error_message_if_blocked).
    
    Tracks failed attempts per email+IP combo to prevent brute force.
    After MAX_LOGIN_ATTEMPTS failures, blocks for BLOCK_DURATION_SECONDS.
    """
    key = f"rate_limit:login:{ip}:{email.lower().strip()}"
    block_key = f"rate_limit:blocked:{ip}:{email.lower().strip()}"
    
    # Check if currently blocked
    blocked = await get_session(block_key)
    if blocked:
        return False, "Too many login attempts. Please try again in 15 minutes."
    
    return True, None


async def record_failed_login(ip: str, email: str):
    """Record a failed login attempt and block if exceeded."""
    key = f"rate_limit:login:{ip}:{email.lower().strip()}"
    block_key = f"rate_limit:blocked:{ip}:{email.lower().strip()}"
    
    attempts = await get_session(key) or "0"
    count = int(attempts) + 1
    
    await set_session(key, str(count), ttl=ATTEMPT_WINDOW_SECONDS)
    
    if count >= MAX_LOGIN_ATTEMPTS:
        # Block for 15 minutes
        await set_session(block_key, "1", ttl=BLOCK_DURATION_SECONDS)
        # Clean up the attempt counter
        await delete_session(key)


async def clear_login_rate_limit(ip: str, email: str):
    """Clear rate limit on successful login."""
    key = f"rate_limit:login:{ip}:{email.lower().strip()}"
    block_key = f"rate_limit:blocked:{ip}:{email.lower().strip()}"
    await delete_session(key)
    await delete_session(block_key)