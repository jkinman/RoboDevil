const fs = require("fs");
const net = require("net");
const http = require("http");
const path = require("path");
const { validateMessage } = require("./validateMessage");
const { sendEvent } = require("./storageClient");

const unixSocketPath = process.env.IPC_SOCKET_PATH || "/tmp/robodevil_state.sock";
const httpHost = process.env.IPC_HTTP_HOST || "127.0.0.1";
const httpPort = Number(process.env.IPC_HTTP_PORT || 17171);
const authToken = process.env.IPC_AUTH_TOKEN || null;
const storageHost = process.env.STORAGE_HTTP_HOST || "127.0.0.1";
const storagePort = Number(process.env.STORAGE_HTTP_PORT || 17172);

const stateHistory = [];
const maxHistory = 200;
const responseQueue = [];
const healthMap = new Map();

function recordState(entry) {
  stateHistory.push(entry);
  if (stateHistory.length > maxHistory) {
    stateHistory.shift();
  }
}

function forwardToStorage(entry) {
  const event = {
    type: "state_update",
    payload: entry
  };

  sendEvent({ host: storageHost, port: storagePort, event });
}

function parseJsonBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    try {
      const parsed = JSON.parse(body || "{}");
      callback(null, parsed);
    } catch (error) {
      callback(error);
    }
  });
}

function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json)
  });
  res.end(json);
}

function isAuthorized(req) {
  if (!authToken) {
    return true;
  }
  const header = req.headers["authorization"];
  return header === `Bearer ${authToken}`;
}

function createHttpServer() {
  return http.createServer((req, res) => {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: "unauthorized" });
    }
    if (req.method === "GET" && req.url === "/health") {
      const services = Array.from(healthMap.values());
      return sendJson(res, 200, {
        name: "ipc-bridge",
        status: "ok",
        uptimeSec: Math.floor(process.uptime()),
        lastHeartbeat: new Date().toISOString(),
        services
      });
    }

    if (req.method === "GET" && req.url === "/stats") {
      return sendJson(res, 200, {
        stateHistoryCount: stateHistory.length
      });
    }

    if (req.method === "GET" && req.url === "/logs") {
      return sendJson(res, 200, {
        entries: stateHistory.slice(-50)
      });
    }

    if (req.method === "POST" && req.url === "/responses") {
      return parseJsonBody(req, (error, payload) => {
        if (error) {
          return sendJson(res, 400, { error: "invalid json" });
        }

        if (!payload || typeof payload.text !== "string") {
          return sendJson(res, 400, { error: "text is required" });
        }

        responseQueue.push({ ...payload, receivedAt: new Date().toISOString() });
        return sendJson(res, 200, { ok: true });
      });
    }

    if (req.method === "GET" && req.url === "/responses") {
      const responses = responseQueue.splice(0, responseQueue.length);
      return sendJson(res, 200, { responses });
    }

    if (req.method === "POST" && req.url === "/state") {
      return parseJsonBody(req, (error, payload) => {
        if (error) {
          return sendJson(res, 400, { error: "invalid json" });
        }

        const result = validateMessage(payload);
        if (!result.ok) {
          return sendJson(res, 400, { error: result.error });
        }

        const entry = { ...payload, receivedAt: new Date().toISOString() };
        recordState(entry);
        forwardToStorage(entry);
        return sendJson(res, 200, { ok: true });
      });
    }

    if (req.method === "POST" && req.url === "/health") {
      return parseJsonBody(req, (error, payload) => {
        if (error) {
          return sendJson(res, 400, { error: "invalid json" });
        }

        if (!payload || typeof payload.name !== "string") {
          return sendJson(res, 400, { error: "name is required" });
        }

        const entry = {
          ...payload,
          receivedAt: new Date().toISOString()
        };
        healthMap.set(payload.name, entry);
        return sendJson(res, 200, { ok: true });
      });
    }

    if (req.method === "GET" && req.url === "/config") {
      return sendJson(res, 200, {
        ipc: {
          transport: "dual",
          socketPath: unixSocketPath,
          httpHost,
          httpPort
        }
      });
    }

    if (req.method === "POST" && req.url === "/config") {
      return sendJson(res, 501, { error: "config updates not implemented" });
    }

    return sendJson(res, 404, { error: "not found" });
  });
}

function createUnixServer() {
  if (fs.existsSync(unixSocketPath)) {
    fs.unlinkSync(unixSocketPath);
  }

  return net.createServer((socket) => {
    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString();
    });
    socket.on("end", () => {
      let payload = null;
      try {
        payload = JSON.parse(data);
      } catch (error) {
        socket.write(JSON.stringify({ error: "invalid json" }));
        return socket.end();
      }

      if (authToken && payload?.token !== authToken) {
        socket.write(JSON.stringify({ error: "unauthorized" }));
        return socket.end();
      }

      const result = validateMessage(payload);
      if (!result.ok) {
        socket.write(JSON.stringify({ error: result.error }));
        return socket.end();
      }

      const entry = { ...payload, receivedAt: new Date().toISOString() };
      recordState(entry);
      forwardToStorage(entry);
      socket.write(JSON.stringify({ ok: true }));
      socket.end();
    });
  });
}

const httpServer = createHttpServer();
httpServer.listen(httpPort, httpHost, () => {
  console.log("[ipc-bridge] HTTP listening", { httpHost, httpPort });
});

const unixServer = createUnixServer();
unixServer.listen(unixSocketPath, () => {
  console.log("[ipc-bridge] UNIX socket listening", { unixSocketPath });
});
