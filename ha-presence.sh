#!/bin/bash
# Home Assistant Device Tracker Integration
# More reliable than ARP scanning - uses HA's device tracker

HA_URL="${HOME_ASSISTANT_URL:-http://localhost:8123}"
HA_TOKEN="$HOME_ASSISTANT_TOKEN"

# Get device tracker states from HA
get_ha_device_tracker() {
    curl -s -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        "$HA_URL/api/states" 2>/dev/null | \
        grep '"entity_id":"device_tracker\.' | head -10
}

# Check if person is home using HA person entity
check_person_home() {
    local person_name="$1"
    
    local state=$(curl -s -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        "$HA_URL/api/states/person.$person_name" 2>/dev/null | \
        grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ "$state" = "home" ]; then
        return 0  # Home
    else
        return 1  # Not home
    fi
}

# List all people and their presence
list_presence() {
    echo "=== People at Home ==="
    
    # Get all person entities
    local persons=$(curl -s -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        "$HA_URL/api/states" 2>/dev/null | \
        grep '"entity_id":"person\.' | grep '"state":"home"' | \
        grep -o '"friendly_name":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$persons" ]; then
        echo "$persons"
    else
        echo "No one detected at home"
    fi
}

# Example usage
list_presence
