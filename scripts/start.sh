#!/usr/bin/env bash
# Build (if needed) and run the FinAlly Docker container.
# Requires: bash, docker. Tested on macOS and Linux.
# Usage: scripts/start.sh [--build]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="finally"
CONTAINER_NAME="finally"
PORT="8001"

cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "No .env file found at $ROOT_DIR/.env" >&2
  echo "Copy .env.example to .env and fill in your API key first:" >&2
  echo "  cp .env.example .env" >&2
  exit 1
fi

mkdir -p db

FORCE_BUILD=false
if [[ "${1:-}" == "--build" ]]; then
  FORCE_BUILD=true
fi

if [[ "$FORCE_BUILD" == true ]] || ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  echo "Building Docker image '$IMAGE_NAME'..."
  docker build -t "$IMAGE_NAME" "$ROOT_DIR"
fi

# Idempotent: if the container is already running, do nothing.
if docker ps --filter "name=^/${CONTAINER_NAME}$" --filter "status=running" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "FinAlly is already running at http://localhost:${PORT}"
  exit 0
fi

# Remove a stopped container with the same name so we can start fresh
# (picks up a rebuilt image or updated .env).
if docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker rm "$CONTAINER_NAME" >/dev/null
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  -v "$ROOT_DIR/db:/app/db" \
  -p "${PORT}:8000" \
  --env-file "$ROOT_DIR/.env" \
  "$IMAGE_NAME"

echo "FinAlly is starting at http://localhost:${PORT}"

if command -v open >/dev/null 2>&1; then
  open "http://localhost:${PORT}" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:${PORT}" || true
fi
