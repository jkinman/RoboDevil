const { sendState } = require("./ipcClient");

console.log("[stt] Ready");

// TODO: Replace with mic capture + Whisper transcription.
// Temporary: accept JSON over stdin to forward state to IPC.
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  try {
    const update = JSON.parse(chunk);
    sendState({
      state: update.state,
      expiresAt: update.expiresAt,
      token: process.env.IPC_AUTH_TOKEN
    });
  } catch (error) {
    // ignore invalid input for now
  }
});

setInterval(() => {}, 1 << 30);
