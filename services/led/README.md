# LED Service

Owns GPIO/PWM, renders `idle`, `listening`, `thinking`, `talking` states, and
fails safe to `idle` on timeout.

## Status
- State machine and expiry logic implemented in `src/stateMachine.js`.
- Unit tests cover normalize/apply/expire behavior.
- Polls IPC `/logs` for current state.
- Runtime accepts JSON over stdin for manual testing.

## Planned
- GPIO/PWM hardware integration.
- Reduce polling once push-based updates exist.
