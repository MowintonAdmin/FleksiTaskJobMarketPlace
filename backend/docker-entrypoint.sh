#!/bin/sh

mkdir -p /app/media

echo ">>> Running Alembic migrations..."

# First attempt — works on a freshly initialised DB with no tables.
if alembic upgrade head; then
    echo ">>> Migrations applied."
else
    # Tables likely already exist (created by SQLAlchemy create_all) but the
    # alembic_version table is absent, so alembic tries to re-create them and
    # gets a DuplicateTableError.  Stamp the DB at 0002 (the last baseline
    # revision) so alembic knows what is already in place, then apply only
    # the remaining migrations (e.g. 0003 adds the new profile columns).
    echo ">>> Initial migration failed — stamping to 0002 and re-applying..."
    alembic stamp 0002 || true
    alembic upgrade head || echo "WARNING: Migration still failed after stamp. Continuing anyway."
fi

echo ">>> Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
