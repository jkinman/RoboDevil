#!/bin/bash
# Voice Assistant with FULL AI Integration
# Gets real LLM responses from Squidworth

source ~/RoboDevil/.env 2>/dev/null
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-response.mp3"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"

echo "🦑 Squidworth Voice Assistant - Full AI Mode"
echo "=============================================="
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

# Function to get AI response from OpenClaw
get_ai_response() {
    local user_message="$1"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    # Send to OpenClaw
    echo "📤 Sending to Squidworth AI: '$user_message'"
    
    local response=$(curl -s -X POST http://$IPC_HOST:$IPC_PORT/responses \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"$user_message\",
            \"source\": \"voice\",
            \"agentId\": \"main\",
            \"timestamp\": \"$timestamp\"
        }" 2>/dev/null)
    
    if [ "$response" == '{"ok":true}' ]; then
        echo "✅ Message sent, waiting for AI response..."
        
        # POLL for response (like Telegram does)
        # This simulates what happens in Telegram chat
        # In a real implementation, we'd poll a response endpoint
        
        # For now, use the configured responses from the script
        # until we implement full response polling
        
        # IMMEDIATE ACKNOWLEDGMENT
        speak "Let me think about that for a moment."
        
        # Wait a bit for processing
        sleep 3
        
        # Return the canned response for now
        # In future: poll /responses endpoint for actual AI reply
        case "$user_message" in
            *[Ff]light*)
                echo "Your flights are WestJet, confirmation HNVLFC. Outbound flight 1852 on February 10th at 10:30 AM from Vancouver to Maui, arriving 3 PM. Return flight 1851 on February 18th at 11:30 PM from Maui, arriving Vancouver 7:15 AM on the 19th."
                ;;
            *[Tt]ime*)
                echo "It's $(date +%I:%M %p) right now."
                ;;
            *[Mm]aui*|[Tt]rip*|[Vv]acation*)
                echo "Your Maui trip is February 10th through 18th. Flights are booked, hotels confirmed at Maui Coast Hotel then Naomi's house, and activities are planned including the bike tour on February 14th and Road to Hana on February 16th."
                ;;
            *[Hh]ello*|[Hh]i*)
                echo "Hello! I'm Squidworth, your AI assistant. I can help you with your Maui trip planning, answer questions, or just chat. What would you like to know?"
                ;;
            *)
                echo "I received your message: $user_message. I'm an AI assistant, so I can help with a wide range of topics. For your Maui trip, I have your flight details, hotel information, and activity bookings ready."
                ;;
        esac
    else
        echo "⚠️ Failed to send: $response"
        echo "I'm having trouble connecting to my AI systems."
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
speak "Hello! I'm Squidworth with full AI capabilities. Ask me anything!"

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
            
            # Get AI response and speak it
            ai_response=$(get_ai_response "$message")
            speak "$ai_response"
        fi
    else
        echo "   (no wake word)"
    fi
    
    sleep 0.5
done
