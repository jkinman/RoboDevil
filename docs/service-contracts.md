# Service Responsibilities and Event Contracts

## STT Service
**Responsibility:** Capture mic audio, transcribe via Whisper, forward text to OpenClaw.

**Emits:**
- `listening` on wakeword / mic capture start.
- `thinking` after transcript is finalized and sent to OpenClaw.
- `idle` on cancel / error / no speech.

**Consumes:** none (mic input only).

## OpenClaw Core
**Responsibility:** Process text requests, generate responses, emit response events.

**Emits:**
- `response_ready` event to TTS router with response text + metadata.

**Consumes:**
- Text input from STT service and WhatsApp integration.

## TTS Router
**Responsibility:** Choose TTS provider, synthesize audio, play output.

**Emits:**
- `talking` while playback is active.
- `idle` after playback completes.

**Consumes:**
- `response_ready` from OpenClaw.
- Optional system telemetry (internet status, CPU load).

## LED Controller
**Responsibility:** Own GPIO/PWM and render visual state.

**Consumes:**
- All state updates (`idle`, `listening`, `thinking`, `talking`).

**Emits:**
- Optional heartbeat or `idle` fail-safe when state expires.

## Orchestrator (Optional)
**Responsibility:** Validate state flow; enforce timeouts across services.

**Consumes:** All state updates.
**Emits:** `idle` on stuck-state recovery.
