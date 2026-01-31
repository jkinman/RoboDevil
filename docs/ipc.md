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
- **Dual transport** (recommended):
  - UNIX socket for service-to-service IPC.
  - Localhost HTTP/TCP for dashboard access.
- UNIX socket path: `/tmp/robodevil_state.sock`.
- Localhost endpoint: `127.0.0.1:17171` (TCP) or `http://127.0.0.1:17171` (HTTP).

### Dashboard Note
Browsers cannot connect to UNIX sockets. If you plan a local dashboard,
expose a localhost-only HTTP endpoint (not public) that bridges to the
internal UNIX socket layer.

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
