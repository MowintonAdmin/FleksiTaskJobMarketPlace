import logging
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_redis_available = False
_redis_client = None


async def get_redis():
    """Get Redis client - returns None if Redis is unavailable."""
    global _redis_client, _redis_available
    if _redis_available:
        return _redis_client
    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await _redis_client.ping()
        _redis_available = True
        logger.info("Redis connected successfully")
        return _redis_client
    except Exception as e:
        logger.warning("Redis unavailable (%s) — running without Redis cache/blacklist", e)
        _redis_available = False
        _redis_client = None
        return None


async def close_redis():
    global _redis_client, _redis_available
    if _redis_client:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
        _redis_client = None
        _redis_available = False


async def set_session(key: str, value: str, ttl: int | None = None) -> None:
    client = await get_redis()
    if client is None:
        return  # silently skip when Redis is unavailable
    ttl = ttl or settings.REDIS_SESSION_TTL
    await client.setex(key, ttl, value)


async def get_session(key: str) -> str | None:
    client = await get_redis()
    if client is None:
        return None
    return await client.get(key)


async def delete_session(key: str) -> None:
    client = await get_redis()
    if client is None:
        return
    await client.delete(key)


async def invalidate_token(token: str, ttl: int) -> None:
    client = await get_redis()
    if client is None:
        return  # silently skip when Redis is unavailable
    await client.setex(f"blacklist:{token}", ttl, "1")


async def is_token_blacklisted(token: str) -> bool:
    client = await get_redis()
    if client is None:
        return False  # not blacklisted if Redis is unavailable
    return await client.exists(f"blacklist:{token}") == 1