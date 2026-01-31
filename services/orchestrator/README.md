# Orchestrator (Optional)

Central watchdog that monitors state heartbeats and forces `idle` on stuck
states. Useful if you want extra safety beyond LED timeouts.

## Status
- Watchdog expiry logic implemented in `src/watchdog.js`.
- Unit tests cover reset behavior.
- Polls IPC `/logs` to track latest state.
- Emits `idle` via IPC on timeout.

## Planned
- Reduce polling once push-based updates exist.
