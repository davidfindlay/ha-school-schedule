#!/bin/bash
# View Home Assistant logs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if command -v docker-compose &> /dev/null; then
    docker-compose logs -f
else
    docker compose logs -f
fi
