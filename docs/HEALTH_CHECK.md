# Squidworth Health Check Protocol

## Overview

The health check protocol ensures Squidworth (the voice assistant) is functioning correctly and all dependencies are available. It follows OpenClaw's health check standards while adding voice-assistant-specific checks.

## Health Check Levels

### Level 1: Quick Status (30 seconds)
Basic process and connectivity checks:
- Voice assistant process running
- IPC Bridge responding
- Whisper server available
- Home Assistant reachable

### Level 2: Functional Tests (2 minutes)
Test actual functionality:
- Skill system loads correctly
- Simple skill execution works
- Node skill execution works
- Environment variables set

### Level 3: Integration Tests (5 minutes)
Full end-to-end tests:
- Voice path: Recording → Transcription → Skill → TTS
- Light control via Home Assistant
- Error handling and recovery

## Running Health Checks

### Manual Check
```bash
# Quick shell-based check
./health-check.sh

# Full Node.js test suite
npm run test:health

# Jest test suite
npm test
```

### Automated Scheduling
```bash
# Schedule health check every 6 hours
openclaw cron add \
  --name 'squidworth:health-check' \
  --schedule '0 */6 * * *' \
  --command './health-check.sh'

# Schedule daily full test suite
openclaw cron add \
  --name 'squidworth:full-test' \
  --schedule '0 2 * * *' \
  --command 'npm run test:health'
```

## Health Check Components

### 1. Process Health
| Check | Command | Expected |
|-------|---------|----------|
| Voice Assistant | `pgrep voice-assistant` | Process exists |
| IPC Bridge | `curl localhost:17171` | HTTP 200 |
| Whisper Server | `pgrep whisper-server` | Process exists |
| Home Assistant | `curl localhost:8123/api/` | HTTP 401 or 200 |

### 2. Environment Health
| Variable | Purpose | Check |
|----------|---------|-------|
| `HOME_ASSISTANT_TOKEN` | HA API access | Non-empty |
| `INWORLD_BASIC` | TTS service | Non-empty |
| `MATON_API_KEY` | Gmail integration | Non-empty |

### 3. Skill System Health
```javascript
// Load all skills
const loader = new HybridSkillLoader('./skills');
await loader.load();

// Verify skills loaded
const skills = loader.listSkills();
assert(skills.simple.length > 0, 'Simple skills loaded');
assert(skills.node.length > 0, 'Node skills loaded');

// Test skill execution
const result = await loader.execute('what time is it', {});
assert(result.includes('M'), 'Time skill works');
```

### 4. Integration Health
```javascript
// Full voice path test
const audioFile = await recordAudio(3000); // 3 seconds
const text = await transcribe(audioFile);
assert(text.length > 0, 'Transcription works');

const response = await processCommand(text);
assert(response.length > 0, 'Skill execution works');

await speak(response); // TTS works
```

## Test Files

```
tests/
├── setup.js                 # Jest configuration
├── health-check.test.js     # Main health check suite
├── unit/
│   ├── skill-loader.test.js # Skill system unit tests
│   └── lights.test.js       # Light control unit tests
└── integration/
    ├── voice-path.test.js   # End-to-end voice path
    └── ha-integration.test.js # Home Assistant tests
```

## Interpreting Results

### ✅ Healthy
All checks pass:
- All processes running
- All services responding
- All tests passing
- Environment variables set

### ⚠️ Degraded
Some non-critical failures:
- Optional service down (e.g., presence monitor)
- High memory usage (>80%)
- High disk usage (>80%)

### ❌ Critical
Core functionality failing:
- Voice assistant process down
- IPC Bridge not responding
- Home Assistant unreachable
- Required environment variables missing

## Remediation

### Automatic Recovery
```bash
# Restart failed services
./voice-control.sh restart

# Clear logs and temp files
rm -f /tmp/voice-assistant.log
rm -f /tmp/tts-response.mp3

# Reinstall dependencies if needed
npm install
```

### Manual Intervention
1. Check logs: `tail -f /tmp/voice-assistant.log`
2. Verify environment: `cat .env`
3. Test services individually
4. Restart: `./voice-control.sh restart`

## Integration with OpenClaw

The health check integrates with OpenClaw's healthcheck skill:

```bash
# Run OpenClaw security audit
openclaw security audit

# Check OpenClaw version
openclaw update status

# Schedule periodic checks
openclaw cron add \
  --name 'healthcheck:full' \
  --schedule '0 */6 * * *' \
  --command 'cd ~/RoboDevil && ./health-check.sh'
```

## Logging

Health check results are logged to:
- `/tmp/squidworth-health.log` - Shell health checks
- `/tmp/jest-output.log` - Jest test results
- `memory/YYYY-MM-DD.md` - Persistent health records

## Alerting

When scheduled via cron, failures trigger notifications:
```bash
# In health-check.sh
if [ $FAILED -gt 0 ]; then
  echo "🚨 Squidworth health check failed!" | \
    message send --target @joel
fi
```
