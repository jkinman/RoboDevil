#!/bin/bash
# Skill: Home Assistant Lights - Full Implementation
# Control lights via Home Assistant API

skill_name="lights"
skill_patterns=("light" "lights" "lamp" "turn on" "turn off" "dim" "bright" "dark" "brightness" "color" "set" "percent" "%")
skill_description="Control home lights via Home Assistant"

# Home Assistant config
HA_URL="${HOME_ASSISTANT_URL:-http://localhost:8123}"
HA_TOKEN="$HOME_ASSISTANT_TOKEN"

# Helper: Get all lights
get_lights() {
    curl -s -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        "$HA_URL/api/states" 2>/dev/null | \
        grep -o '"entity_id":"light\.[^"]*"' | cut -d'"' -f4
}

# Helper: Get light friendly name
get_light_name() {
    local entity_id="$1"
    curl -s -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        "$HA_URL/api/states/$entity_id" 2>/dev/null | \
        grep -o '"friendly_name":"[^"]*"' | head -1 | cut -d'"' -f4
}

# Helper: Turn light on/off
control_light() {
    local entity_id="$1"
    local action="$2"  # turn_on or turn_off
    
    local result=$(curl -s -X POST \
        -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"entity_id\": \"$entity_id\"}" \
        "$HA_URL/api/services/light/$action" 2>/dev/null)
    
    [ -n "$result" ]
}

# Helper: Set color
set_color() {
    local entity_id="$1"
    local color_name="$2"
    
    # Convert color name to RGB
    local rgb=""
    case "$color_name" in
        red) rgb="[255, 0, 0]" ;;
        green) rgb="[0, 255, 0]" ;;
        blue) rgb="[0, 0, 255]" ;;
        yellow) rgb="[255, 255, 0]" ;;
        orange) rgb="[255, 165, 0]" ;;
        purple) rgb="[128, 0, 128]" ;;
        pink) rgb="[255, 192, 203]" ;;
        white) rgb="[255, 255, 255]" ;;
        warm|warm_white) rgb="[255, 200, 100]" ;;
        cool|cool_white) rgb="[200, 220, 255]" ;;
        *) return 1 ;;
    esac
    
    curl -s -X POST \
        -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"entity_id\": \"$entity_id\", \"rgb_color\": $rgb}" \
        "$HA_URL/api/services/light/turn_on" 2>/dev/null
}

# Helper: Set brightness percentage
set_brightness_percent() {
    local entity_id="$1"
    local percent="$2"
    
    # Convert percentage to 0-255 scale
    local brightness=$((percent * 255 / 100))
    
    curl -s -X POST \
        -H "Authorization: Bearer $HA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"entity_id\": \"$entity_id\", \"brightness\": $brightness}" \
        "$HA_URL/api/services/light/turn_on" 2>/dev/null
}

