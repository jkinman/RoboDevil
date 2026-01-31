# TTS Router

Selects TTS provider (Inworld primary, local fallback), plays audio, and emits
`talking`/`idle` state updates.

## Status
- Routing rules implemented in `src/router.js`.
- Unit tests verify provider selection.
- Polls IPC bridge `/responses` for OpenClaw output.

## Planned
- Audio playback + provider API integrations.
- Remove polling in favor of push-based updates if needed.
