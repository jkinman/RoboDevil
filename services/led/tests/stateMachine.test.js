const test = require("node:test");
const assert = require("node:assert");
const {
  DEFAULT_STATE,
  normalizeStateUpdate,
  shouldExpire,
  applyUpdate
} = require("../src/stateMachine");

test("normalizeStateUpdate rejects invalid payload", () => {
  const result = normalizeStateUpdate({ state: "idle" });
  assert.equal(result, null);
});

test("normalizeStateUpdate accepts valid payload", () => {
  const result = normalizeStateUpdate({
    state: "thinking",
    source: "stt",
    expiresAt: "2026-01-31T00:00:10Z"
  });
  assert.equal(result.state, "thinking");
});

test("shouldExpire returns true when expired", () => {
  const current = {
    state: "thinking",
    source: "stt",
    expiresAt: "2026-01-31T00:00:00Z"
  };
  assert.equal(shouldExpire(current, "2026-01-31T00:00:01Z"), true);
});

test("applyUpdate merges state", () => {
  const updated = applyUpdate(DEFAULT_STATE, {
    state: "listening",
    source: "stt"
  });
  assert.equal(updated.state, "listening");
});
