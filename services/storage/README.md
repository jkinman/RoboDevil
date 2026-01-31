# Storage Service

SQLite access layer for structured data IO. This service owns the database file
and provides a simple API for other services to write/read events, tasks, and
state logs.

## Status
- HTTP endpoints: `GET /health`, `GET /events`, `POST /events`.
- Migrations in `migrations/` with `_migrations` tracking.
- Unit tests cover health + event writes.
- Migration draft includes conversations, messages, actions tables.
- Event retention cleanup runs hourly (default 30 days).

## Planned
- IPC integration (optional). Local-only UNIX socket for internal services if we later want to avoid HTTP.
- Additional data tables as requirements solidify.
