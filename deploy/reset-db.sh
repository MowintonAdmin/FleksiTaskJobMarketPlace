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
#   ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD='Secret123!' bash deploy/reset-db.sh --yes
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
# Env vars are an alternative to --admin-email/--admin-password, so passwords
# with special characters don't have to survive shell quoting on the CLI.
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    --yes) SKIP_CONFIRM=true; shift ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-email=*) ADMIN_EMAIL="${1#*=}"; shift ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --admin-password=*) ADMIN_PASSWORD="${1#*=}"; shift ;;
    *) echo "Unknown option: $1 (see --help)"; exit 1 ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run this from the repo root on the VPS."
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "ERROR: can't talk to Docker (permission denied or daemon not running)."
  echo "  Try running with sudo, or add your user to the 'docker' group."
  exit 1
fi

# Read $ENV_FILE as plain KEY=VALUE data instead of `source`-ing it, so a
# malformed/wrapped/comment line can never be executed as a shell command
# (which is what caused the old "No such file or directory" crashes). Any
# line that isn't blank, a comment (# or //), or KEY=VALUE is just skipped
# with a warning instead of aborting the whole script.
declare -A ENV_VARS
LINE_NO=0
while IFS= read -r RAW_LINE || [ -n "$RAW_LINE" ]; do
  LINE_NO=$((LINE_NO + 1))
  LINE="${RAW_LINE%$'\r'}"                     # tolerate CRLF from Windows edits
  TRIMMED="${LINE#"${LINE%%[![:space:]]*}"}"   # strip leading whitespace
  [ -z "$TRIMMED" ] && continue
  case "$TRIMMED" in
    '#'*|'//'*) continue ;;                    # comment line, either style
  esac
  if [[ "$TRIMMED" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    KEY="${BASH_REMATCH[1]}"
    VALUE="${BASH_REMATCH[2]}"
    # strip a single layer of surrounding quotes, if present
    if [[ "$VALUE" == \"*\" && "$VALUE" == *\" ]] || [[ "$VALUE" == \'*\' && "$VALUE" == *\' ]]; then
      VALUE="${VALUE:1:-1}"
    fi
    if [ -n "${ENV_VARS[$KEY]+x}" ]; then
      echo "WARNING: $ENV_FILE line $LINE_NO redefines $KEY (previous value overridden)." >&2
    fi
    ENV_VARS["$KEY"]="$VALUE"
  else
    echo "WARNING: $ENV_FILE line $LINE_NO is not a comment or KEY=VALUE, skipping: $TRIMMED" >&2
  fi
done < "$ENV_FILE"

for KEY in "${!ENV_VARS[@]}"; do
  export "$KEY=${ENV_VARS[$KEY]}"
done

POSTGRES_DB="${POSTGRES_DB:-flekxitask}"
POSTGRES_USER="${POSTGRES_USER:-fleksi}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-8000}"

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD is not set (or blank) in $ENV_FILE."
  if [ -n "${ENV_VARS[POSTGRES_PASSWORD]+x}" ]; then
    echo "  The key exists but has no value — fill in the password after the '='."
  else
    echo "  No POSTGRES_PASSWORD key was found. Keys detected in $ENV_FILE (check for a typo,"
    echo "  case mismatch like 'postgres_password', or a stray space around '='):"
    printf '%s\n' "${!ENV_VARS[@]}" | sort | sed 's/^/    /'
  fi
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
echo ""
echo "  Target: POSTGRES_DB=$POSTGRES_DB  WEB_HOST=${WEB_HOST:-?}  API_HOST=${API_HOST:-?}"
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
