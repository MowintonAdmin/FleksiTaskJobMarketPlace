import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

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

    async with engine.begin() as conn:
        # For existing deployments: convert status from PostgreSQL enum to varchar
        # so new values (e.g. 'paused') don't require DDL enum migrations.
        try:
            await conn.execute(sa.text(
                "ALTER TABLE task_sessions "
                "ALTER COLUMN status TYPE VARCHAR(20) USING status::text"
            ))
        except Exception:
            pass  # already varchar, or table doesn't exist yet

        await conn.run_sync(Base.metadata.create_all)


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
