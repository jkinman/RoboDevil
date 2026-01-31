# IPC Bridge

Local IPC entrypoint that accepts state updates over:
- UNIX socket for service-to-service
- Localhost HTTP for dashboard access

This service is intentionally minimal and keeps only a small in-memory history.

## Status
- Accepts `/state` via HTTP and UNIX socket.
- Accepts `/responses` via HTTP for TTS routing.
- Optional auth token (`IPC_AUTH_TOKEN`) for HTTP and socket payloads.
- Message validation enforces required fields + allowed states.

## Planned
- Expose richer `/stats` aggregation for dashboard.
