#!/bin/bash
# ============================================================
# FleksiTask — Hetzner VPS deploy / rebuild script
# Usage:
#   First deploy:  bash deploy/deploy.sh --first-run
#   Rebuild:       bash deploy/deploy.sh
# ============================================================
set -euo pipefail

COMPOSE="docker compose --env-file deploy/.env.prod -f docker-compose.yml -f deploy/docker-compose.prod.yml"
FIRST_RUN=false

for arg in "$@"; do
  case $arg in
    --first-run) FIRST_RUN=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# ── 0. Confirm env files exist ───────────────────────────────────────────
if [ ! -f deploy/.env.prod ]; then
  echo "ERROR: deploy/.env.prod not found."
  echo "  cp deploy/.env.prod.example deploy/.env.prod  then edit it."
  exit 1
fi

if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env not found."
  echo "  cp backend/.env.example backend/.env  then edit it."
  exit 1
fi

if [ ! -f backend/firebase-credentials.json ]; then
  echo "WARNING: backend/firebase-credentials.json not found."
  echo "  Push notifications will be disabled until you add it."
fi

# ── 1. Pull latest code (skip if running locally) ───────────────────────
if git rev-parse --is-inside-work-tree &>/dev/null; then
  echo ">>> Pulling latest code..."
  git pull
fi

# ── 2. Build and (re)start all containers ───────────────────────────────
echo ">>> Building and starting containers..."
$COMPOSE up -d --build

# ── 3. Database migrations ───────────────────────────────────────────────
# Migrations now run automatically inside the backend container via
# docker-entrypoint.sh (alembic upgrade head before uvicorn starts).
# Wait for the backend to become healthy (which implies migrations passed).

# ── 4. Health check ─────────────────────────────────────────────────────
echo ">>> Waiting for backend to be healthy..."
for i in $(seq 1 15); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${BACKEND_HOST_PORT:-8000}/health || true)
  if [ "$STATUS" = "200" ]; then
    echo "    Backend is healthy (HTTP 200)."
    break
  fi
  echo "    Attempt $i/15 — got HTTP $STATUS, retrying in 2s..."
  sleep 2
done

if [ "$STATUS" != "200" ]; then
  echo "WARNING: Backend did not respond with 200 after 30s. Check logs:"
  echo "  $COMPOSE logs --tail=50 backend"
fi

# ── 5. First-run: configure Caddy ───────────────────────────────────────
if [ "$FIRST_RUN" = true ]; then
  echo ">>> First-run: writing Caddyfile..."

  # Load deploy/.env.prod so we can interpolate host vars
  set -a; source deploy/.env.prod; set +a

  WEB_HOST=${WEB_HOST:-localhost}
  ADMIN_HOST=${ADMIN_HOST:-localhost}
  API_HOST=${API_HOST:-localhost}
  WEB_HOST_PORT=${WEB_HOST_PORT:-3000}
  ADMIN_HOST_PORT=${ADMIN_HOST_PORT:-3001}
  BACKEND_HOST_PORT=${BACKEND_HOST_PORT:-8000}

  sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
${WEB_HOST} {
    reverse_proxy localhost:${WEB_HOST_PORT}
}

${ADMIN_HOST} {
    reverse_proxy localhost:${ADMIN_HOST_PORT}
}

${API_HOST} {
    reverse_proxy localhost:${BACKEND_HOST_PORT}
}
EOF

  echo "    Caddyfile written to /etc/caddy/Caddyfile"
  sudo systemctl reload caddy && echo "    Caddy reloaded." || echo "    WARNING: Could not reload Caddy. Run: sudo systemctl reload caddy"
fi

# ── 6. Prune old images ──────────────────────────────────────────────────
echo ">>> Pruning dangling images..."
docker image prune -f

# ── 7. Done ──────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  Deploy complete!"
echo ""
echo "  Web:    http://localhost:${WEB_HOST_PORT:-3000}"
echo "  Admin:  http://localhost:${ADMIN_HOST_PORT:-3001}"
echo "  API:    http://localhost:${BACKEND_HOST_PORT:-8000}/docs"
echo ""
echo "  Logs:   $COMPOSE logs -f"
echo "======================================================"
