const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const path = require("path");
const { createDatabase, runMigrations } = require("../src/db");
const { createServer } = require("../src/server");
const migrationsDir = path.resolve(__dirname, "../migrations");

function requestJson({ method, port, path, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        host: "127.0.0.1",
        port,
        path,
        headers: {
          "Content-Type": "application/json"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        });
      }
    );

    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test("storage server health endpoint returns ok", async () => {
  const db = createDatabase(":memory:");
  runMigrations(db, migrationsDir);
  const server = createServer({ db });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const response = await requestJson({
    method: "GET",
    port,
    path: "/health"
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "ok");
  server.close();
});

test("storage server accepts event writes", async () => {
  const db = createDatabase(":memory:");
  runMigrations(db, migrationsDir);
  const server = createServer({ db });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const response = await requestJson({
    method: "POST",
    port,
    path: "/events",
    body: { type: "test", payload: { value: 1 } }
  });

  assert.equal(response.statusCode, 200);
  const list = await requestJson({
    method: "GET",
    port,
    path: "/events"
  });
  assert.equal(list.body.events.length, 1);
  server.close();
});
