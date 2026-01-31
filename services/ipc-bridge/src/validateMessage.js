const REQUIRED_FIELDS = ["state", "source", "timestamp", "expiresAt", "sessionId"];

function validateMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload must be an object" };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in payload)) {
      return { ok: false, error: `missing field: ${field}` };
    }
  }

  return { ok: true };
}

module.exports = { validateMessage };
