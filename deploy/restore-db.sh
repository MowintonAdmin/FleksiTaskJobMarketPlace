#!/bin/bash
# ============================================================
# FlekxiTask — Restore the production database from a backup
# dump created by deploy/reset-db.sh (or a manual `pg_dump -F c`).
#
# Usage (run from the repo root on the VPS):
#   bash deploy/restore-db.sh deploy/backups/flekxitask_20260731_120000.dump
#   bash deploy/restore-db.sh <dump-file> --yes    # skip interactive confirmation
#
# A safety backup of the CURRENT database is taken automatically
# before anything is overwritten.
# ============================================================
set -euo pipefail

ENV_FILE="deploy/.env.prod"
BACKUP_DIR="deploy/backups"
POSTGRES_CONTAINER="flekxitask-postgres"
BACKEND_CONTAINER="flekxitask-backend"

SKIP_CONFIRM=false
DUMP_FILE=""

for arg in "$@"; do
  case "$arg" in
    --yes) SKIP_CONFIRM=true ;;
    *) DUMP_FILE="$arg" ;;
  esac
done

if [ -z "$DUMP_FILE" ]; then
  echo "Usage: bash deploy/restore-db.sh <path-to-dump-file> [--yes]"
  echo ""
  echo "Available backups in $BACKUP_DIR:"
  ls -lh "$BACKUP_DIR" 2>/dev/null || echo "  (none found)"
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: dump file not found: $DUMP_FILE"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run this from the repo root on the VPS."
  exit 1
fi

set -a; source "$ENV_FILE"; set +a
POSTGRES_DB="${POSTGRES_DB:-flekxitask}"
POSTGRES_USER="${POSTGRES_USER:-fleksi}"
BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-8000}"

for c in "$POSTGRES_CONTAINER" "$BACKEND_CONTAINER"; do
  if ! docker ps --format '{{.Names}}' | grep -qx "$c"; then
    echo "ERROR: container '$c' is not running. Is the stack up? (docker compose ps)"
    exit 1
  fi
done

echo "============================================================"
echo "  DANGER: this will PERMANENTLY REPLACE ALL DATA in the"
echo "  '$POSTGRES_DB' database on this server with the contents"
echo "  of: $DUMP_FILE"
echo "============================================================"

if [ "$SKIP_CONFIRM" = false ]; then
  read -rp "Type the database name ('$POSTGRES_DB') to confirm: " CONFIRM
  if [ "$CONFIRM" != "$POSTGRES_DB" ]; then
    echo "Confirmation did not match. Aborting, nothing was touched."
    exit 1
  fi
fi

# ── 1. Safety backup of current state before overwriting ────────────────
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
PRE_RESTORE_BACKUP="$BACKUP_DIR/${POSTGRES_DB}_pre-restore_${STAMP}.dump"

echo ">>> Backing up current '$POSTGRES_DB' (safety net) to $PRE_RESTORE_BACKUP ..."
if docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "/tmp/pre-restore_${STAMP}.dump"; then
  docker cp "$POSTGRES_CONTAINER:/tmp/pre-restore_${STAMP}.dump" "$PRE_RESTORE_BACKUP"
  docker exec "$POSTGRES_CONTAINER" rm -f "/tmp/pre-restore_${STAMP}.dump"
  echo "    Safety backup OK ($(du -h "$PRE_RESTORE_BACKUP" | cut -f1))."
else
  echo "WARNING: could not take a safety backup of the current DB. Continuing anyway."
fi

# ── 2. Copy the dump file into the postgres container ────────────────────
DUMP_BASENAME=$(basename "$DUMP_FILE")
echo ">>> Copying $DUMP_FILE into $POSTGRES_CONTAINER ..."
docker cp "$DUMP_FILE" "$POSTGRES_CONTAINER:/tmp/$DUMP_BASENAME"

# ── 3. Wipe schema, then restore ──────────────────────────────────────────
echo ">>> Dropping and recreating schema 'public' ..."
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $POSTGRES_USER;"

echo ">>> Restoring from $DUMP_BASENAME ..."
set +e
docker exec "$POSTGRES_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --role="$POSTGRES_USER" "/tmp/$DUMP_BASENAME"
RESTORE_EXIT=$?
set -e
docker exec "$POSTGRES_CONTAINER" rm -f "/tmp/$DUMP_BASENAME"

if [ $RESTORE_EXIT -ne 0 ]; then
  echo "WARNING: pg_restore exited with code $RESTORE_EXIT."
  echo "    This can be harmless (e.g. ownership/role warnings) but verify the data below looks correct."
fi

# ── 4. Re-run migrations in case the dump predates the current schema ────
echo ">>> Restarting backend to apply any pending Alembic migrations ..."
docker restart "$BACKEND_CONTAINER" > /dev/null

echo ">>> Waiting for backend to be healthy..."
STATUS=""
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${BACKEND_HOST_PORT}/health" || true)
  if [ "$STATUS" = "200" ]; then
    echo "    Backend is healthy (HTTP 200)."
    break
  fi
  echo "    Attempt $i/30 — got HTTP $STATUS, retrying in 2s..."
  sleep 2
done

if [ "$STATUS" != "200" ]; then
  echo "WARNING: backend did not respond with 200 after 60s. Check logs:"
  echo "  docker logs --tail=50 $BACKEND_CONTAINER"
fi

echo ""
echo "============================================================"
echo "  DB restore complete from: $DUMP_FILE"
echo "  Pre-restore safety backup: $PRE_RESTORE_BACKUP"
echo "============================================================"
