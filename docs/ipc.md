# IPC Schema and State Contracts

## Message Schema

All state updates use a single JSON message shape.

```json
{
  "state": "idle|listening|thinking|talking",
  "source": "stt|openclaw|tts-router|led|orchestrator",
  "timestamp": "2026-01-31T18:04:00Z",
  "expiresAt": "2026-01-31T18:04:10Z",
  "sessionId": "uuid-or-timestamp",
  "details": {
    "reason": "wakeword|transcribed|response|playback",
    "meta": {
      "latencyMs": 240,
      "audioSeconds": 5.2
    }
  }
}
```

## Transport
- Preferred: UNIX socket at `/tmp/robodevil_state.sock`.
- Alternative: localhost TCP (`127.0.0.1:17171`) if socket permissions are an issue.

## Allowed State Transitions
- `idle → listening → thinking → talking → idle`
- `idle → listening → idle` (cancel / no speech)
- `thinking → idle` (error / timeout / cancellation)

## State Timeouts
- `listening`: 30s default (no input → revert to `idle`)
- `thinking`: 10s default (processing too long → revert to `idle`)
- `talking`: audio length + 3s (playback end + buffer)

## Fail-Safe Behavior
- LED controller must revert to `idle` when `expiresAt` is reached.
- Orchestrator may emit `idle` if no valid update within 2x timeout window.
