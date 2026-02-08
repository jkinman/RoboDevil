const fs = require("fs");
const net = require("net");
const http = require("http");
const path = require("path");
const { validateMessage } = require("./validateMessage");
const { buildLogPage } = require("./logQuery");
const { sendEvent } = require("./storageClient");
const { startHealthPing } = require("../../common/healthPing");
const { getConfig } = require("../../common/config");

const config = getConfig();
const unixSocketPath = config.ipc.socketPath;
const httpHost = config.ipc.httpHost;
const httpPort = config.ipc.httpPort;
const authToken = process.env.IPC_AUTH_TOKEN || null;
const storageHost = config.storage.httpHost;
const storagePort = config.storage.httpPort;

const stateHistory = [];
const maxHistory = 200;
const responseQueue = [];
const commandQueue = [];
const healthMap = new Map();

// NEW: AI Response Queue for voice assistant integration
const aiResponseQueue = [];
const aiResponseMaxAge = 60000; // 60 seconds max age for responses

startHealthPing({ name: "ipc-bridge" });

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

    if (req.method === "GET" && req.url.startsWith("/logs")) {
      const url = new URL(req.url, `http://${httpHost}:${httpPort}`);
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 500);
      const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
      const state = url.searchParams.get("state") || null;
      const source = url.searchParams.get("source") || null;
      const since = url.searchParams.get("since") || null;

      const page = buildLogPage(stateHistory, {
        limit,
        offset,
        state,
        source,
        since
      });

      return sendJson(res, 200, page);
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

    if (req.method === "POST" && req.url === "/commands") {
      return parseJsonBody(req, (error, payload) => {
        if (error) {
          return sendJson(res, 400, { error: "invalid json" });
        }

        if (!payload || typeof payload.type !== "string") {
          return sendJson(res, 400, { error: "type is required" });
        }

        commandQueue.push({ ...payload, receivedAt: new Date().toISOString() });
        return sendJson(res, 200, { ok: true });
      });
    }

    if (req.method === "GET" && req.url === "/responses") {
      const responses = responseQueue.splice(0, responseQueue.length);
      return sendJson(res, 200, { responses });
    }

    if (req.method === "GET" && req.url === "/commands") {
      const commands = commandQueue.splice(0, commandQueue.length);
      return sendJson(res, 200, { commands });
    }

    // NEW: AI Response endpoints for voice assistant integration
    if (req.method === "POST" && req.url === "/ai-response") {
      return parseJsonBody(req, (error, payload) => {
        if (error) {
          return sendJson(res, 400, { error: "invalid json" });
        }

        if (!payload || typeof payload.text !== "string") {
          return sendJson(res, 400, { error: "text is required" });
        }

        const sessionId = payload.sessionId || "default";
        aiResponseQueue.push({
          ...payload,
          sessionId,
          receivedAt: new Date().toISOString()
        });
        
        // Clean old responses
        const now = Date.now();
        for (let i = aiResponseQueue.length - 1; i >= 0; i--) {
          const age = now - new Date(aiResponseQueue[i].receivedAt).getTime();
          if (age > aiResponseMaxAge) {
            aiResponseQueue.splice(i, 1);
          }
        }
        
        return sendJson(res, 200, { ok: true });
      });
    }

    if (req.method === "GET" && req.url.startsWith("/ai-response")) {
      const url = new URL(req.url, `http://${httpHost}:${httpPort}`);
      const sessionId = url.searchParams.get("session") || "default";
      
      // Find and return responses for this session
      const responses = [];
      for (let i = aiResponseQueue.length - 1; i >= 0; i--) {
        if (aiResponseQueue[i].sessionId === sessionId) {
          responses.push(aiResponseQueue[i]);
          aiResponseQueue.splice(i, 1);
        }
      }
      
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
