const http = require("http");
const { chooseProvider } = require("./router");
const { fetchResponses } = require("./responsePoller");
const { estimatePlaybackMs } = require("./playbackEstimator");
const { startHealthPing } = require("../../common/healthPing");
const { getProvider } = require("./providerFactory");
const { playAudio, stopPlayback } = require("./audioPlayer");
const { fetchCommands } = require("./commandPoller");
const { getConfig } = require("../../common/config");

const config = getConfig();
const ipcHost = config.ipc.httpHost;
const ipcPort = config.ipc.httpPort;
const ipcToken = process.env.IPC_AUTH_TOKEN || null;
const stopWindowMs = Number(config.tts.stopWindowMs || 3000);

let stopUntil = 0;

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
  const commands = await fetchCommands({
    host: ipcHost,
    port: ipcPort,
    token: ipcToken
  });
  if (commands.length) {
    const now = Date.now();
    const hasStop = commands.some((cmd) => cmd?.type === "stop_tts");
    if (hasStop) {
      stopPlayback();
      stopUntil = Math.max(stopUntil, now + stopWindowMs);
      return;
    }
  }

  const responses = await fetchResponses({
    host: ipcHost,
    port: ipcPort,
    token: ipcToken
  });

  for (const response of responses) {
    if (Date.now() < stopUntil) {
      continue;
    }
    const decision = handleResponse(response);
    process.stdout.write(JSON.stringify(decision) + "\n");
    const primary = getProvider(decision.provider);
    const fallback = getProvider("local");

    try {
      sendStateUpdate("talking");
      const audioPath = await primary.synthesize({ text: response.text });
      await playAudio(audioPath);
    } catch (error) {
      console.log("[tts-router] Primary failed", error.message);
      if (fallback && primary !== fallback) {
        try {
          const audioPath = await fallback.synthesize({ text: response.text });
          await playAudio(audioPath);
        } catch (fallbackError) {
          console.log("[tts-router] Fallback failed", fallbackError.message);
        }
      }
    } finally {
      setTimeout(() => {
        sendStateUpdate("idle");
      }, estimatePlaybackMs(response?.text || ""));
    }
  }
}

startHealthPing({ name: "tts-router" });
console.log("[tts-router] Ready");
setInterval(poll, 1000);
