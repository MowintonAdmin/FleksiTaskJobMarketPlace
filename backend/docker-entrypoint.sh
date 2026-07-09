#!/bin/sh

mkdir -p /app/media

echo ">>> Running Alembic migrations..."

if alembic upgrade head; then
    echo ">>> Migrations applied."
else
    echo "ERROR: Alembic migrations failed. Check logs above. Aborting startup."
    exit 1
fi

echo ">>> Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
