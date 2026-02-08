#!/bin/bash
# Skill: Presence Detection (Home Assistant + MAC fallback)
# Detects when known people are home

skill_name="presence"
skill_patterns=("who is here" "who is home" "visitors" "guests" "presence" "anyone home")
skill_description="Detect who is present at home"

# Home Assistant config
HA_URL="${HOME_ASSISTANT_URL:-http://localhost:8123}"
HA_TOKEN="$HOME_ASSISTANT_TOKEN"

# Check if using Home Assistant device tracker
get_ha_presence() {
    if [ -z "$HA_TOKEN" ]; then
        return 1
    fi
    
    # Get all person entities that are 'home'
    local persons=$(curl -s -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        "$HA_URL/api/states" 2>/dev/null | \
        grep '"entity_id":"person\.' | grep '"state":"home"' | \
        grep -o '"friendly_name":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$persons" ]; then
        echo "$persons"
        return 0
    fi
    return 1
}

# Fallback: Check MAC addresses
get_mac_presence() {
    local present=""
    
    for i in 1 2 3 4 5; do
        local name_var="PRESENCE_DEVICE_${i}_NAME"
        local mac_var="PRESENCE_DEVICE_${i}_MAC"
        local name="${!name_var}"
        local mac="${!mac_var}"
        
        if [ -n "$name" ] && [ -n "$mac" ]; then
            if ip neigh show 2>/dev/null | grep -qi "$mac"; then
                present="$present, $name"
            fi
        fi
    done
    
    # Remove leading comma and space
    echo "$present" | sed 's/^, //'
}

skill_execute() {
    # Try Home Assistant first
    local ha_present=$(get_ha_presence)
    
    if [ -n "$ha_present" ]; then
        # Format HA response
        local count=$(echo "$ha_present" | wc -l)
        if [ $count -eq 1 ]; then
            speak "$ha_present is at home."
        else
            local names=$(echo "$ha_present" | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g' | sed 's/, \([^,]*\)$/ and \1/')
            speak "$names are at home."
        fi
        return 0
    fi
    
    # Fallback to MAC detection
    local mac_present=$(get_mac_presence)
    
    if [ -n "$mac_present" ]; then
        speak "I can see these devices on the network: $mac_present"
    else
        speak "I don't see anyone at home right now."
    fi
}

# Greeting function for presence monitor
do_greeting() {
    local name="$1"
    local greeting_var="PRESENCE_DEVICE_${name}_GREETING"
    local greeting="${!greeting_var}"
    
    if [ -z "$greeting" ]; then
        greeting="Welcome home, $name!"
    fi
    
    # Use TTS
    source ~/RoboDevil/.env 2>/dev/null
    local tts_file="/tmp/presence-greeting.mp3"
    
    curl -s -X POST "https://api.inworld.ai/tts/v1/voice" \
        -H "Authorization: Basic $INWORLD_BASIC" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$greeting\", \"voice_id\": \"Hades\", \"model_id\": \"inworld-tts-1.5-max\", \"audio_config\": {\"audio_encoding\": \"MP3\", \"speaking_rate\": 1.0}}" 2>/dev/null | \
        grep -o '"audioContent":"[^"]*"' | cut -d'"' -f4 | base64 -d > "$tts_file" 2>/dev/null
    
    [ -s "$tts_file" ] && pw-play "$tts_file" 2>/dev/null
}
