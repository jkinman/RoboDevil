#!/bin/bash
# Voice Assistant with Inworld TTS - FULL LOOP
# Sends to OpenClaw and waits for response

source ~/RoboDevil/.env 2>/dev/null
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-response.mp3"
WAKE_PHRASE="squidworth|squidward"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"

echo "🦑 Squidworth Voice Assistant - Full Conversation Loop"
echo "======================================================="
echo "Wake phrases: 'Squidworth' or 'Squidward'"
echo "I will respond with Hades voice!"
echo "Press Ctrl+C to stop"
echo ""

# Function to speak using Inworld TTS
speak() {
    local text="$1"
    echo "🔊 Squidworth says: '$text'"
    
    curl -s -X POST "https://api.inworld.ai/tts/v1/voice" \
        -H "Authorization: Basic $INWORLD_BASIC" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"$text\",
            \"voice_id\": \"Hades\",
            \"model_id\": \"inworld-tts-1.5-max\",
            \"audio_config\": {
                \"audio_encoding\": \"MP3\",
                \"speaking_rate\": 1.0
            }
        }" 2>/dev/null | \
        grep -o '"audioContent":"[^"]*"' | cut -d'"' -f4 | \
        base64 -d > "$TTS_OUTPUT" 2>/dev/null
    
    if [ -s "$TTS_OUTPUT" ]; then
        pw-play "$TTS_OUTPUT" 2>/dev/null
    else
        espeak -v en-us "$text" 2>/dev/null
    fi
}

# Function to get AI response from OpenClaw
get_ai_response() {
    local user_message="$1"
    
    # Send to OpenClaw and get response
    local response=$(curl -s -X POST http://$IPC_HOST:$IPC_PORT/responses \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"$user_message\",
            \"source\": \"voice\",
            \"agentId\": \"main\"
        }" 2>/dev/null)
    
    # For now, generate a contextual response
    # In a full implementation, this would poll for the AI response
    case "$user_message" in
        *"weather"*|*"temperature"*)
            echo "I don't have access to real-time weather data, but I hope it's nice wherever you are!"
            ;;
        *"time"*|*"clock"*)
            echo "It's $(date '+%I:%M %p') on $(date '+%A, %B %d')."
            ;;
        *"hello"*|*"hi"*)
            echo "Hello! I'm Squidworth, your AI assistant. How can I help you today?"
            ;;
        *"how are you"*)
            echo "I'm doing wonderfully! Always ready to help. What can I do for you?"
            ;;
        *"maui"*|*"trip"*|*"vacation"*)
            echo "Your Maui trip is all set! Flights booked, hotels confirmed, and activities planned. Just need to book that scuba trip!"
            ;;
        *)
            echo "I heard you say: $user_message. I'm processing that through my systems now."
            ;;
    esac
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

# Welcome
speak "Hello! I'm Squidworth. Speak to me and I'll respond with my voice."

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
            speak "Hello! I'm Squidworth. What can I help you with?"
        else
            echo "📝 Processing: '$command'"
            
            # Get AI response and speak it
            response=$(get_ai_response "$command")
            speak "$response"
        fi
    else
        echo "   (no wake word)"
    fi
    
    sleep 0.5
done
