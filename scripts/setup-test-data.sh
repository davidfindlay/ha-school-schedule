#!/bin/bash
# Set up sample test data via HA services
# Run this after the integration is installed

set -e

HA_URL="${HA_URL:-http://localhost:8123}"
HA_TOKEN="${HA_TOKEN:-}"

if [ -z "$HA_TOKEN" ]; then
    echo "Please set HA_TOKEN environment variable with a long-lived access token"
    echo ""
    echo "To create a token:"
    echo "  1. Go to your profile in Home Assistant (bottom left)"
    echo "  2. Scroll to 'Long-Lived Access Tokens'"
    echo "  3. Create a new token"
    echo ""
    echo "Then run:"
    echo "  export HA_TOKEN='your_token_here'"
    echo "  ./scripts/setup-test-data.sh"
    exit 1
fi

call_service() {
    local service=$1
    local data=$2

    curl -s -X POST \
        -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$HA_URL/api/services/school_schedule/$service"

    echo " - Called school_schedule.$service"
    sleep 0.5
}

echo "Setting up test data..."
echo ""

# Add children
echo "Adding children..."
call_service "add_child" '{"name": "Emma"}'
call_service "add_child" '{"name": "Jack"}'
call_service "add_child" '{"name": "Sophie"}'

# Add items for Emma
echo ""
echo "Adding items for Emma..."
call_service "add_item" '{"child_name": "Emma", "item_id": "formal", "item_name": "Formal Uniform", "image": "/local/test-images/formal.svg"}'
call_service "add_item" '{"child_name": "Emma", "item_id": "sports", "item_name": "Sports Uniform", "image": "/local/test-images/sports.svg"}'
call_service "add_item" '{"child_name": "Emma", "item_id": "library", "item_name": "Library Bag", "image": "/local/test-images/library-bag.svg"}'
call_service "add_item" '{"child_name": "Emma", "item_id": "reader", "item_name": "Reader Bag", "image": "/local/test-images/reader-bag.svg"}'
call_service "add_item" '{"child_name": "Emma", "item_id": "violin", "item_name": "Violin", "image": "/local/test-images/violin.svg"}'
call_service "add_item" '{"child_name": "Emma", "item_id": "hat", "item_name": "School Hat", "image": "/local/test-images/hat.svg"}'

# Add items for Jack
echo ""
echo "Adding items for Jack..."
call_service "add_item" '{"child_name": "Jack", "item_id": "formal", "item_name": "Formal Uniform", "image": "/local/test-images/formal.svg"}'
call_service "add_item" '{"child_name": "Jack", "item_id": "sports", "item_name": "Sports Uniform", "image": "/local/test-images/sports.svg"}'
call_service "add_item" '{"child_name": "Jack", "item_id": "library", "item_name": "Library Bag", "image": "/local/test-images/library-bag.svg"}'
call_service "add_item" '{"child_name": "Jack", "item_id": "swim", "item_name": "Swimming Bag", "image": "/local/test-images/swim-bag.svg"}'
call_service "add_item" '{"child_name": "Jack", "item_id": "hat", "item_name": "School Hat", "image": "/local/test-images/hat.svg"}'

# Add items for Sophie
echo ""
echo "Adding items for Sophie..."
call_service "add_item" '{"child_name": "Sophie", "item_id": "formal", "item_name": "Formal Uniform", "image": "/local/test-images/formal.svg"}'
call_service "add_item" '{"child_name": "Sophie", "item_id": "sports", "item_name": "Sports Uniform", "image": "/local/test-images/sports.svg"}'
call_service "add_item" '{"child_name": "Sophie", "item_id": "reader", "item_name": "Reader Bag", "image": "/local/test-images/reader-bag.svg"}'
call_service "add_item" '{"child_name": "Sophie", "item_id": "piano", "item_name": "Piano Book", "image": "/local/test-images/piano-book.svg"}'
call_service "add_item" '{"child_name": "Sophie", "item_id": "hat", "item_name": "School Hat", "image": "/local/test-images/hat.svg"}'

# Set weekly schedules
echo ""
echo "Setting weekly schedules for Emma..."
call_service "set_weekly_schedule" '{"child_name": "Emma", "day": "monday", "item_ids": ["formal", "library", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Emma", "day": "tuesday", "item_ids": ["formal", "reader", "violin", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Emma", "day": "wednesday", "item_ids": ["sports", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Emma", "day": "thursday", "item_ids": ["formal", "reader", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Emma", "day": "friday", "item_ids": ["sports", "library", "hat"]}'

echo ""
echo "Setting weekly schedules for Jack..."
call_service "set_weekly_schedule" '{"child_name": "Jack", "day": "monday", "item_ids": ["formal", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Jack", "day": "tuesday", "item_ids": ["sports", "swim", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Jack", "day": "wednesday", "item_ids": ["formal", "library", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Jack", "day": "thursday", "item_ids": ["formal", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Jack", "day": "friday", "item_ids": ["sports", "hat"]}'

echo ""
echo "Setting weekly schedules for Sophie..."
call_service "set_weekly_schedule" '{"child_name": "Sophie", "day": "monday", "item_ids": ["formal", "reader", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Sophie", "day": "tuesday", "item_ids": ["formal", "piano", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Sophie", "day": "wednesday", "item_ids": ["sports", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Sophie", "day": "thursday", "item_ids": ["formal", "reader", "hat"]}'
call_service "set_weekly_schedule" '{"child_name": "Sophie", "day": "friday", "item_ids": ["sports", "hat"]}'

echo ""
echo "Test data setup complete!"
echo ""
echo "Visit http://localhost:8123 to see the schedule card."
