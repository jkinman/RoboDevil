#!/bin/bash
# Squidworth Health Check Script
# Integrates with OpenClaw health check protocol

ROBODEVIL_DIR="/home/jkinman/RoboDevil"
LOG_FILE="/tmp/squidworth-health.log"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

log "🦑 Squidworth Health Check - $(date)"
log "=========================================="

# Check 1: Voice Assistant Process
log "\n📊 Checking Voice Assistant Process..."
if pgrep -f "voice-assistant" > /dev/null; then
    log "${GREEN}✅ Voice Assistant is running${NC}"
else
    log "${RED}❌ Voice Assistant is NOT running${NC}"
    log "   Start with: ./voice-control.sh start"
fi

# Check 2: IPC Bridge
log "\n🌉 Checking IPC Bridge..."
if curl -s http://localhost:17171/ > /dev/null 2>&1; then
    log "${GREEN}✅ IPC Bridge responding on port 17171${NC}"
else
    log "${RED}❌ IPC Bridge not responding${NC}"
fi

# Check 3: Whisper Server
log "\n🎙️  Checking Whisper Server..."
if pgrep -f "whisper-server" > /dev/null; then
    log "${GREEN}✅ Whisper Server is running${NC}"
else
    log "${RED}❌ Whisper Server is NOT running${NC}"
    log "   Start with: ./whisper-server-control.sh start"
fi

# Check 4: Home Assistant
log "\n🏠 Checking Home Assistant..."
if curl -s http://localhost:8123/api/ > /dev/null 2>&1; then
    log "${GREEN}✅ Home Assistant responding${NC}"
else
    log "${RED}❌ Home Assistant not responding${NC}"
fi

# Check 5: Environment Variables
log "\n🔐 Checking Environment Variables..."
if [ -n "$HOME_ASSISTANT_TOKEN" ]; then
    log "${GREEN}✅ HOME_ASSISTANT_TOKEN is set${NC}"
else
    log "${RED}❌ HOME_ASSISTANT_TOKEN is missing${NC}"
fi

if [ -n "$INWORLD_BASIC" ]; then
    log "${GREEN}✅ INWORLD_BASIC is set${NC}"
else
    log "${RED}❌ INWORLD_BASIC is missing${NC}"
fi

# Check 6: Run Jest Test Suite
log "\n🧪 Running Test Suite..."
cd "$ROBODEVIL_DIR"
if npm test > /tmp/jest-output.log 2>&1; then
    log "${GREEN}✅ All tests passed${NC}"
else
    log "${RED}❌ Some tests failed${NC}"
    log "   Run 'npm test' for details"
fi

# Check 7: Disk Space
log "\n💾 Checking Disk Space..."
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    log "${GREEN}✅ Disk usage: ${DISK_USAGE}%${NC}"
else
    log "${YELLOW}⚠️  Disk usage high: ${DISK_USAGE}%${NC}"
fi

# Check 8: Memory Usage
log "\n🧠 Checking Memory..."
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEMORY_USAGE" -lt 80 ]; then
    log "${GREEN}✅ Memory usage: ${MEMORY_USAGE}%${NC}"
else
    log "${YELLOW}⚠️  Memory usage high: ${MEMORY_USAGE}%${NC}"
fi

# Summary
log "\n=========================================="
log "📋 Health Check Complete - $(date)"
log "=========================================="
log "📄 Full log: $LOG_FILE"
log "🧪 Test output: /tmp/jest-output.log"
log ""
log "To schedule automatic health checks:"
log "  openclaw cron add --name 'squidworth:health-check' --schedule '0 */6 * * *' --command './health-check.sh'"
