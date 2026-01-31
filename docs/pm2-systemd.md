# pm2 + systemd Startup Plan

## pm2 Ecosystem
Define all services in `pm2.ecosystem.config.js`:
- `stt`
- `tts-router`
- `led`
- `orchestrator` (optional)

Each service should include:
- `script`: entry file
- `cwd`: service directory
- `env`: config path and runtime flags
- `restart`: always
- `max_restarts`: 10
- `exp_backoff_restart_delay`: 2000

## systemd Startup
Use pm2's systemd integration:
1. `pm2 startup systemd`
2. `pm2 save`

Ensure startup order:
- systemd starts pm2 on boot.
- pm2 launches services in defined order.

## Logging
- pm2 logs per service (`~/.pm2/logs/`).
- Optional: forward to journald if needed.

## Health Checks
- Each service emits heartbeat logs at a low cadence (e.g., 30s).
- Orchestrator watches for missing heartbeats and forces `idle`.
