const http = require("http");
const { chooseProvider } = require("./router");
const { fetchResponses } = require("./responsePoller");
const { estimatePlaybackMs } = require("./playbackEstimator");

const ipcHost = process.env.IPC_HTTP_HOST || "127.0.0.1";
const ipcPort = Number(process.env.IPC_HTTP_PORT || 17171);
const ipcToken = process.env.IPC_AUTH_TOKEN || null;

function handleResponse(response) {
  const decision = chooseProvider({
    length: response?.text?.length || 0,
    priority: response?.priority || "normal",
    demonicIntensity: response?.demonicIntensity || "med",
    networkOnline: response?.networkOnline ?? true
  });

  return decision;
}

function sendStateUpdate(state) {
  const payload = {
    state,
    source: "tts-router",
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5000).toISOString(),
    sessionId: new Date().toISOString(),
    details: {}
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

async function poll() {
  const responses = await fetchResponses({
    host: ipcHost,
    port: ipcPort,
    token: ipcToken
  });

  for (const response of responses) {
    const decision = handleResponse(response);
    process.stdout.write(JSON.stringify(decision) + "\n");
    sendStateUpdate("talking");
    setTimeout(() => {
      sendStateUpdate("idle");
    }, estimatePlaybackMs(response?.text || ""));
  }
}

console.log("[tts-router] Ready");
setInterval(poll, 1000);
