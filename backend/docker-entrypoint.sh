#!/bin/sh

mkdir -p /app/media

# Run Alembic migrations with retry (DB may take a moment to accept connections).
echo ">>> Running Alembic migrations..."
MIGRATED=0
for attempt in 1 2 3 4 5; do
    if alembic upgrade head; then
        echo ">>> Migrations applied."
        MIGRATED=1
        break
    fi
    echo "    Attempt $attempt/5 failed — retrying in 3s..."
    sleep 3
done

if [ "$MIGRATED" = "0" ]; then
    echo "WARNING: All migration attempts failed. Starting anyway — schema may already be current."
fi

echo ">>> Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
