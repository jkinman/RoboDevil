const test = require("node:test");
const assert = require("node:assert");
const { chooseProvider } = require("../src/router");
const { fetchResponses } = require("../src/responsePoller");
const { estimatePlaybackMs } = require("../src/playbackEstimator");
const http = require("http");

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

test("fetchResponses returns array", async () => {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/responses") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ responses: [{ text: "hi" }] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const responses = await fetchResponses({ host: "127.0.0.1", port });
  assert.equal(responses.length, 1);
  server.close();
});

test("estimatePlaybackMs scales with text length", () => {
  const short = estimatePlaybackMs("hi");
  const long = estimatePlaybackMs("x".repeat(300));
  assert.ok(long > short);
});
