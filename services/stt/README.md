# STT Service

Mic capture + Whisper transcription. Emits `listening`, `thinking`, `idle` states
and forwards text to OpenClaw.

## Status
- Placeholder implementation only.
- `tests/placeholder.test.js` ensures test harness coverage.
- Basic mic capture + whisper.cpp CLI integration added (requires local tools).
- OpenClaw Gateway HTTP endpoint must be enabled (`responses` or `chat`).

## Planned
- Whisper model integration and wake word support.
 - Refine state payload details for IPC.
