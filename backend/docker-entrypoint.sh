#!/bin/sh

mkdir -p /app/media

echo ">>> Running Alembic migrations..."

if alembic upgrade head; then
    echo ">>> Migrations applied."
else
    echo ">>> Initial migration failed - stamping to 0002 and re-applying..."
    alembic stamp 0002 || true
    alembic upgrade head || echo "WARNING: Migration failed after stamp. Continuing anyway."
fi

echo ">>> Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
