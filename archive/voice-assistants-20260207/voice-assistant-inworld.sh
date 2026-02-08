#!/bin/bash
# Voice Assistant with Inworld TTS for RoboDevil
# Uses Hades voice via Inworld AI

# Load environment variables
source ~/RoboDevil/.env 2>/dev/null

eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-output.mp3"
WAKE_PHRASE="squidworth|squidward"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"

echo "🦑 Squidworth Voice Assistant with Inworld TTS (Hades Voice)"
echo "============================================================"
echo "Wake phrases: 'Squidworth' or 'Squidward'"
echo "Press Ctrl+C to stop"
echo ""

# Function to speak text using Inworld TTS
speak_inworld() {
    local text="$1"
    echo "🔊 Speaking (Inworld/Hades): '$text'"
    
    # Call Inworld TTS API
    local response=$(curl -s -X POST "https://api.inworld.ai/tts/v1/voice" \
        -H "Authorization: Basic $INWORLD_BASIC" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"$text\",
            \"voice_id\": \"Hades\",
            \"model_id\": \"inworld-tts-1.5-max\",
            \"audio_config\": {
                \"audio_encoding\": \"MP3\",
                \"speaking_rate\": 1.0
            },
            \"temperature\": 1.0
        }" 2>/dev/null)
    
    # Check if response contains audio
    if echo "$response" | grep -q "audioContent\|audio_content"; then
        # Extract base64 audio and decode
        echo "$response" | grep -o '"audioContent":"[^"]*"' | cut -d'"' -f4 | base64 -d > "$TTS_OUTPUT" 2>/dev/null
        
        # Play the audio
        if [ -f "$TTS_OUTPUT" ] && [ -s "$TTS_OUTPUT" ]; then
            pw-play "$TTS_OUTPUT" 2>/dev/null || \
            ffplay -nodisp -autoexit "$TTS_OUTPUT" 2>/dev/null || \
            mpg123 "$TTS_OUTPUT" 2>/dev/null
        else
            echo "⚠️ TTS audio empty, falling back to espeak"
            espeak -v en-us "$text" 2>/dev/null
        fi
    else
        echo "⚠️ Inworld TTS failed, falling back to espeak"
        espeak -v en-us "$text" 2>/dev/null
    fi
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
        echo "✅ Message sent"
        speak_inworld "I'm processing your request."
    else
        echo "⚠️ Response: $response"
        speak_inworld "I'm having trouble connecting."
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
speak_inworld "Hello, I'm Squidworth with Hades voice. Say my name to wake me up."

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
    
    if echo "$text_lower" | grep -qE "(squidworth|squidward)"; then
        echo "✅ WAKE WORD DETECTED!"
        
        # Extract command
        command=$(echo "$text_lower" | sed -E 's/.*(squidworth|squidward)//' | xargs)
        
        if [ -z "$command" ]; then
            echo "🎙️ Wake word only - greeting user"
            speak_inworld "Hello! I'm Squidworth, your AI assistant. How can I help you?"
        else
            echo "📝 Command: '$command'"
            speak_inworld "I heard you say $command. Let me process that."
            send_to_openclaw "$command"
        fi
    else
        echo "   (no wake word)"
    fi
    
    sleep 0.5
done
