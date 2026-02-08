#!/bin/bash
# Whisper Server Service Script
# Keeps whisper model loaded in memory for fast transcription

WHISPER_MODEL="/home/jkinman/RoboDevil/models/ggml-tiny.en.bin"
WHISPER_PORT=8080
PID_FILE="/tmp/whisper-server.pid"

start() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "Whisper server already running (PID: $(cat $PID_FILE))"
        return
    fi
    
    echo "🎙️  Starting Whisper Server on port $WHISPER_PORT..."
    echo "   Model: $WHISPER_MODEL"
    
    # Start whisper-server with speed optimizations
    # -t 4: use 4 threads (more parallelism)
    # --beam-size 1: faster but less accurate
    # --best-of 1: faster but less accurate  
    # --no-timestamps: skip timestamp generation
    whisper-server \
        -m "$WHISPER_MODEL" \
        --host 127.0.0.1 \
        --port $WHISPER_PORT \
        -t 4 \
        --no-gpu \
        --beam-size 1 \
        --best-of 1 \
        --no-timestamps \
        > /tmp/whisper-server.log 2>&1 &
    
    PID=$!
    echo $PID > "$PID_FILE"
    
    # Wait for server to start
    sleep 3
    
    if kill -0 $PID 2>/dev/null; then
        echo "✅ Whisper server running (PID: $PID)"
        echo "   API: http://127.0.0.1:$WHISPER_PORT/inference"
        echo "   Logs: tail -f /tmp/whisper-server.log"
    else
        echo "❌ Failed to start whisper server"
        rm -f "$PID_FILE"
    fi
}

stop() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            echo "🛑 Stopping whisper server (PID: $PID)..."
            kill $PID 2>/dev/null
            sleep 1
            echo "✅ Stopped"
        fi
        rm -f "$PID_FILE"
    else
        echo "Whisper server not running"
    fi
}

status() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "✅ Whisper server running (PID: $(cat $PID_FILE))"
        echo "   Port: $WHISPER_PORT"
        echo "   Model: $(basename $WHISPER_MODEL)"
    else
        echo "❌ Whisper server not running"
        rm -f "$PID_FILE" 2>/dev/null
    fi
}

restart() {
    stop
    sleep 1
    start
}

test() {
    echo "🧪 Testing whisper server..."
    
    # Create a test audio file
    echo "Recording 3 seconds of test audio..."
    timeout 3 pw-record --rate 16000 --channels 1 --format s16 /tmp/test-whisper.wav 2>/dev/null
    
    if [ -f "/tmp/test-whisper.wav" ]; then
        echo "Sending to whisper server..."
        RESULT=$(curl -s -X POST http://127.0.0.1:$WHISPER_PORT/inference \
            -H "Content-Type: multipart/form-data" \
            -F "file=@/tmp/test-whisper.wav" \
            -F "temperature=0.0" \
            -F "response_format=text" 2>/dev/null)
        
        echo "Response: $RESULT"
    else
        echo "❌ No test audio recorded"
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    test)
        test
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|test}"
        exit 1
        ;;
esac
