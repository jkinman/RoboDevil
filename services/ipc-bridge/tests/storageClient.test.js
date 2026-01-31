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
