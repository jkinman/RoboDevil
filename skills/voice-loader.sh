#!/bin/bash
# Squidworth Voice Assistant - Plugin Architecture
# Dynamic skill loading system

source ~/RoboDevil/.env 2>/dev/null
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

# Configuration
ROBODEVIL_DIR="/home/jkinman/RoboDevil"
SKILLS_DIR="$ROBODEVIL_DIR/skills/voice"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-response.mp3"
WHISPER_URL="http://127.0.0.1:8080/inference"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"
SESSION_ID="voice-$(date +%s)-$$"

# Skill registry - loaded dynamically
declare -A SKILL_PATTERNS
declare -A SKILL_FUNCTIONS
declare -A SKILL_DESCRIPTIONS

# ============================================
# CORE SERVICES
# ============================================

# TTS Process tracking
TTS_PID_FILE="/tmp/tts.pid"

speak() {
    local text="$1"
    echo "🔊 $text"
    
    # Kill any existing TTS
    if [ -f "$TTS_PID_FILE" ]; then
        kill $(cat "$TTS_PID_FILE") 2>/dev/null
        rm -f "$TTS_PID_FILE"
    fi
    
    # Generate TTS in background so we can interrupt it
    (
        curl -s -X POST "https://api.inworld.ai/tts/v1/voice" \
            -H "Authorization: Basic $INWORLD_BASIC" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"$text\", \"voice_id\": \"Hades\", \"model_id\": \"inworld-tts-1.5-max\", \"audio_config\": {\"audio_encoding\": \"MP3\", \"speaking_rate\": 1.0}}" 2>/dev/null | \
            grep -o '"audioContent":"[^"]*"' | cut -d'"' -f4 | base64 -d > "$TTS_OUTPUT" 2>/dev/null
        
        [ -s "$TTS_OUTPUT" ] && pw-play "$TTS_OUTPUT" 2>/dev/null
        rm -f "$TTS_PID_FILE"
    ) &
    
    echo $! > "$TTS_PID_FILE"
}

# Stop speaking
stop_speaking() {
    if [ -f "$TTS_PID_FILE" ]; then
        kill $(cat "$TTS_PID_FILE") 2>/dev/null
        rm -f "$TTS_PID_FILE"
        # Also kill any playing audio
        pkill -f "pw-play" 2>/dev/null
        return 0
    fi
    return 1
}

# Check if speech was interrupted
check_interrupt() {
    local text="$1"
    local text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    
    # Interrupt words: stop, shut up, or wake word
    if echo "$text_lower" | grep -qE "(stop|shut up|squidworth|squidward)"; then
        return 0  # Interrupted
    fi
    return 1  # Not interrupted
}

send_to_openclaw() {
    local message="$1"
    curl -s -X POST "http://$IPC_HOST:$IPC_PORT/responses" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$message\", \"source\": \"voice\", \"agentId\": \"main\", \"sessionId\": \"$SESSION_ID\"}" 2>/dev/null >/dev/null &
}

record_audio() {
    echo -n "[Recording"
    timeout 5 pw-record --rate 16000 --channels 1 --format s16 "$AUDIO_FILE" 2>/dev/null &
    RECORD_PID=$!
    for i in 1 2 3 4 5; do
        sleep 1
        echo -n "+"
    done
    kill $RECORD_PID 2>/dev/null
    wait $RECORD_PID 2>/dev/null
    echo "]"
}

transcribe() {
    [ ! -f "$AUDIO_FILE" ] && return
    local size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
    [ $size -lt 10000 ] && return
    curl -s -X POST "$WHISPER_URL" \
        -F "file=@$AUDIO_FILE" \
        -F "response_format=text" 2>/dev/null | tr -d '\n'
}

# ============================================
# SKILL SYSTEM
# ============================================

register_skill() {
    local name="$1"
    local patterns="$2"
    local function="$3"
    local description="$4"
    
    SKILL_PATTERNS["$name"]="$patterns"
    SKILL_FUNCTIONS["$name"]="$function"
    SKILL_DESCRIPTIONS["$name"]="$description"
}

