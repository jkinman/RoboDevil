#!/bin/bash
# Voice Assistant - ULTRA LOW LATENCY
# Uses whisper-server HTTP API (model already loaded!)

source ~/RoboDevil/.env 2>/dev/null
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-response.mp3"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"
WHISPER_URL="http://127.0.0.1:8080/inference"
SESSION_ID="voice-$(date +%s)-$$"

echo "🦑 Squidworth - ULTRA FAST Mode"
echo "================================"
echo "Using whisper-server (no model loading!)"
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
    # Simple fixed-duration recording (5 seconds max)
    # More reliable than silence detection
    echo -n "[Recording"
    
    timeout 5 pw-record --rate 16000 --channels 1 --format s16 "$AUDIO_FILE" 2>/dev/null &
    RECORD_PID=$!
    
    # Show progress
    for i in 1 2 3 4 5; do
        sleep 1
        echo -n "+"
    done
    
    # Ensure recording is stopped
    kill $RECORD_PID 2>/dev/null
    wait $RECORD_PID 2>/dev/null
    
    echo "]"
    local final_size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
    echo "  [Captured: $final_size bytes]"
}

transcribe() {
    [ ! -f "$AUDIO_FILE" ] && return
    local size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
    [ $size -lt 10000 ] && return
    
    # ULTRA FAST: Use HTTP API instead of CLI (model already loaded!)
    curl -s -X POST "$WHISPER_URL" \
        -F "file=@$AUDIO_FILE" \
        -F "response_format=text" 2>/dev/null | tr -d '\n'
}

respond() {
    local user_message="$1"
    
    # Send to OpenClaw (non-blocking)
    curl -s -X POST http://$IPC_HOST:$IPC_PORT/responses \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$user_message\", \"source\": \"voice\", \"agentId\": \"main\", \"sessionId\": \"$SESSION_ID\"}" 2>/dev/null >/dev/null &
    
    # Quick poll for AI response (3 sec max)
    local attempts=0
    while [ $attempts -lt 6 ]; do
        sleep 0.5
        attempts=$((attempts + 1))
        
        local response_data=$(curl -s "http://$IPC_HOST:$IPC_PORT/ai-response?session=$SESSION_ID" 2>/dev/null)
        local ai_response=$(echo "$response_data" | grep -o '"text":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$ai_response" ]; then
            speak "$ai_response"
            return 0
        fi
    done
    
    return 1
}

get_response() {
    local user_message="$1"
    
    if respond "$user_message"; then
        return
    fi
    
    # Immediate fallback - no delay
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
        speak "5789 Lower Kula Road, Kula Hawaii."
    else
        speak "$user_message."
    fi
}

# Check whisper server is running
if ! curl -s "$WHISPER_URL" >/dev/null 2>&1; then
    echo "⚠️  Whisper server not running! Starting it..."
    ~/RoboDevil/whisper-server-control.sh start
    sleep 3
fi

# Welcome
speak "Ultra fast mode active. No model loading delays."

cycle=0
while true; do
    cycle=$((cycle + 1))
    echo ""
    echo "[$cycle] 🎤 Listening..."
    
    record_start=$(date +%s)
    record_audio
    record_end=$(date +%s)
    record_time=$((record_end - record_start))
    
    echo "  📝 Transcribing via HTTP..."
    trans_start=$(date +%s)
    text=$(transcribe)
    trans_end=$(date +%s)
    trans_time=$((trans_end - trans_start))
    
    [ -z "$text" ] || [ "$text" == "[BLANK_AUDIO]" ] && { echo "  (silence)"; continue; }
    
    echo "  ✅ Heard: '$text' (transcription: ${trans_time}s)"
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    
    if echo "$text_lower" | grep -qE "(squidworth|squidward)"; then
        message=$(echo "$text" | sed -E 's/.*[Ss]quid(worth|ward)[[:space:]]*//' | xargs)
        
        if [ -z "$message" ]; then
            speak "Yes?"
        else
            echo "  💬 Command: '$message'"
            echo "  ⏱️  Responding..."
            
            resp_start=$(date +%s)
            get_response "$message"
            resp_end=$(date +%s)
            resp_time=$((resp_end - resp_start))
            
            total_time=$((record_time + trans_time + resp_time))
            echo "  ⏱️  Total: ${total_time}s (record:${record_time}s, trans:${trans_time}s, resp:${resp_time}s)"
        fi
    else
        echo "  (no wake word)"
    fi
done
