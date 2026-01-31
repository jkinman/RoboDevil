function buildStatePayload({ state, source, expiresAt }) {
  const now = new Date().toISOString();
  return {
    state,
    source,
    timestamp: now,
    expiresAt: expiresAt || now,
    sessionId: now,
    details: {}
  };
}

module.exports = { buildStatePayload };
