#!/bin/sh
set -e

# Ensure media directory exists and is writable.
mkdir -p /app/media

# Run database migrations before starting the server.
# This ensures the schema is up to date even after a fresh deploy
# with new model columns, so the backend never crashes on startup.
echo ">>> Running Alembic migrations..."
alembic upgrade head
echo ">>> Migrations complete."

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
