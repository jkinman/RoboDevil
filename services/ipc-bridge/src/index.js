const fs = require("fs");
const net = require("net");
const http = require("http");
const path = require("path");
const { validateMessage } = require("./validateMessage");

const unixSocketPath = process.env.IPC_SOCKET_PATH || "/tmp/robodevil_state.sock";
const httpHost = process.env.IPC_HTTP_HOST || "127.0.0.1";
const httpPort = Number(process.env.IPC_HTTP_PORT || 17171);

const stateHistory = [];
const maxHistory = 200;

function recordState(entry) {
  stateHistory.push(entry);
  if (stateHistory.length > maxHistory) {
    stateHistory.shift();
  }
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

function createHttpServer() {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, {
        name: "ipc-bridge",
        status: "ok",
        uptimeSec: Math.floor(process.uptime()),
        lastHeartbeat: new Date().toISOString()
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

    if (req.method === "POST" && req.url === "/state") {
      return parseJsonBody(req, (error, payload) => {
        if (error) {
          return sendJson(res, 400, { error: "invalid json" });
        }

        const result = validateMessage(payload);
        if (!result.ok) {
          return sendJson(res, 400, { error: result.error });
        }

        recordState({ ...payload, receivedAt: new Date().toISOString() });
        return sendJson(res, 200, { ok: true });
      });
    }

    if (req.method === "GET" && req.url === "/config") {
      return sendJson(res, 200, { message: "config stub" });
    }

    if (req.method === "POST" && req.url === "/config") {
      return sendJson(res, 501, { error: "not implemented" });
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

      const result = validateMessage(payload);
      if (!result.ok) {
        socket.write(JSON.stringify({ error: result.error }));
        return socket.end();
      }

      recordState({ ...payload, receivedAt: new Date().toISOString() });
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
