#!/bin/bash
# Voice Assistant with Dynamic Recording
# Records until 1 second of silence detected

source ~/RoboDevil/.env 2>/dev/null
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-response.mp3"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"
SESSION_ID="voice-$(date +%s)-$$"

echo "🦑 Squidworth Voice Assistant - Dynamic Recording"
echo "=================================================="
echo "Records until 1 second of silence detected"
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
    # Dynamic recording: Record for max 10 seconds, but transcribe early if we have content
    # This helps capture complete phrases without cutting off
    
    local max_duration=10
    local check_interval=0.5
    local elapsed=0
    local last_size=0
    local stable_count=0
    local silence_threshold=3  # 3 checks with no growth = ~1.5 seconds silence
    
    # Start recording in background
    pw-record --rate 16000 --channels 1 --format s16 "$AUDIO_FILE" 2>/dev/null &
    RECORD_PID=$!
    
    echo -n "[Recording"
    
    # Monitor file growth
    while [ $elapsed -lt $max_duration ]; do
        sleep $check_interval
        elapsed=$((elapsed + 1))
        
        if [ -f "$AUDIO_FILE" ]; then
            local current_size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
            
            if [ $current_size -eq $last_size ] && [ $current_size -gt 10000 ]; then
                # File not growing (silence)
                stable_count=$((stable_count + 1))
                echo -n "."
                
                if [ $stable_count -ge $silence_threshold ]; then
                    # ~1.5 seconds of silence
                    echo "]"
                    echo "  [Silence detected, stopping]"
                    break
                fi
            else
                # File growing (speech)
                stable_count=0
                last_size=$current_size
                echo -n "+"
            fi
        fi
    done
    
    # Stop recording
    kill $RECORD_PID 2>/dev/null
    wait $RECORD_PID 2>/dev/null
    
    # Show final size
    local final_size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
    echo "  [Captured: $final_size bytes]"
}

transcribe() {
    [ ! -f "$AUDIO_FILE" ] && return
    local size=$(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0)
    [ $size -lt 10000 ] && return
    whisper-cli -m "$WHISPER_MODEL" -f "$AUDIO_FILE" -nt -np -t 1 --no-gpu 2>/dev/null | tail -1
}

send_and_wait() {
    local user_message="$1"
    echo "📤 Sending: '$user_message'"
    
    local send_result=$(curl -s -X POST http://$IPC_HOST:$IPC_PORT/responses \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$user_message\", \"source\": \"voice\", \"agentId\": \"main\", \"sessionId\": \"$SESSION_ID\"}" 2>/dev/null)
    
    if [ "$send_result" != '{"ok":true}' ]; then
        speak "Connection error."
        return
    fi
    
    speak "Let me think about that."
    
    # Poll for AI response
    local attempts=0
    while [ $attempts -lt 30 ]; do
        sleep 0.5
        attempts=$((attempts + 1))
        
        local response_data=$(curl -s "http://$IPC_HOST:$IPC_PORT/ai-response?session=$SESSION_ID" 2>/dev/null)
        local ai_response=$(echo "$response_data" | grep -o '"text":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$ai_response" ]; then
            speak "$ai_response"
            return
        fi
    done
    
    # Fallback
    if echo "$user_message" | grep -qi "time"; then
        speak "It's $(date +%I:%M) right now."
    elif echo "$user_message" | grep -qi "flight"; then
        speak "WestJet confirmation HNVLFC. Outbound February 10th, 10:30 AM Vancouver to Maui. Return February 18th, 11:30 PM Maui to Vancouver, arriving 7:15 AM on the 19th."
    else
        speak "I heard: $user_message. I can help with your Maui trip details."
    fi
}

# Welcome
speak "Hello! I'm Squidworth. Speak naturally, and I'll record until you pause."

cycle=0
while true; do
    cycle=$((cycle + 1))
    echo ""
    echo "[$cycle] 🎤 Listening... (speak, then pause 1 second)"
    
    record_audio
    text=$(transcribe)
    
    [ -z "$text" ] || [ "$text" == "[BLANK_AUDIO]" ] && { echo "  (silence)"; continue; }
    
    echo "  📝 Transcribed: '$text'"
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    
    if echo "$text_lower" | grep -qE "(squidworth|squidward)"; then
        echo "  ✅ WAKE WORD!"
        
        message=$(echo "$text" | sed -E 's/.*[Ss]quid(worth|ward)[[:space:]]*//' | xargs)
        
        if [ -z "$message" ]; then
            echo "  ⚠️ No command after wake word"
            speak "I heard my name. What would you like to know?"
        else
            echo "  💬 Command: '$message'"
            send_and_wait "$message"
        fi
    else
        echo "  (no wake word)"
    fi
done
