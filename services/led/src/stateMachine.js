const DEFAULT_STATE = {
  state: "idle",
  expiresAt: null,
  source: "led"
};

function normalizeStateUpdate(update) {
  if (!update || typeof update !== "object") {
    return null;
  }

  const { state, expiresAt, source } = update;
  if (!state || !source) {
    return null;
  }

  return {
    state,
    expiresAt: expiresAt || null,
    source
  };
}

function shouldExpire(current, nowIso) {
  if (!current.expiresAt) {
    return false;
  }

  const now = Date.parse(nowIso);
  const expiresAt = Date.parse(current.expiresAt);
  if (Number.isNaN(now) || Number.isNaN(expiresAt)) {
    return false;
  }

  return now >= expiresAt;
}

function applyUpdate(current, update) {
  const normalized = normalizeStateUpdate(update);
  if (!normalized) {
    return current;
  }

  return {
    ...current,
    ...normalized
  };
}

module.exports = {
  DEFAULT_STATE,
  normalizeStateUpdate,
  shouldExpire,
  applyUpdate
};
