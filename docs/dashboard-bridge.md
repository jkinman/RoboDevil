# Dashboard Bridge (Localhost HTTP)

Local-only HTTP API intended for a future dashboard. This endpoint is a thin
bridge that reads/writes to the internal IPC layer (UNIX socket). It is not
exposed publicly.

## Goals
- View logs and aggregated stats.
- Show Pi diagnostics (CPU, memory, storage).
- Configure assistant behavior (TTS modes, wake words, custom actions).

## Transport
- HTTP only, bound to `127.0.0.1`.
- Default port: `17171` (configurable via `ipc.httpPort`).

## Endpoints (Draft)

### GET /health
Returns basic status for each service.

Planned response fields (per service):
- `name`
- `status` (ok|degraded|down)
- `uptimeSec`
- `lastHeartbeat`
- `version`
- `details` (optional, service-specific)

### GET /stats
Aggregated metrics:
- `cpuPercent`, `memoryUsedMb`, `diskUsedMb`
- `sttLatencyMs`, `ttsLatencyMs`
- `eventsPerHour`, `errorsPerHour`

### GET /logs
Query logs with filters:
- `service`, `level`, `since`, `limit`

Supported IPC filters:
- `state`, `source`, `since`, `limit`, `offset`

### POST /config
Update config fields:
- `tts.mode`, `tts.demonicIntensity`, `wakeWords`, `customActions`

### GET /config
Return current config snapshot.

## Notes
- Log aggregation should be derived from the storage service.
- Metrics can be sampled by the orchestrator or a dedicated metrics collector.
- Use IPC bridge directly for local dashboards. Add a proxy backend only if remote access or stronger auth is needed later.
