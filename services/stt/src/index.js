const http = require("http");
const { buildStatePayload } = require("./ipcClient");
const { startHealthPing } = require("../../common/healthPing");
const { buildRecordCommand, recordAudio } = require("./recorder");
const { buildWhisperCommand, transcribeAudio } = require("./transcriber");
const { sendToLlm } = require("./llmClient");
const { getConfig } = require("../../common/config");

const config = getConfig();
const ipcHost = config.ipc.httpHost;
const ipcPort = config.ipc.httpPort;
const ipcToken = process.env.IPC_AUTH_TOKEN || null;

const recordSeconds = Number(config.stt.recordSeconds || 5);
const tempAudioPath = config.stt.audioPath || "./tmp/stt-input.wav";
const whisperBin = config.stt.whisperBin || "whisper.cpp";
const whisperModel = config.stt.whisperModel || "./models/ggml-tiny.en.bin";
const llmProvider = config.llm.provider || "openclaw";
const openclawAgentId = config.openclaw.agentId || "main";
const wakePhraseRaw = config.stt.wakePhrase || "";
const wakeCooldownMs = Number(config.stt.wakeCooldownMs || 3000);
const requireWake =
  config.stt.requireWake === true ||
  (!!wakePhraseRaw && config.stt.requireWake !== false);
const interceptRaw = config.stt.interceptPhrases || "stop,shutup,no";
const interceptCooldownMs = Number(config.stt.interceptCooldownMs || 2000);
const interceptCommand = config.stt.interceptCommand || "stop_tts";

let inFlight = false;
let lastWakeAt = 0;
let lastInterceptAt = 0;
let suppressNextResponse = false;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildWakeRegex() {
  if (!wakePhraseRaw.trim()) {
    return null;
  }
  const phrases = wakePhraseRaw
    .split(",")
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .map(escapeRegExp);
  if (phrases.length === 0) {
    return null;
  }
  return new RegExp(`\\b(${phrases.join("|")})\\b`, "i");
}

const wakeRegex = buildWakeRegex();

function buildInterceptRegex() {
  const phrases = interceptRaw
    .split(",")
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .map(escapeRegExp);
  if (phrases.length === 0) {
    return null;
  }
  return new RegExp(`\\b(${phrases.join("|")})\\b`, "i");
}

const interceptRegex = buildInterceptRegex();

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isBlankTranscript(value) {
  const normalized = normalizeText(value);
  return (
    !normalized ||
    normalized === "[blank_audio]" ||
    normalized === "(blank audio)"
  );
}

function shouldIntercept(text) {
  if (!interceptRegex) {
    return false;
  }
  if (!interceptRegex.test(text)) {
    return false;
  }
  const now = Date.now();
  if (now - lastInterceptAt < interceptCooldownMs) {
    return false;
  }
  lastInterceptAt = now;
  return true;
}

function applyWakePhrase(text) {
  if (!requireWake || !wakeRegex) {
    return { ok: true, text };
  }
  if (!wakeRegex.test(text)) {
    return { ok: false };
  }
  const now = Date.now();
  if (now - lastWakeAt < wakeCooldownMs) {
    return { ok: false };
  }
  lastWakeAt = now;
  const stripped = text.replace(wakeRegex, "").trim();
  return { ok: true, text: stripped };
}

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

function sendResponse(text) {
  const payload = {
    text,
    source: llmProvider,
    agentId: openclawAgentId
  };
  const data = JSON.stringify(payload);
  const req = http.request(
    {
      method: "POST",
      host: ipcHost,
      port: ipcPort,
      path: "/responses",
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

function sendCommand(type, details) {
  const payload = {
    type,
    source: "stt",
    details: details || {}
  };
  const data = JSON.stringify(payload);
  const req = http.request(
    {
      method: "POST",
      host: ipcHost,
      port: ipcPort,
      path: "/commands",
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
  if (inFlight) {
    return setTimeout(loop, 500);
  }
  try {
    const recordCmd = buildRecordCommand({
      seconds: recordSeconds,
      outputPath: tempAudioPath,
      recordCmd: config.stt.recordCmd
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

    if (text && text.trim()) {
      console.log("[stt] Transcribed", text);
      if (isBlankTranscript(text)) {
        return;
      }
      if (shouldIntercept(text)) {
        sendCommand(interceptCommand, { text: text.trim() });
        if (inFlight) {
          suppressNextResponse = true;
        }
        return;
      }
      const gated = applyWakePhrase(text);
      if (!gated.ok) {
        return;
      }
      const payloadText = gated.text.trim();
      if (!payloadText) {
        return;
      }
      try {
        inFlight = true;
                    const response = await sendToLlm(payloadText);
        if (suppressNextResponse) {
          suppressNextResponse = false;
        } else if (response?.text) {
          sendResponse(response.text);
        } else {
          console.log("[stt] OpenClaw returned no text");
        }
      } catch (error) {
        console.log("[stt] OpenClaw error", error.message);
      } finally {
        inFlight = false;
      }
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
