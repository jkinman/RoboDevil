const test = require("node:test");
const assert = require("node:assert");
const { buildStatePayload } = require("../src/ipcClient");
const { buildRecordCommand } = require("../src/recorder");
const { buildWhisperCommand } = require("../src/transcriber");

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

test("buildRecordCommand uses defaults", () => {
  const cmd = buildRecordCommand({ seconds: 3, outputPath: "/tmp/a.wav" });
  assert.ok(cmd.includes("sox"));
  assert.ok(cmd.includes("/tmp/a.wav"));
});

test("buildWhisperCommand builds cli string", () => {
  const cmd = buildWhisperCommand({
    bin: "/usr/bin/whisper",
    model: "/tmp/model.bin",
    input: "/tmp/a.wav"
  });
  assert.ok(cmd.includes("/usr/bin/whisper"));
  assert.ok(cmd.includes("/tmp/model.bin"));
  assert.ok(cmd.includes("/tmp/a.wav"));
});
