#!/bin/sh
set -e

# Named Docker volumes are created as root. Fix /app/media ownership so
# appuser (the unprivileged runtime user) can write uploaded files.
mkdir -p /app/media
chown -R appuser:appuser /app/media

# Drop from root to appuser and start the server.
exec su -s /bin/sh appuser -c \
  'exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2'
