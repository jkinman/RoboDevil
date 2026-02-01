const http = require("http");
const { getConfig } = require("./config");

function startHealthPing({ name, status = "ok" }) {
  const config = getConfig();
  const host = config.ipc.httpHost;
  const port = config.ipc.httpPort;
  const token = process.env.IPC_AUTH_TOKEN || null;
  const intervalSec = Number(config.health.pingIntervalSec || 30);

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
