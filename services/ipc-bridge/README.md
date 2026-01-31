# IPC Bridge

Local IPC entrypoint that accepts state updates over:
- UNIX socket for service-to-service
- Localhost HTTP for dashboard access

This service is intentionally minimal and keeps only a small in-memory history.
