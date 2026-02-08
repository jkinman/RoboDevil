#!/bin/bash
# Presence Monitor
# Background script to detect when devices join/leave network
# Triggers voice greetings when known devices arrive

source ~/RoboDevil/.env 2>/dev/null

STATE_FILE="/tmp/presence-state"
TTS_OUTPUT="/tmp/presence-greeting.mp3"

# Function to speak
do_greeting() {
    local text="$1"
    echo "🔊 $text"
    curl -s -X POST "https://api.inworld.ai/tts/v1/voice" \
        -H "Authorization: Basic $INWORLD_BASIC" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$text\", \"voice_id\": \"Hades\", \"model_id\": \"inworld-tts-1.5-max\", \"audio_config\": {\"audio_encoding\": \"MP3\", \"speaking_rate\": 1.0}}" 2>/dev/null | \
        grep -o '"audioContent":"[^"]*"' | cut -d'"' -f4 | base64 -d > "$TTS_OUTPUT" 2>/dev/null
    [ -s "$TTS_OUTPUT" ] && pw-play "$TTS_OUTPUT" 2>/dev/null
}

# Check if a device is present
check_device() {
    local mac="$1"
    # Check ARP table
    ip neigh show | grep -qi "$mac"
    return $?
}

# Monitor loop
while true; do
    # Check each configured device
    for i in 1 2 3 4 5; do
        local name_var="PRESENCE_DEVICE_${i}_NAME"
        local mac_var="PRESENCE_DEVICE_${i}_MAC"
        local greeting_var="PRESENCE_DEVICE_${i}_GREETING"
        local name="${!name_var}"
        local mac="${!mac_var}"
        local greeting="${!greeting_var}"
        
        if [ -n "$name" ] && [ -n "$mac" ]; then
            # Current state
            if check_device "$mac"; then
                current_state="present"
            else
                current_state="absent"
            fi
            
            # Previous state
            previous_state=$(cat "${STATE_FILE}_${i}" 2>/dev/null || echo "absent")
            
            # Detect arrival
            if [ "$current_state" = "present" ] && [ "$previous_state" = "absent" ]; then
                echo "$(date): $name arrived!"
                
                # Custom or default greeting
                if [ -n "$greeting" ]; then
                    do_greeting "$greeting"
                else
                    do_greeting "Welcome home, $name!"
                fi
            fi
            
            # Save current state
            echo "$current_state" > "${STATE_FILE}_${i}"
        fi
    done
    
    # Check every 30 seconds
    sleep 30
done
