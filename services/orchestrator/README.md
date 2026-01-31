# Orchestrator (Optional)

Central watchdog that monitors state heartbeats and forces `idle` on stuck
states. Useful if you want extra safety beyond LED timeouts.

## Status
- Watchdog expiry logic implemented in `src/watchdog.js`.
- Unit tests cover reset behavior.
- Runtime accepts JSON over stdin for manual testing.

## Planned
- IPC subscription for state updates.
- Emit `idle` back through IPC on timeout.
