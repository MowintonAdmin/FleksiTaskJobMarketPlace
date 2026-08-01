#!/bin/bash
# ============================================================
# FlekxiTask — Reset production database to a clean state
#
# Backs up the DB, wipes all data, lets the backend rebuild an
# empty schema from Alembic migrations (same as a brand-new
# system), and optionally creates a fresh admin account.
#
# Usage (run from the repo root on the VPS):
#   bash deploy/reset-db.sh
#   bash deploy/reset-db.sh --admin-email you@yourdomain.com --admin-password 'Secret123!'
#   bash deploy/reset-db.sh --yes    # skip the interactive confirmation
#
# The media_data volume (uploaded files) is NOT touched by this script.
# ============================================================
set -euo pipefail

# Run from the repo root regardless of the caller's cwd (script lives in deploy/).
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE="deploy/.env.prod"
BACKUP_DIR="deploy/backups"
POSTGRES_CONTAINER="flekxitask-postgres"
BACKEND_CONTAINER="flekxitask-backend"

SKIP_CONFIRM=false
ADMIN_EMAIL=""
ADMIN_PASSWORD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) SKIP_CONFIRM=true; shift ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run this from the repo root on the VPS."
  exit 1
fi

# Validate the env file is well-formed KEY=VALUE before sourcing it — a
# malformed line would otherwise be executed as a shell command and abort
# the script with a cryptic "command not found"/"No such file or directory".
BAD_LINES=$(grep -nvE '^[[:space:]]*(#.*)?$|^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" || true)
if [ -n "$BAD_LINES" ]; then
  echo "ERROR: $ENV_FILE has malformed line(s) (not '#comment', blank, or KEY=VALUE):"
  echo "$BAD_LINES"
  echo "Fix these lines (check for stray spaces instead of '=', hyphens in keys, or wrapped/split URLs) and re-run."
  exit 1
fi

DUP_KEYS=$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | sed 's/=$//' | sort | uniq -d)
if [ -n "$DUP_KEYS" ]; then
  echo "ERROR: $ENV_FILE defines the same key more than once (only the last value would be used):"
  echo "$DUP_KEYS"
  echo "Remove the duplicate line(s) and re-run."
  exit 1
fi

set -a; source "$ENV_FILE"; set +a
POSTGRES_DB="${POSTGRES_DB:-flekxitask}"
POSTGRES_USER="${POSTGRES_USER:-fleksi}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-8000}"

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD is not set in $ENV_FILE."
  echo "  Add it (same value used when the Postgres container/volume was created), then re-run."
  exit 1
fi

for c in "$POSTGRES_CONTAINER" "$BACKEND_CONTAINER"; do
  if ! docker ps --format '{{.Names}}' | grep -qx "$c"; then
    echo "ERROR: container '$c' is not running. Is the stack up? (docker compose ps)"
    exit 1
  fi
done

echo "============================================================"
echo "  DANGER: this will PERMANENTLY DELETE ALL DATA in the"
echo "  '$POSTGRES_DB' database on this server, then rebuild an"
echo "  empty schema from migrations."
echo "============================================================"

if [ "$SKIP_CONFIRM" = false ]; then
  read -rp "Type the database name ('$POSTGRES_DB') to confirm: " CONFIRM
  if [ "$CONFIRM" != "$POSTGRES_DB" ]; then
    echo "Confirmation did not match. Aborting, nothing was touched."
    exit 1
  fi
fi

# ── 1. Backup ────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${POSTGRES_DB}_${STAMP}.dump"

echo ">>> Backing up '$POSTGRES_DB' to $BACKUP_FILE ..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "/tmp/${POSTGRES_DB}_${STAMP}.dump"
docker cp "$POSTGRES_CONTAINER:/tmp/${POSTGRES_DB}_${STAMP}.dump" "$BACKUP_FILE"
docker exec "$POSTGRES_CONTAINER" rm -f "/tmp/${POSTGRES_DB}_${STAMP}.dump"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: backup file is missing or empty. Aborting — refusing to wipe without a verified backup."
  exit 1
fi
echo "    Backup OK ($(du -h "$BACKUP_FILE" | cut -f1))."

# ── 2. Wipe schema ───────────────────────────────────────────────────────
echo ">>> Dropping and recreating schema 'public' ..."
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $POSTGRES_USER;"

# ── 3. Rebuild schema via migrations ─────────────────────────────────────
echo ">>> Restarting backend to re-run Alembic migrations ..."
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

# ── 4. Optional: create a fresh admin account ────────────────────────────
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo ">>> Creating admin account for $ADMIN_EMAIL ..."
  docker exec "$BACKEND_CONTAINER" python -m app.scripts.create_admin --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"
else
  echo ">>> No --admin-email/--admin-password given, skipping admin creation."
  echo "    Run later with:"
  echo "    docker exec $BACKEND_CONTAINER python -m app.scripts.create_admin --email you@yourdomain.com --password 'Secret'"
fi

echo ""
echo "============================================================"
echo "  DB reset complete."
echo "  Backup saved at: $BACKUP_FILE"
echo "============================================================"
