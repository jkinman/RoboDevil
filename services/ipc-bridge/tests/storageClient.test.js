const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { sendEvent } = require("../src/storageClient");

test("sendEvent posts to storage endpoint", async () => {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/events") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const ok = await sendEvent({
    host: "127.0.0.1",
    port,
    event: { type: "state_update", payload: {} }
  });

  assert.equal(ok, true);
  server.close();
});

test("responses endpoint accepts text", async () => {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/responses") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  await new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "POST",
        host: "127.0.0.1",
        port,
        path: "/responses",
        headers: {
          "Content-Type": "application/json"
        }
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res.statusCode));
      }
    );

    req.on("error", reject);
    req.write(JSON.stringify({ text: "hi" }));
    req.end();
  });

  server.close();
});

test("health endpoint accepts service status", async () => {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  await new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "POST",
        host: "127.0.0.1",
        port,
        path: "/health",
        headers: {
          "Content-Type": "application/json"
        }
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res.statusCode));
      }
    );

    req.on("error", reject);
    req.write(JSON.stringify({ name: "test", status: "ok" }));
    req.end();
  });

  server.close();
});

test("logs query filters and paginates", () => {
  const { buildLogPage } = require("../src/logQuery");
  const history = [
    { state: "thinking", source: "stt", timestamp: "2026-01-01T00:00:00Z" },
    { state: "talking", source: "tts-router", timestamp: "2026-01-01T00:00:05Z" },
    { state: "thinking", source: "stt", timestamp: "2026-01-01T00:00:10Z" }
  ];

  const page = buildLogPage(history, {
    limit: 1,
    offset: 0,
    state: "thinking",
    source: "stt"
  });

  assert.equal(page.entries.length, 1);
  assert.equal(page.total, 2);
});
