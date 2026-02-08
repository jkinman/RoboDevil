#!/bin/bash
# Simple shell-based voice assistant for RoboDevil

eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
WAKE_PHRASE="squidworth"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"

echo "🦑 Squidworth Voice Assistant (Shell Version)"
echo "=============================================="
echo "Wake phrase: '$WAKE_PHRASE'"
echo "Press Ctrl+C to stop"
echo ""

# Function to send to OpenClaw
send_to_openclaw() {
    local text="$1"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    local json=$(cat <<JSONEOF
{
  "text": "$text",
  "source": "voice",
  "agentId": "main",
  "timestamp": "$timestamp"
}
JSONEOF
)
    
    local response=$(curl -s -X POST http://$IPC_HOST:$IPC_PORT/responses \
        -H "Content-Type: application/json" \
        -d "$json" 2>/dev/null)
    
    if [ "$response" == '{"ok":true}' ]; then
        echo "✅ Sent to OpenClaw: '$text'"
    else
        echo "⚠️ OpenClaw response: $response"
    fi
}

# Function to record audio
record_audio() {
    timeout 5 pw-record --rate 16000 --channels 1 --format s16 "$AUDIO_FILE" 2>/dev/null
}

# Function to transcribe
transcribe() {
    if [ ! -f "$AUDIO_FILE" ]; then
        echo ""
        return
    fi
    
    local size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
    if [ "$size" -lt 10000 ]; then
        echo ""
        return
    fi
    
    whisper-cli -m "$WHISPER_MODEL" -f "$AUDIO_FILE" -nt -np -t 1 --no-gpu 2>/dev/null | tail -1
}

# Main loop
cycle=0
while true; do
    cycle=$((cycle + 1))
    echo -n "[$cycle] 🎤 Listening... "
    
    record_audio
    text=$(transcribe)
    
    if [ -z "$text" ] || [ "$text" == "[BLANK_AUDIO]" ]; then
        echo "(no speech)"
        continue
    fi
    
    echo "Heard: '$text'"
    
    # Check for wake phrase
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    
    if echo "$text_lower" | grep -q "$WAKE_PHRASE"; then
        echo "✅ WAKE WORD DETECTED!"
        
        # Extract command
        command=$(echo "$text_lower" | sed "s/.*$WAKE_PHRASE//" | xargs)
        
        if [ -z "$command" ]; then
            command="Hello Squidworth, I'm here!"
        fi
        
        echo "📝 Command: '$command'"
        send_to_openclaw "$command"
        echo "⏳ Waiting for response..."
        sleep 2
    else
        echo "   (no wake word)"
    fi
    
    sleep 0.5
done
