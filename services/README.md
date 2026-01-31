# Services

Each service is isolated but lives in this monorepo for easy development and
deployment on the Raspberry Pi. All services should expose a `/health` endpoint
or equivalent health snapshot for the dashboard.

## Services
- `stt` — mic capture + Whisper transcription (placeholder)
- `tts-router` — provider selection + audio playback (router skeleton + tests)
- `led` — GPIO/PWM state renderer (state machine + expiry tests)
- `orchestrator` — watchdog/state recovery (expiry tests)
- `storage` — SQLite access layer (HTTP endpoints + migrations)
- `ipc-bridge` — UNIX socket + localhost HTTP state bridge (auth + validation)
