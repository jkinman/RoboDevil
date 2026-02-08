#!/bin/bash
# Voice Assistant with TTS for RoboDevil
# Accepts both "Squidworth" and "Squidward"

eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"

# TTS settings
TTS_VOICE="en-us"
TTS_SPEED="120"  # Slower, more natural speed

echo "🦑 Squidworth Voice Assistant with TTS"
echo "======================================="
echo "Wake phrases: 'Squidworth' or 'Squidward'"
echo "Press Ctrl+C to stop"
echo ""

# Function to speak text with proper audio format
speak() {
    local text="$1"
    echo "🔊 Speaking: '$text'"
    
    # Generate audio at correct rate and play
    # espeak outputs at 22050 Hz mono, speaker expects 48000 Hz stereo
    espeak -v "$TTS_VOICE" -s "$TTS_SPEED" "$text" --stdout 2>/dev/null | \
        ffmpeg -hide_banner -loglevel error -i - -ar 48000 -ac 2 -f wav - | \
        pw-play -
}

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
    
    echo "📤 Sending to OpenClaw: '$text'"
    
    local response=$(curl -s -X POST http://$IPC_HOST:$IPC_PORT/responses \
        -H "Content-Type: application/json" \
        -d "$json" 2>/dev/null)
    
    if [ "$response" == '{"ok":true}' ]; then
        echo "✅ Message sent successfully"
        speak "I'm processing your request."
        sleep 2
        speak "I've sent your message to the system."
    else
        echo "⚠️ Response: $response"
        speak "I'm having trouble connecting."
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

# Welcome message
speak "Hello, I'm Squidworth. Say my name to wake me up."

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
    
    # Check for wake phrase (accepts squidworth or squidward)
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    
    if echo "$text_lower" | grep -qE "(squidworth|squidward)"; then
        echo "✅ WAKE WORD DETECTED!"
        
        # Extract command (remove either wake word)
        command=$(echo "$text_lower" | sed -E 's/.*(squidworth|squidward)//' | xargs)
        
        if [ -z "$command" ]; then
            echo "🎙️ Wake word only - greeting user"
            speak "Hello! I'm Squidworth, your AI assistant. How can I help you?"
        else
            echo "📝 Command: '$command'"
            speak "I heard you say $command. Let me process that."
            send_to_openclaw "$command"
        fi
    else
        echo "   (no wake word)"
    fi
    
    sleep 0.5
done
