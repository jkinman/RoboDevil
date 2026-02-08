#!/bin/bash
# Voice Assistant with FULL AI Integration
# Uses OpenClaw IPC with AI response polling

source ~/RoboDevil/.env 2>/dev/null
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-response.mp3"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"

# Generate unique session ID for this voice session
SESSION_ID="voice-$(date +%s)-$$"

echo "🦑 Squidworth Voice Assistant - Full AI Mode"
echo "=============================================="
echo "Session: $SESSION_ID"
echo "I will respond with my actual AI intelligence!"
echo ""

speak() {
    local text="$1"
    echo "🔊 Speaking: '$text'"
    
    curl -s -X POST "https://api.inworld.ai/tts/v1/voice" \
        -H "Authorization: Basic $INWORLD_BASIC" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"$text\",
            \"voice_id\": \"Hades\",
            \"model_id\": \"inworld-tts-1.5-max\",
            \"audio_config\": {\"audio_encoding\": \"MP3\", \"speaking_rate\": 1.0}
        }" 2>/dev/null | \
        grep -o '"audioContent":"[^"]*"' | cut -d'"' -f4 | \
        base64 -d > "$TTS_OUTPUT" 2>/dev/null
    
    [ -s "$TTS_OUTPUT" ] && pw-play "$TTS_OUTPUT" 2>/dev/null
}

# Send message to OpenClaw and wait for AI responsesend_and_wait_for_response() {
    local user_message="$1"
    
    echo "📤 Sending to Squidworth AI: '$user_message'"
    
    # Send message to OpenClaw via IPC
    local send_result=$(curl -s -X POST http://$IPC_HOST:$IPC_PORT/responses \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"$user_message\",
            \"source\": \"voice\",
            \"agentId\": \"main\",
            \"sessionId\": \"$SESSION_ID\"
        }" 2>/dev/null)
    
    if [ "$send_result" != '{"ok":true}' ]; then
        echo "⚠️ Failed to send: $send_result"
        speak "I'm having trouble connecting to my AI systems."
        return 1
    fi
    
    echo "✅ Message sent, waiting for AI response..."
    
    # Immediate acknowledgment
    speak "Let me think about that."
    
    # Poll for AI response (try for up to 15 seconds)
    local attempts=0
    local max_attempts=30
    local ai_response=""
    
    while [ $attempts -lt $max_attempts ]; do
        sleep 0.5
        attempts=$((attempts + 1))
        
        # Check for AI response
        local response_data=$(curl -s "http://$IPC_HOST:$IPC_PORT/ai-response?session=$SESSION_ID" 2>/dev/null)
        
        # Extract text from response
        ai_response=$(echo "$response_data" | grep -o '"text":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$ai_response" ]; then
            echo "✅ Got AI response after $attempts attempts"
            speak "$ai_response"
            return 0
        fi
    done
    
    # Timeout - use fallback response
    echo "⏱️ No AI response received, using fallback"
    
    # Smart fallback based on message content
    if echo "$user_message" | grep -qi "flight"; then
        speak "Your WestJet flights are confirmation HNVLFC. Outbound February 10th at 10:30 AM from Vancouver to Maui. Return February 18th at 11:30 PM from Maui to Vancouver, arriving 7:15 AM on the 19th."
    elif echo "$user_message" | grep -qi "time"; then
        speak "It's $(date +%I:%M %p) right now."
    elif echo "$user_message" | grep -qi "maui\|trip"; then
        speak "Your Maui trip is February 10th through 18th. Staying at Maui Coast Hotel then Naomi's house. Bike tour February 14th, Road to Hana February 16th."
    else
        speak "I heard you say: $user_message. I'm an AI assistant and I can help with your Maui trip planning or answer questions."
    fi
}

record_audio() {
    timeout 5 pw-record --rate 16000 --channels 1 --format s16 "$AUDIO_FILE" 2>/dev/null
}

transcribe() {
    [ ! -f "$AUDIO_FILE" ] && return
    [ $(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0) -lt 10000 ] && return
    whisper-cli -m "$WHISPER_MODEL" -f "$AUDIO_FILE" -nt -np -t 1 --no-gpu 2>/dev/null | tail -1
}

# Welcome
speak "Hello! I'm Squidworth with full AI capabilities. Ask me anything and I'll respond with my AI intelligence."

cycle=0
while true; do
    cycle=$((cycle + 1))
    echo -n "[$cycle] 🎤 Listening... "
    
    record_audio
    text=$(transcribe)
    
    [ -z "$text" ] || [ "$text" == "[BLANK_AUDIO]" ] && { echo "(no speech)"; continue; }
    
    echo "Heard: '$text'"
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    
    if echo "$text_lower" | grep -qE "(squidworth|squidward)"; then
        echo "✅ WAKE WORD!"
        
        message=$(echo "$text" | sed -E 's/.*[Ss]quid(worth|ward)//' | xargs)
        
        if [ -z "$message" ]; then
            speak "Hello! I'm here. What would you like to ask me?"
        else
            echo "💬 You said: '$message'"
            send_and_wait_for_response "$message"
        fi
    else
        echo "   (no wake word)"
    fi
    
    sleep 0.5
done
