# Services

Each service is isolated but lives in this monorepo for easy development and
deployment on the Raspberry Pi.

## Services
- `stt` — mic capture + Whisper transcription
- `tts-router` — provider selection + audio playback
- `led` — GPIO/PWM state renderer
- `orchestrator` — optional watchdog/state recovery
- `storage` — SQLite access layer for structured data IO
- `ipc-bridge` — UNIX socket + localhost HTTP state bridge
