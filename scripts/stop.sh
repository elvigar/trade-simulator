#!/usr/bin/env bash
# Stop and remove the FinAlly Docker container. Does not touch db/ data.
# Requires: bash, docker. Tested on macOS and Linux.
# Usage: scripts/stop.sh
set -euo pipefail

CONTAINER_NAME="finally"

if docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null
  echo "FinAlly stopped."
else
  echo "FinAlly is not running."
fi
