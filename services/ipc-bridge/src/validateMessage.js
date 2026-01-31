const REQUIRED_FIELDS = ["state", "source", "timestamp", "expiresAt", "sessionId"];
const ALLOWED_STATES = new Set(["idle", "listening", "thinking", "talking"]);

function validateMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload must be an object" };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in payload)) {
      return { ok: false, error: `missing field: ${field}` };
    }
  }

  if (!ALLOWED_STATES.has(payload.state)) {
    return { ok: false, error: "invalid state" };
  }

  return { ok: true };
}

module.exports = { validateMessage };
