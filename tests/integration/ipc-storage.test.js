const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function waitForHealthy(port, pathName) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      const req = http.request(
        { method: "GET", host: "127.0.0.1", port, path: pathName },
        (res) => {
          if (res.statusCode === 200) {
            res.resume();
            return resolve();
          }
          res.resume();
          if (Date.now() - start > 5000) {
            return reject(new Error("health timeout"));
          }
          setTimeout(poll, 100);
        }
      );
      req.on("error", () => {
        if (Date.now() - start > 5000) {
          return reject(new Error("health timeout"));
        }
        setTimeout(poll, 100);
      });
      req.end();
    };
    poll();
  });
}

function requestJson({ method, port, pathName, body }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        method,
        host: "127.0.0.1",
        port,
        path: pathName,
        headers: data
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(data)
            }
          : {}
      },
      (res) => {
        let output = "";
        res.on("data", (chunk) => {
          output += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: output ? JSON.parse(output) : {} });
        });
      }
    );
    req.on("error", reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

test("IPC forwards state updates to storage events", async () => {
  const ipcPort = await getFreePort();
  const storagePort = await getFreePort();
  const dbPath = path.resolve(__dirname, "../../tmp/test.db");

  const env = {
    ...process.env,
    IPC_HTTP_PORT: String(ipcPort),
    IPC_HTTP_HOST: "127.0.0.1",
    STORAGE_HTTP_PORT: String(storagePort),
    STORAGE_HTTP_HOST: "127.0.0.1",
    STORAGE_DB_PATH: dbPath
  };

  const storage = spawn("node", ["services/storage/src/index.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env,
    stdio: "ignore"
  });

  const ipc = spawn("node", ["services/ipc-bridge/src/index.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env,
    stdio: "ignore"
  });

  try {
    await waitForHealthy(storagePort, "/health");
    await waitForHealthy(ipcPort, "/health");

    const state = {
      state: "thinking",
      source: "test",
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000).toISOString(),
      sessionId: "itest"
    };
    const post = await requestJson({
      method: "POST",
      port: ipcPort,
      pathName: "/state",
      body: state
    });
    assert.equal(post.status, 200);

    const events = await requestJson({
      method: "GET",
      port: storagePort,
      pathName: "/events"
    });
    assert.equal(events.status, 200);
    assert.ok(
      events.body.events.some((event) => event.type === "state_update")
    );
  } finally {
    ipc.kill("SIGTERM");
    storage.kill("SIGTERM");
  }
});
