#!/bin/bash
# Voice Assistant - LOW LATENCY VERSION
# Optimized for speed: reduced polling, direct responses

source ~/RoboDevil/.env 2>/dev/null
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-response.mp3"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"
SESSION_ID="voice-$(date +%s)-$$"

# Start timing for debugging
start_time=$(date +%s.%N)

echo "🦑 Squidworth - Fast Response Mode"
echo "==================================="
echo "Optimized for low latency"
echo ""

speak() {
    local text="$1"
    echo "🔊 Speaking: '$text'"
    curl -s -X POST "https://api.inworld.ai/tts/v1/voice" \
        -H "Authorization: Basic $INWORLD_BASIC" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$text\", \"voice_id\": \"Hades\", \"model_id\": \"inworld-tts-1.5-max\", \"audio_config\": {\"audio_encoding\": \"MP3\", \"speaking_rate\": 1.0}}" 2>/dev/null | \
        grep -o '"audioContent":"[^"]*"' | cut -d'"' -f4 | base64 -d > "$TTS_OUTPUT" 2>/dev/null
    [ -s "$TTS_OUTPUT" ] && pw-play "$TTS_OUTPUT" 2>/dev/null
}

record_audio() {
    local max_duration=8
    local check_interval=0.5
    local elapsed=0
    local last_size=0
    local stable_count=0
    local silence_threshold=3
    
    pw-record --rate 16000 --channels 1 --format s16 "$AUDIO_FILE" 2>/dev/null &
    RECORD_PID=$!
    
    echo -n "[Recording"
    
    while [ $elapsed -lt $max_duration ]; do
        sleep $check_interval
        elapsed=$((elapsed + 1))
        
        if [ -f "$AUDIO_FILE" ]; then
            local current_size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
            
            if [ $current_size -eq $last_size ] && [ $current_size -gt 10000 ]; then
                stable_count=$((stable_count + 1))
                echo -n "."
                
                if [ $stable_count -ge $silence_threshold ]; then
                    echo "]"
                    break
                fi
            else
                stable_count=0
                last_size=$current_size
                echo -n "+"
            fi
        fi
    done
    
    kill $RECORD_PID 2>/dev/null
    wait $RECORD_PID 2>/dev/null
    
    local final_size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
    echo "  [Captured: $final_size bytes]"
}

transcribe() {
    [ ! -f "$AUDIO_FILE" ] && return
    local size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
    [ $size -lt 10000 ] && return
    
    # OPTIMIZATION: Use -t 2 for faster processing (2 threads)
    # and --flash-attn if available for speed
    whisper-cli -m "$WHISPER_MODEL" -f "$AUDIO_FILE" -nt -np -t 2 --no-gpu 2>/dev/null | tail -1
}

# OPTIMIZED: Fast response without "Let me think"
respond_fast() {
    local user_message="$1"
    
    # Send to OpenClaw (non-blocking, don't wait for response)
    curl -s -X POST http://$IPC_HOST:$IPC_PORT/responses \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$user_message\", \"source\": \"voice\", \"agentId\": \"main\", \"sessionId\": \"$SESSION_ID\"}" 2>/dev/null >/dev/null &
    
    # Quick poll for AI response (5 seconds max instead of 15)
    local attempts=0
    while [ $attempts -lt 10 ]; do
        sleep 0.5
        attempts=$((attempts + 1))
        
        local response_data=$(curl -s "http://$IPC_HOST:$IPC_PORT/ai-response?session=$SESSION_ID" 2>/dev/null)
        local ai_response=$(echo "$response_data" | grep -o '"text":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$ai_response" ]; then
            speak "$ai_response"
            return 0  # AI responded
        fi
    done
    
    return 1  # No AI response
}

# Get immediate response (no waiting)
get_response() {
    local user_message="$1"
    
    # Try AI first (quick 5 sec poll)
    if respond_fast "$user_message"; then
        return
    fi
    
    # Immediate fallback - NO "Let me think" delay
    if echo "$user_message" | grep -qi "time"; then
        speak "It's $(date +%I:%M)."
    elif echo "$user_message" | grep -qi "flight"; then
        speak "WestJet HNVLFC. Outbound February 10th at 10:30 AM. Return February 18th at 11:30 PM."
    elif echo "$user_message" | grep -qi "hotel"; then
        speak "Maui Coast Hotel in Kihei, February 10th to 13th."
    elif echo "$user_message" | grep -qi "bike"; then
        speak "Bike tour February 14th at 4:30 AM with Maui Mountain Riders."
    elif echo "$user_message" | grep -qi "road to hana"; then
        speak "Road to Hana February 16th. Wai'anapanapa reservation at 10 AM."
    elif echo "$user_message" | grep -qi "naomi"; then
        speak "Naomi's address is 5789 Lower Kula Road, Kula Hawaii."
    else
        speak "$user_message."
    fi
}

# Welcome - shorter
echo "🔊 Playing welcome..."
speak "Voice mode active. Ask me about your Maui trip."

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
    
    if echo "$text_lower" | grep -qE "(squidworth|squidward)"; then
        message=$(echo "$text" | sed -E 's/.*[Ss]quid(worth|ward)[[:space:]]*//' | xargs)
        
        if [ -z "$message" ]; then
            speak "Yes?"
        else
            echo "  💬 Command: '$message'"
            echo "  ⏱️  Responding..."
            get_response "$message"
            
            # Show timing
            end_time=$(date +%s.%N)
            elapsed=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "?")
            echo "  ⏱️  Total time: ${elapsed}s"
            start_time=$(date +%s.%N)  # Reset for next cycle
        fi
    else
        echo "  (no wake word)"
    fi
done
