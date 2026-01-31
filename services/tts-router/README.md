# TTS Router

Selects TTS provider (Inworld primary, local fallback), plays audio, and emits
`talking`/`idle` state updates.

## Status
- Routing rules implemented in `src/router.js`.
- Unit tests verify provider selection.
- Runtime currently accepts JSON over stdin for manual testing.

## Planned
- Audio playback + provider API integrations.
 - Replace stdin testing with IPC subscription.
