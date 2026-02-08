#!/bin/bash
# Voice Assistant Control Script

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
PID_FILE="/tmp/voice-assistant.pid"
IPC_PID_FILE="/tmp/ipc-bridge.pid"

start() {
    echo "🦑 Starting Squidworth Voice Assistant..."
    
    # Start IPC Bridge
    echo "  🌉 Starting IPC Bridge..."
    cd "$ROBODEVIL_DIR/services/ipc-bridge"
    nohup node src/index.js > /tmp/ipc-bridge.log 2>&1 &
    echo $! > "$IPC_PID_FILE"
    sleep 2
    echo "  ✅ IPC Bridge running on port 17171"
    
    # Start Skill-Based Voice Assistant
    echo "  🎤 Starting Voice Assistant..."
    cd "$ROBODEVIL_DIR/skills"
    nohup bash voice-loader.sh > /tmp/voice-assistant.log 2>&1 &
    echo $! > "$PID_FILE"
    sleep 2
    echo "  ✅ Voice Assistant running"
    
    echo ""
    echo "🎙️  Say 'Squidworth' to wake me up!"
    echo "📊 View logs: tail -f /tmp/voice-assistant.log"
}

stop() {
    echo "🛑 Stopping Squidworth Voice Assistant..."
    if [ -f "$PID_FILE" ]; then
        kill $(cat "$PID_FILE") 2>/dev/null
        rm -f "$PID_FILE"
        echo "  ✅ Voice Assistant stopped"
    fi
    if [ -f "$IPC_PID_FILE" ]; then
        kill $(cat "$IPC_PID_FILE") 2>/dev/null
        rm -f "$IPC_PID_FILE"
        echo "  ✅ IPC Bridge stopped"
    fi
    echo "  🦑 Squidworth is sleeping"
}

status() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "📊 Squidworth Voice Assistant Status"
        echo "======================================"
        echo "✅ Voice Assistant: Running"
        if [ -f "$IPC_PID_FILE" ] && kill -0 $(cat "$IPC_PID_FILE") 2>/dev/null; then
            echo "✅ IPC Bridge: Running on port 17171"
        fi
        echo ""
        echo "📝 Recent Activity:"
        tail -5 /tmp/voice-assistant.log 2>/dev/null
    else
        echo "❌ Voice Assistant: Not running"
        echo "   Start with: ./voice-control.sh start"
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
        stop
        sleep 2
        start
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
