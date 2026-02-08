#!/bin/bash
# Voice Assistant Control Script
# Usage: ./voice-control.sh [start|stop|status|restart]

VOICE_PID_FILE="/tmp/voice-pid.txt"
IPC_PID_FILE="/tmp/ipc-pid.txt"
VOICE_LOG="/tmp/voice-assistant.log"
IPC_LOG="/tmp/ipc-bridge.log"

start() {
    echo "🦑 Starting Squidworth Voice Assistant..."
    
    # Check if already running
    if [ -f "$VOICE_PID_FILE" ] && kill -0 $(cat "$VOICE_PID_FILE") 2>/dev/null; then
        echo "⚠️ Voice assistant already running (PID: $(cat $VOICE_PID_FILE))"
        return 1
    fi
    
    # Start IPC Bridge
    echo "  🌉 Starting IPC Bridge..."
    cd ~/RoboDevil/services/ipc-bridge
    nohup node src/index.js > "$IPC_LOG" 2>&1 &
    ipc_pid=$!
    echo $ipc_pid > "$IPC_PID_FILE"
    
    sleep 3
    
    # Check IPC started
    if ! ss -tlnp | grep -q ":17171"; then
        echo "❌ IPC Bridge failed to start"
        return 1
    fi
    echo "  ✅ IPC Bridge running on port 17171"
    
    # Start Voice Assistant
    echo "  🎤 Starting Voice Assistant..."
    cd ~/RoboDevil
    nohup ./voice-assistant-fast.sh > "$VOICE_LOG" 2>&1 &
    voice_pid=$!
    echo $voice_pid > "$VOICE_PID_FILE"
    
    sleep 2
    
    if kill -0 $voice_pid 2>/dev/null; then
        echo "  ✅ Voice Assistant running (PID: $voice_pid)"
        echo ""
        echo "🎙️ Say 'Squidworth' to wake me up!"
        echo "📊 View logs: tail -f $VOICE_LOG"
        return 0
    else
        echo "❌ Voice Assistant failed to start"
        return 1
    fi
}

stop() {
    echo "🛑 Stopping Squidworth Voice Assistant..."
    
    # Stop Voice Assistant
    if [ -f "$VOICE_PID_FILE" ]; then
        pid=$(cat "$VOICE_PID_FILE")
        if kill -0 $pid 2>/dev/null; then
            kill $pid 2>/dev/null
            sleep 1
            kill -9 $pid 2>/dev/null
            echo "  ✅ Voice Assistant stopped"
        fi
        rm -f "$VOICE_PID_FILE"
    fi
    
    # Stop IPC Bridge
    if [ -f "$IPC_PID_FILE" ]; then
        pid=$(cat "$IPC_PID_FILE")
        if kill -0 $pid 2>/dev/null; then
            kill $pid 2>/dev/null
            sleep 1
            kill -9 $pid 2>/dev/null
            echo "  ✅ IPC Bridge stopped"
        fi
        rm -f "$IPC_PID_FILE"
    fi
    
    # Clean up any remaining processes
    pkill -f "voice-assistant-fast.sh" 2>/dev/null
    
    echo "  🦑 Squidworth is sleeping"
}

status() {
    echo "📊 Squidworth Voice Assistant Status"
    echo "======================================"
    
    # Check IPC
    if ss -tlnp | grep -q ":17171"; then
        echo "✅ IPC Bridge: Running on port 17171"
    else
        echo "❌ IPC Bridge: Not running"
    fi
    
    # Check Voice
    if [ -f "$VOICE_PID_FILE" ]; then
        pid=$(cat "$VOICE_PID_FILE")
        if kill -0 $pid 2>/dev/null; then
            echo "✅ Voice Assistant: Running (PID: $pid)"
        else
            echo "❌ Voice Assistant: Stopped (stale PID file)"
            rm -f "$VOICE_PID_FILE"
        fi
    else
        echo "❌ Voice Assistant: Not running"
    fi
    
    # Show recent activity
    echo ""
    echo "📝 Recent Activity:"
    if [ -f "$VOICE_LOG" ]; then
        tail -5 "$VOICE_LOG" 2>/dev/null | grep -E "(Heard|WAKE|Squidworth)" | tail -3
    else
        echo "   No log file found"
    fi
}

restart() {
    stop
    sleep 2
    start
}

# Main
case "${1:-status}" in
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
    *)
        echo "Usage: $0 [start|stop|restart|status]"
        echo ""
        echo "Commands:"
        echo "  start   - Start voice assistant"
        echo "  stop    - Stop voice assistant"
        echo "  restart - Restart voice assistant"
        echo "  status  - Check status (default)"
        exit 1
        ;;
esac
