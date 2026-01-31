const http = require("http");
const { buildStatePayload } = require("./ipcClient");
const { startHealthPing } = require("../../common/healthPing");
const { buildRecordCommand, recordAudio } = require("./recorder");
const { buildWhisperCommand, transcribeAudio } = require("./transcriber");

const ipcHost = process.env.IPC_HTTP_HOST || "127.0.0.1";
const ipcPort = Number(process.env.IPC_HTTP_PORT || 17171);
const ipcToken = process.env.IPC_AUTH_TOKEN || null;

const recordSeconds = Number(process.env.STT_RECORD_SECONDS || 5);
const tempAudioPath = process.env.STT_AUDIO_PATH || "./tmp/stt-input.wav";
const whisperBin = process.env.STT_WHISPER_BIN || "whisper.cpp";
const whisperModel = process.env.STT_WHISPER_MODEL || "./models/ggml-tiny.en.bin";

startHealthPing({ name: "stt" });
console.log("[stt] Ready");

function sendState(state, expiresAt) {
  const payload = buildStatePayload({
    state,
    source: "stt",
    expiresAt
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
}

async function loop() {
  try {
    const recordCmd = buildRecordCommand({
      seconds: recordSeconds,
      outputPath: tempAudioPath
    });
    sendState("listening", new Date(Date.now() + recordSeconds * 1000).toISOString());
    await recordAudio(recordCmd);

    sendState("thinking", new Date(Date.now() + 5000).toISOString());
    const whisperCmd = buildWhisperCommand({
      bin: whisperBin,
      model: whisperModel,
      input: tempAudioPath
    });
    const text = await transcribeAudio(whisperCmd);

    if (text) {
      console.log("[stt] Transcribed", text);
      // TODO: Forward text to OpenClaw.
    }

    sendState("idle", new Date(Date.now() + 2000).toISOString());
  } catch (error) {
    console.log("[stt] Error", error.message);
    sendState("idle", new Date(Date.now() + 2000).toISOString());
  } finally {
    setTimeout(loop, 500);
  }
}

loop();

setInterval(() => {}, 1 << 30);
