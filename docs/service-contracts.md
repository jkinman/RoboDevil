# Service Responsibilities and Event Contracts

## STT Service
**Responsibility:** Capture mic audio, transcribe via Whisper, forward text to OpenClaw.

**Emits:**
- `listening` on wakeword / mic capture start.
- `thinking` after transcript is finalized and sent to OpenClaw.
- `idle` on cancel / error / no speech.

**Consumes:** none (mic input only).

**Health:**
- Provide a health snapshot for dashboard (`status`, `uptimeSec`, `lastHeartbeat`).

## OpenClaw Core
**Responsibility:** Process text requests, generate responses, emit response events.

**Emits:**
- `response_ready` event to TTS router with response text + metadata.

**Consumes:**
- Text input from STT service and WhatsApp integration.

**Health:**
- Provide a health snapshot for dashboard (`status`, `uptimeSec`, `lastHeartbeat`).

## TTS Router
**Responsibility:** Choose TTS provider, synthesize audio, play output.

**Emits:**
- `talking` while playback is active.
- `idle` after playback completes.

**Consumes:**
- `response_ready` from OpenClaw.
- Optional system telemetry (internet status, CPU load).

**Health:**
- Provide a health snapshot for dashboard (`status`, `uptimeSec`, `lastHeartbeat`).

## LED Controller
**Responsibility:** Own GPIO/PWM and render visual state.

**Consumes:**
- All state updates (`idle`, `listening`, `thinking`, `talking`).

**Emits:**
- Optional heartbeat or `idle` fail-safe when state expires.

**Health:**
- Provide a health snapshot for dashboard (`status`, `uptimeSec`, `lastHeartbeat`).

## Orchestrator (Optional)
**Responsibility:** Validate state flow; enforce timeouts across services.

**Consumes:** All state updates.
**Emits:** `idle` on stuck-state recovery.

**Health:**
- Provide a health snapshot for dashboard (`status`, `uptimeSec`, `lastHeartbeat`).

## Storage Service
**Responsibility:** Own SQLite database and provide structured data access.

**Emits:** none (initially).
**Consumes:** write/read requests from other services (future IPC).

**Health:**
- Provide a health snapshot for dashboard (`status`, `uptimeSec`, `lastHeartbeat`, `dbPath`).
