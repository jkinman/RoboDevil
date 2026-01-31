const http = require("http");

function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json)
  });
  res.end(json);
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

function createServer({ db }) {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, {
        name: "storage",
        status: "ok",
        uptimeSec: Math.floor(process.uptime()),
        lastHeartbeat: new Date().toISOString()
      });
    }

    if (req.method === "GET" && req.url.startsWith("/events")) {
      const rows = db
        .prepare("SELECT id, created_at, type, payload FROM events ORDER BY id DESC LIMIT 50")
        .all()
        .map((row) => ({
          ...row,
          payload: JSON.parse(row.payload)
        }));

      return sendJson(res, 200, { events: rows.reverse() });
    }

    if (req.method === "POST" && req.url === "/events") {
      return parseJsonBody(req, (error, payload) => {
        if (error) {
          return sendJson(res, 400, { error: "invalid json" });
        }

        if (!payload.type || typeof payload.type !== "string") {
          return sendJson(res, 400, { error: "type is required" });
        }

        const createdAt = new Date().toISOString();
        db.prepare(
          "INSERT INTO events (created_at, type, payload) VALUES (?, ?, ?)"
        ).run(createdAt, payload.type, JSON.stringify(payload.payload || {}));

        return sendJson(res, 200, { ok: true });
      });
    }

    return sendJson(res, 404, { error: "not found" });
  });
}

module.exports = { createServer };
