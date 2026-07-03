#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v docker >/dev/null 2>&1; then
  DOCKER_BIN="docker"
elif [ -x "/Applications/Docker.app/Contents/Resources/bin/docker" ]; then
  DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
else
  echo "Error: Docker is not installed or not in PATH."
  echo "Install Docker Desktop, start it, then run this script again."
  exit 1
fi

if "$DOCKER_BIN" compose version >/dev/null 2>&1; then
  COMPOSE_CMD=("$DOCKER_BIN" compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Error: Docker Compose is not available."
  echo "Install Docker Compose plugin (preferred) or docker-compose binary."
  exit 1
fi

if [ ! -f backend/.env ]; then
  if [ -f backend/.env.example ]; then
    cp backend/.env.example backend/.env
    echo "Created backend/.env from backend/.env.example"
    echo "Please review backend/.env before production use."
  else
    echo "Error: backend/.env.example not found."
    exit 1
  fi
fi

if [ ! -f backend/firebase-credentials.json ]; then
  echo "Warning: backend/firebase-credentials.json is missing."
  echo "Push notification features may not work until this file is added."
fi

echo "Building and starting containers..."
"${COMPOSE_CMD[@]}" up --build -d

echo ""
echo "Services are starting. Useful checks:"
echo "  ${COMPOSE_CMD[*]} ps"
echo "  ${COMPOSE_CMD[*]} logs -f backend"
echo ""
echo "Expected local URLs:"
echo "  Web:   http://localhost:3000"
echo "  Admin: http://localhost:3001"
echo "  API:   http://localhost:8000"
echo "  Docs:  http://localhost:8000/docs"
