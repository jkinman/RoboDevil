const test = require("node:test");
const assert = require("node:assert");
const { buildStatePayload } = require("../src/ipcClient");

test("buildStatePayload creates required fields", () => {
  const payload = buildStatePayload({
    state: "listening",
    source: "stt"
  });

  assert.equal(payload.state, "listening");
  assert.equal(payload.source, "stt");
  assert.ok(payload.timestamp);
  assert.ok(payload.expiresAt);
  assert.ok(payload.sessionId);
});