# Main skill execution
skill_execute() {
    local command="$1"
    local cmd_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')
    
    # Check if token is configured
    if [ -z "$HA_TOKEN" ]; then
        speak "Home Assistant is not configured. Please run setup-home-assistant.sh first."
        return 1
    fi
    
    # Get all lights
    local lights=$(get_lights)
    
    if [ -z "$lights" ]; then
        speak "No lights found in Home Assistant."
        return 1
    fi
    
    # Parse command
    local action=""
    local target=""
    local brightness=""
    local color=""
    
    # Check for brightness percentage (e.g., "50%", "50 percent", "100%")
    if echo "$cmd_lower" | grep -qE "[0-9]+(%| percent| percent brightness)"; then
        brightness=$(echo "$cmd_lower" | grep -oE "[0-9]+" | head -1)
        # Validate range
        if [ "$brightness" -gt 100 ]; then
            brightness=100
        fi
        action="brightness"
    fi
    
    # Check for color commands
    if echo "$cmd_lower" | grep -qE "(red|green|blue|yellow|orange|purple|pink|white|warm|cool)"; then
        color=$(echo "$cmd_lower" | grep -oE "(red|green|blue|yellow|orange|purple|pink|white|warm|cool)")
        action="color"
    fi
    
    # Determine action if not set by brightness/color
    if [ -z "$action" ]; then
        if echo "$cmd_lower" | grep -qE "(turn on|on|bright|light up)"; then
            action="turn_on"
        elif echo "$cmd_lower" | grep -qE "(turn off|off|dark)"; then
            action="turn_off"
        elif echo "$cmd_lower" | grep -qE "(dim|lower|decrease)"; then
            action="dim"
        else
            # Just list lights
            local count=$(echo "$lights" | wc -l)
            speak "I found $count lights in your home. You can say turn on, turn off, set brightness to 50%, or set color to blue."
            return 0
        fi
    fi
    
    # Determine target (room/area)
    if echo "$cmd_lower" | grep -q "living"; then
        target="living"
    elif echo "$cmd_lower" | grep -q "bedroom"; then
        target="bedroom"
        echo "  🔍 LIGHTS DEBUG: target=bedroom"
    elif echo "$cmd_lower" | grep -q "kitchen"; then
        target="kitchen"
    elif echo "$cmd_lower" | grep -q "hallway"; then
        target="hallway"
    elif echo "$cmd_lower" | grep -q "entrance"; then
        target="entrance"
    elif echo "$cmd_lower" | grep -q "spot"; then
        target="spot"
    elif echo "$cmd_lower" | grep -q "all"; then
        target="all"
    fi
    
    # Execute action
    if [ "$target" = "all" ]; then
        # Control all lights
        local success=0
        for light in $lights; do
            case "$action" in
                brightness)
                    if set_brightness_percent "$light" "$brightness"; then
                        ((success++))
                    fi
                    ;;
                color)
                    if set_color "$light" "$color"; then
                        ((success++))
                    fi
                    ;;
                *)
                    if control_light "$light" "$action"; then
                        ((success++))
                    fi
                    ;;
            esac
        done
        
        if [ $success -gt 0 ]; then
            # Natural response based on action
            case "$action" in
                turn_on)
                    speak "I've turned on $success lights."
                    ;;
                turn_off)
                    speak "I've turned off $success lights."
                    ;;
                dim)
                    speak "I've dimmed $success lights."
                    ;;
                brightness)
                    speak "I've set $success lights to $brightness% brightness."
                    ;;
                color)
                    speak "I've set $success lights to $color."
                    ;;
            esac
        else
            speak "Sorry, I couldn't control the lights."
        fi
        
    elif [ -n "$target" ]; then
        # Find matching light(s)
        local found=""
        local match_count=0
        
        for light in $lights; do
            # Check entity_id contains target
            if echo "$light" | grep -qi "$target"; then
                if [ -z "$found" ]; then
                    found="$light"
                else
                    found="$found $light"
                fi
                ((match_count++))
                continue
            fi
            
            # Check friendly name
            local fname=$(get_light_name "$light")
            if echo "$fname" | grep -qi "$target"; then
                if [ -z "$found" ]; then
                    found="$light"
                else
                    found="$found $light"
                fi
                ((match_count++))
            fi
        done
        
        if [ -n "$found" ]; then
            # Control all matching lights
            local success=0
            for light in $found; do
                case "$action" in
                    brightness)
                        if set_brightness_percent "$light" "$brightness"; then
                            ((success++))
                        fi
                        ;;
                    color)
                        if set_color "$light" "$color"; then
                            ((success++))
                        fi
                        ;;
                    *)
                        if control_light "$light" "$action"; then
                            ((success++))
                        fi
                        ;;
                esac
            done
            
            if [ $success -gt 0 ]; then
                # Convert action to English word
                local action_word=""
                case "$action" in
                    turn_on)
                        action_word="on"
                        ;;
                    turn_off)
                        action_word="off"
                        ;;
                    dim)
                        action_word="dimmed"
                        ;;
                    brightness)
                        speak "I've set $success $target lights to $brightness% brightness."
                        ;;
                    color)
                        speak "I've set $success $target lights to $color."
                        ;;
                esac
                
                if [ "$action" = "turn_on" ] || [ "$action" = "turn_off" ] || [ "$action" = "dim" ]; then
                    if [ $success -eq 1 ]; then
                        local name=$(get_light_name "$found")
                        speak "I've turned $action_word the $name."
                    else
                        speak "I've turned $action_word $success $target lights."
                    fi
                fi
            else
                speak "Sorry, I couldn't control the lights."
            fi
        else
            speak "I couldn't find any lights matching '$target'."
        fi
        
    else
        # No specific target - list available lights
        speak "Which light would you like me to control? I can manage lights in:"
        for light in $lights; do
            local name=$(get_light_name "$light")
            if [ -n "$name" ]; then
                speak "  $name"
            fi
        done
    fi
}
