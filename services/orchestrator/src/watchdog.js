function shouldResetState(current, nowIso) {
  if (!current || !current.expiresAt) {
    return false;
  }

  const now = Date.parse(nowIso);
  const expiresAt = Date.parse(current.expiresAt);
  if (Number.isNaN(now) || Number.isNaN(expiresAt)) {
    return false;
  }

  return now >= expiresAt;
}

function resetToIdle() {
  return {
    state: "idle",
    expiresAt: null
  };
}

module.exports = { shouldResetState, resetToIdle };
