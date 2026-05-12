import logging
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create all tables (idempotent – skips existing tables/types)."""
    import app.models  # noqa: F401 – ensure all models are registered

    # Run the column-type migration in its own connection so that if it fails
    # (e.g. column is already VARCHAR, or table doesn't exist yet) the error
    # does NOT abort the create_all transaction that follows.
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text(
                "ALTER TABLE task_sessions "
                "ALTER COLUMN status TYPE VARCHAR(20) USING status::text"
            ))
            # Normalize legacy uppercase enum values (e.g. 'ACTIVE' → 'active')
            await conn.execute(sa.text(
                "UPDATE task_sessions SET status = LOWER(status) "
                "WHERE status != LOWER(status)"
            ))
        logger.info("init_db: status column migrated to VARCHAR(20) and values normalized")
    except Exception as e:
        logger.info("init_db: ALTER TABLE skipped (%s)", e)

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("init_db: create_all completed successfully")
    except Exception as e:
        logger.error("init_db: create_all FAILED: %s", e)
        raise


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