load_skills() {
    echo "📦 Loading skills from $SKILLS_DIR..."
    local count=0
    
    for skill_file in "$SKILLS_DIR"/*.sh; do
        [ -f "$skill_file" ] || continue
        
        # Source the skill file
        source "$skill_file"
        
        # Register the skill
        if [ -n "$skill_name" ] && [ -n "$skill_patterns" ]; then
            register_skill "$skill_name" "${skill_patterns[*]}" "skill_execute" "$skill_description"
            echo "  ✅ Loaded: $skill_name - $skill_description"
            ((count++))
        fi
        
        # Clear variables for next skill
        unset skill_name skill_patterns skill_description
    done
    
    echo "📊 Loaded $count skills"
}

list_skills() {
    echo ""
    echo "📋 Available Skills:"
    for name in "${!SKILL_DESCRIPTIONS[@]}"; do
        echo "  • $name: ${SKILL_DESCRIPTIONS[$name]}"
    done
}

# ============================================
# COMMAND ROUTER
# ============================================

route_command() {
    local command="$1"
    local cmd_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')
    
    # Try to match against skill patterns
    for skill_name in "${!SKILL_PATTERNS[@]}"; do
        local patterns="${SKILL_PATTERNS[$skill_name]}"
        
        for pattern in $patterns; do
            if echo "$cmd_lower" | grep -q "$pattern"; then
                # Execute the skill
                local func="${SKILL_FUNCTIONS[$skill_name]}"
                
                # Re-source the skill to get the execute function
                source "$SKILLS_DIR/${skill_name}.sh"
                skill_execute "$command"
                return 0
            fi
        done
    done
    
    # Fallback
    speak "I heard: $command. I'm not sure how to help with that yet, but I'm learning!"
    send_to_openclaw "$command"
    return 1
}

# ============================================
# MAIN
# ============================================

echo "🦑 Squidworth - Plugin Architecture"
echo "===================================="

# Load all skills
load_skills
list_skills

speak "Hello! I'm Squidworth, your voice assistant. I can control your home lights and help with other tasks. Just say my name to get my attention. You can also say 'stop' or 'shut up' to interrupt me."

cycle=0
while true; do
    cycle=$((cycle + 1))
    echo ""
    echo "[$cycle] 🎤 Listening..."
    
    record_audio
    
    echo "  📝 Transcribing..."
    text=$(transcribe)
    
    [ -z "$text" ] || [ "$text" == "[BLANK_AUDIO]" ] && { echo "  (silence)"; continue; }
    
    echo "  ✅ Heard: '$text'"
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    
    # Check for interrupt words first (stop, shut up, wake word)
    if check_interrupt "$text"; then
        # Stop any ongoing speech
        if stop_speaking; then
            echo "  🛑 Interrupted!"
            
            # Check if it was the wake word (for new command)
            if echo "$text_lower" | grep -qE "(squidworth|squidward)"; then
                message=$(echo "$text" | sed -E 's/.*[Ss]quid(worth|ward)[[:space:]]*//' | xargs)
                
                if [ -z "$message" ]; then
                    speak "Yes? How can I help?"
                else
                    echo "  💬 Routing: '$message'"
                    route_command "$message"
                fi
            else
                # Just "stop" or "shut up" - acknowledge and listen for next command
                echo "  🛑 Stopped. Waiting for next command..."
            fi
            continue
        fi
    fi
    
    # Normal wake word processing (if no interrupt)
    if echo "$text_lower" | grep -qE "(squidworth|squidward)"; then
        message=$(echo "$text" | sed -E 's/.*[Ss]quid(worth|ward)[[:space:]]*//' | xargs)
        
        if [ -z "$message" ]; then
            speak "Yes? How can I help?"
        else
            echo "  💬 Routing: '$message'"
            route_command "$message"
        fi
    else
        echo "  (no wake word)"
    fi
done
