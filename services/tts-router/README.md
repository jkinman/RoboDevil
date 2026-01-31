# TTS Router

Selects TTS provider (Inworld primary, local fallback), plays audio, and emits
`talking`/`idle` state updates.

## Status
- Routing rules implemented in `src/router.js`.
- Unit tests verify provider selection.
- Polls IPC bridge `/responses` for OpenClaw output.
- Emits `talking` then `idle` (estimated from text length).
- Strategy/factory layer selects Inworld or Piper fallback.
- Inworld provider supports Basic or JWT auth based on env vars.

## Planned
- Audio playback + provider API integrations.
- Keep polling until it becomes a real bottleneck; consider push-based updates later.
