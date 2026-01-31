const http = require("http");

function startHealthPing({ name, status = "ok" }) {
  const host = process.env.IPC_HTTP_HOST || "127.0.0.1";
  const port = Number(process.env.IPC_HTTP_PORT || 17171);
  const token = process.env.IPC_AUTH_TOKEN || null;
  const intervalSec = Number(process.env.HEALTH_PING_INTERVAL_SEC || 30);

  const send = () => {
    const payload = JSON.stringify({
      name,
      status,
      uptimeSec: Math.floor(process.uptime())
    });

    const req = http.request(
      {
        method: "POST",
        host,
        port,
        path: "/health",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      () => {}
    );

    req.on("error", () => {});
    req.write(payload);
    req.end();
  };

  send();
  if (intervalSec > 0) {
    setInterval(send, intervalSec * 1000);
  }
}

module.exports = { startHealthPing };
