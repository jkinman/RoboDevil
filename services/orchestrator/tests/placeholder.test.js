const test = require("node:test");
const assert = require("node:assert");
const { shouldResetState, resetToIdle } = require("../src/watchdog");

test("shouldResetState returns false without expiresAt", () => {
  assert.equal(shouldResetState({ state: "thinking" }, new Date().toISOString()), false);
});

test("shouldResetState returns true when expired", () => {
  const current = {
    state: "thinking",
    expiresAt: "2026-01-31T00:00:00Z"
  };
  assert.equal(shouldResetState(current, "2026-01-31T00:00:01Z"), true);
});

test("resetToIdle returns idle state", () => {
  const idle = resetToIdle();
  assert.equal(idle.state, "idle");
});
