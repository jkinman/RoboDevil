const http = require("http");
const { buildStatePayload } = require("./ipcClient");

const ipcHost = process.env.IPC_HTTP_HOST || "127.0.0.1";
const ipcPort = Number(process.env.IPC_HTTP_PORT || 17171);
const ipcToken = process.env.IPC_AUTH_TOKEN || null;

console.log("[stt] Ready");

// TODO: Replace with mic capture + Whisper transcription.
// Temporary: accept JSON over stdin to forward state to IPC.
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  try {
    const update = JSON.parse(chunk);
    const payload = buildStatePayload({
      state: update.state,
      source: "stt",
      expiresAt: update.expiresAt
    });
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
  } catch (error) {
    // ignore invalid input for now
  }
});

setInterval(() => {}, 1 << 30);
