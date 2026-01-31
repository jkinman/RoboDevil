const test = require("node:test");
const assert = require("node:assert");
const { validateMessage } = require("../src/validateMessage");

test("validateMessage accepts required fields", () => {
  const result = validateMessage({
    state: "idle",
    source: "stt",
    timestamp: "2026-01-31T00:00:00Z",
    expiresAt: "2026-01-31T00:00:10Z",
    sessionId: "abc"
  });

  assert.equal(result.ok, true);
});

test("validateMessage rejects missing fields", () => {
  const result = validateMessage({
    state: "idle"
  });

  assert.equal(result.ok, false);
});
