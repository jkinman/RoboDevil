const test = require("node:test");
const assert = require("node:assert");
const { chooseProvider } = require("../src/router");

test("routes to local when offline", () => {
  const result = chooseProvider({ networkOnline: false });
  assert.equal(result.provider, "local");
});

test("routes to inworld for high impact", () => {
  const result = chooseProvider({ demonicIntensity: "high" });
  assert.equal(result.provider, "inworld");
});

test("routes long responses to local", () => {
  const result = chooseProvider({ length: 800 });
  assert.equal(result.provider, "local");
});
