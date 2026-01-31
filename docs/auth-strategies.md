# Auth Strategies (Notes)

These notes cover authentication choices for local services and future remote
messaging integrations. This is planning-only.

## Local IPC + Dashboard
- **Local-only by default**: bind to `127.0.0.1`, avoid public exposure.
- **Auth token**: simple shared secret for HTTP and UNIX socket messages.
- **No cookies/sessions** for now; keep stateless.

## Remote Messaging (WhatsApp)
- Use the provider’s built-in auth (QR/session or API keys).
- Keep tokens/keys in `.env` files (never commit).
- Separate accounts for assistant usage (as planned).

## Future Hardening (if needed)
- Add request signing (HMAC) for IPC payloads.
- Rotate tokens on a schedule.
- Optional IP allowlist for any HTTP endpoints.
