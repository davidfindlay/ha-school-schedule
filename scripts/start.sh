#!/bin/bash
# Start the Home Assistant test environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Starting Home Assistant test environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Start the container (works with both docker-compose v1 and docker compose v2)
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

echo ""
echo "Home Assistant is starting..."
echo ""
echo "Wait about 30-60 seconds for initial startup, then access:"
echo ""
echo "  URL:  http://localhost:8123"
echo ""
echo "On first run, you'll need to create an account."
echo ""
echo "To add the School Schedule integration:"
echo "  1. Go to Settings > Devices & Services"
echo "  2. Click 'Add Integration'"
echo "  3. Search for 'School Schedule'"
echo "  4. Configure the switchover time (default: 12:00)"
echo ""
echo "View logs with: ./scripts/logs.sh"
echo "Stop with: ./scripts/stop.sh"
echo ""
