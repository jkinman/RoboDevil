#!/bin/bash
# Voice Assistant - Detailed Responses Version
# Provides actual trip information

source ~/RoboDevil/.env 2>/dev/null
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
WHISPER_MODEL="$ROBODEVIL_DIR/models/ggml-tiny.en.bin"
AUDIO_FILE="/tmp/voice-assistant.wav"
TTS_OUTPUT="/tmp/tts-response.mp3"
IPC_HOST="127.0.0.1"
IPC_PORT="17171"

echo "🦑 Squidworth Voice Assistant - Detailed Info"
echo "==============================================="
echo "Wake phrases: 'Squidworth' or 'Squidward'"
echo "I have your Maui trip details!"
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

record_audio() {
    timeout 5 pw-record --rate 16000 --channels 1 --format s16 "$AUDIO_FILE" 2>/dev/null
}

transcribe() {
    [ ! -f "$AUDIO_FILE" ] && return
    [ $(stat -c%s "$AUDIO_FILE" 2>/dev/null || echo 0) -lt 10000 ] && return
    whisper-cli -m "$WHISPER_MODEL" -f "$AUDIO_FILE" -nt -np -t 1 --no-gpu 2>/dev/null | tail -1
}

# Welcome
speak "Hello! I'm Squidworth. Ask me about your Maui trip details."

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
            speak "Hello! Ask me about your Maui flights, hotels, or activities."
        else
            echo "💬 You said: '$message'"
            
            # Immediate feedback
            speak "One moment, let me look that up."
            
            # DETAILED contextual responses with ACTUAL trip info
            if echo "$message" | grep -qi "flight\|fly\|airport\|westjet\|plane"; then
                speak "Your flights are booked with WestJet, confirmation HNVLFC. Outbound is February 10th, flight 1852, departing Vancouver at 10:30 AM, arriving Maui at 3 PM. Return is February 18th, flight 1851, departing Maui at 11:30 PM, arriving Vancouver at 7:15 AM on February 19th."
            elif echo "$message" | grep -qi "hotel\|coast\|room\|kihei\|stay"; then
                speak "You're staying at Maui Coast Hotel in Kihei from February 10th to 13th. Confirmation 1039325495, room Hōkū King. Then you'll move to Naomi's house in Kula from February 13th to 18th."
            elif echo "$message" | grep -qi "bike\|tour\|haleakala\|sunrise"; then
                speak "Your Haleakala bike tour is February 14th at 4:30 AM with Maui Mountain Riders. You'll watch sunrise at 10,000 feet, then bike 23 miles downhill. Booking number 332725090."
            elif echo "$message" | grep -qi "hana\|road\|black sand\|waianapanapa"; then
                speak "Road to Hana is February 16th. You have a reservation at Waiʻānapanapa State Park at 10 AM for the black sand beach. Order number VISITOR-2026-02-07-WSP-1885316. Leave Naomi's by 8 AM, it's a 90 minute drive."
            elif echo "$message" | grep -qi "scuba\|snorkel\|boat\|dive"; then
                speak "You still need to book the scuba and snorkel boat trip for February 11th. I recommend Kai Kanani at 808-879-7218. Joel can scuba while Amanda snorkels from the same boat."
            elif echo "$message" | grep -qi "time"; then
                speak "It's $(date +%I:%M %p) right now."
            elif echo "$message" | grep -qi "naomi\|house\|kula"; then
                speak "You'll be staying with Naomi at 5789 Lower Kula Road from February 13th to 18th. On February 13th, you'll drive her to the airport at 6 PM for her 8 PM flight."
            elif echo "$message" | grep -qi "maui\|trip\|vacation\|schedule\|plan"; then
                speak "Your Maui trip is February 10th to 18th. Day 1: Arrive and beach. Day 2: Scuba boat trip, needs booking. Day 3: Beach day. Day 4: Move to Kula, drive Naomi to airport. Day 5: Valentine's Day, Haleakala bike tour at 4:30 AM. Day 6: Rest day. Day 7: Road to Hana with 10 AM reservation at black sand beach. Day 8: Paia and North Shore. Day 9: Fly home at 11:30 PM."
            elif echo "$message" | grep -qi "restaurant\|eat\|food\|dinner"; then
                speak "Kula Bistro is nearby Naomi's house for meals. In Kihei, try Monkeypod Kitchen, Lineage, or Fred's Mexican Cafe. Mama's Fish House is famous but pricey and needs reservations."
            elif echo "$message" | grep -qi "hello\|hi\|hey"; then
                speak "Hello there! Ready to help with your Maui trip details."
            elif echo "$message" | grep -qi "thank"; then
                speak "You're welcome! Have an amazing trip!"
            else
                speak "I heard you say $message. I'm processing that through my systems now."
                
                # Send to OpenClaw for full processing
                curl -s -X POST http://127.0.0.1:17171/responses \
                    -H "Content-Type: application/json" \
                    -d "{\"text\": \"$message\", \"source\": \"voice\", \"agentId\": \"main\"}" > /dev/null 2>&1
            fi
        fi
    else
        echo "   (no wake word)"
    fi
    
    sleep 0.5
done
