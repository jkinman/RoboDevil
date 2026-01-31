const http = require("http");
const { shouldResetState, resetToIdle } = require("./watchdog");

const ipcHost = process.env.IPC_HTTP_HOST || "127.0.0.1";
const ipcPort = Number(process.env.IPC_HTTP_PORT || 17171);
const ipcToken = process.env.IPC_AUTH_TOKEN || null;

const state = {
  current: {
    state: "idle",
    expiresAt: null
  }
};

function handleStateUpdate(update) {
  if (!update || typeof update !== "object") {
    return;
  }
  state.current = {
    state: update.state || state.current.state,
    expiresAt: update.expiresAt || state.current.expiresAt
  };
}

function sendIdle() {
  const payload = {
    state: "idle",
    source: "orchestrator",
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5000).toISOString(),
    sessionId: new Date().toISOString(),
    details: { reason: "watchdog_timeout" }
  };

  const data = JSON.stringify(payload);
  const req = http.request(
    {
      method: "POST",
      host: ipcHost,
      port: ipcPort,
      path: "/state",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...(ipcToken ? { Authorization: `Bearer ${ipcToken}` } : {})
      }
    },
    () => {}
  );

  req.on("error", () => {});
  req.write(data);
  req.end();
}

function pollLatestState() {
  const req = http.request(
    {
      method: "GET",
      host: ipcHost,
      port: ipcPort,
      path: "/logs",
      headers: {
        ...(ipcToken ? { Authorization: `Bearer ${ipcToken}` } : {})
      }
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data || "{}");
          const entries = parsed.entries || [];
          const last = entries[entries.length - 1];
          if (last) {
            handleStateUpdate(last);
          }
        } catch (error) {
          // ignore parse errors
        }
      });
    }
  );

  req.on("error", () => {});
  req.end();
}

function tick() {
  pollLatestState();
  if (shouldResetState(state.current, new Date().toISOString())) {
    state.current = resetToIdle();
    sendIdle();
  }
}

setInterval(tick, 1000);

console.log("[orchestrator] Ready", { state: state.current.state });
