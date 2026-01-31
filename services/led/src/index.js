const http = require("http");
const {
  DEFAULT_STATE,
  shouldExpire,
  applyUpdate
} = require("./stateMachine");

let currentState = { ...DEFAULT_STATE };
const ipcHost = process.env.IPC_HTTP_HOST || "127.0.0.1";
const ipcPort = Number(process.env.IPC_HTTP_PORT || 17171);
const ipcToken = process.env.IPC_AUTH_TOKEN || null;

function updateState(update) {
  currentState = applyUpdate(currentState, update);
}

function tick() {
  const nowIso = new Date().toISOString();
  if (shouldExpire(currentState, nowIso)) {
    currentState = { ...DEFAULT_STATE };
  }
}

setInterval(tick, 500);

console.log("[led] Ready", { state: currentState.state });

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
            updateState(last);
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

setInterval(pollLatestState, 1000);

// Temporary: accept JSON state updates via stdin for manual testing.
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  try {
    const update = JSON.parse(chunk);
    updateState(update);
  } catch (error) {
    // ignore invalid input for now
  }
});
