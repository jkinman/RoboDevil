const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  ipc: {
    httpHost: "127.0.0.1",
    httpPort: 17171,
    socketPath: "/tmp/robodevil_state.sock"
  },
  health: {
    pingIntervalSec: 30
  },
  stt: {
    recordSeconds: 5,
    audioPath: "./tmp/stt-input.wav",
    whisperBin: "whisper.cpp",
    whisperModel: "./models/ggml-tiny.en.bin",
    recordCmd: "",
    wakePhrase: "",
    wakeCooldownMs: 3000,
    requireWake: true,
    interceptPhrases: "stop,shutup,no",
    interceptCooldownMs: 2000,
    interceptCommand: "stop_tts"
  },
  openclaw: {
    gatewayHost: "127.0.0.1",
    gatewayPort: 18789,
    agentId: "main",
    sessionUser: "",
    gatewayScheme: "http",
    httpEndpoint: "responses"
  },
  storage: {
    httpHost: "127.0.0.1",
    httpPort: 17172,
    dbPath: "./data/robodevil.db",
    retentionDays: 30
  },
  tts: {
    stopWindowMs: 3000,
    playCmd: "",
    tempAudio: "./tmp/tts-output.wav",
    inworld: {
      baseUrl: "",
      voiceId: "",
      modelId: "",
      workspaceId: "",
      audioEncoding: "MP3",
      speakingRate: 1,
      temperature: 1
    },
    piper: {
      bin: "piper",
      model: "",
      outputPath: "./tmp/tts-output.wav"
    }
  }
};

let cachedConfig = null;

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target, source) {
  if (!isPlainObject(source)) {
    return target;
  }
  const output = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function applyEnvOverrides(config) {
  const env = process.env;

  if (env.IPC_HTTP_HOST) config.ipc.httpHost = env.IPC_HTTP_HOST;
  if (env.IPC_HTTP_PORT) config.ipc.httpPort = Number(env.IPC_HTTP_PORT);
  if (env.IPC_SOCKET_PATH) config.ipc.socketPath = env.IPC_SOCKET_PATH;
  if (env.HEALTH_PING_INTERVAL_SEC) {
    config.health.pingIntervalSec = Number(env.HEALTH_PING_INTERVAL_SEC);
  }

  if (env.STT_RECORD_SECONDS) config.stt.recordSeconds = Number(env.STT_RECORD_SECONDS);
  if (env.STT_AUDIO_PATH) config.stt.audioPath = env.STT_AUDIO_PATH;
  if (env.STT_WHISPER_BIN) config.stt.whisperBin = env.STT_WHISPER_BIN;
  if (env.STT_WHISPER_MODEL) config.stt.whisperModel = env.STT_WHISPER_MODEL;
  if ("STT_RECORD_CMD" in env) config.stt.recordCmd = env.STT_RECORD_CMD;
  if ("STT_WAKE_PHRASE" in env) config.stt.wakePhrase = env.STT_WAKE_PHRASE;
  if (env.STT_WAKE_COOLDOWN_MS) config.stt.wakeCooldownMs = Number(env.STT_WAKE_COOLDOWN_MS);
  if ("STT_REQUIRE_WAKE" in env) config.stt.requireWake = env.STT_REQUIRE_WAKE === "true";
  if ("STT_INTERCEPT_PHRASES" in env) config.stt.interceptPhrases = env.STT_INTERCEPT_PHRASES;
  if (env.STT_INTERCEPT_COOLDOWN_MS) {
    config.stt.interceptCooldownMs = Number(env.STT_INTERCEPT_COOLDOWN_MS);
  }
  if (env.STT_INTERCEPT_COMMAND) config.stt.interceptCommand = env.STT_INTERCEPT_COMMAND;

  if (env.OPENCLAW_GATEWAY_HOST) config.openclaw.gatewayHost = env.OPENCLAW_GATEWAY_HOST;
  if (env.OPENCLAW_GATEWAY_PORT) config.openclaw.gatewayPort = Number(env.OPENCLAW_GATEWAY_PORT);
  if (env.OPENCLAW_AGENT_ID) config.openclaw.agentId = env.OPENCLAW_AGENT_ID;
  if ("OPENCLAW_SESSION_USER" in env) config.openclaw.sessionUser = env.OPENCLAW_SESSION_USER;
  if (env.OPENCLAW_GATEWAY_SCHEME) config.openclaw.gatewayScheme = env.OPENCLAW_GATEWAY_SCHEME;
  if (env.OPENCLAW_HTTP_ENDPOINT) config.openclaw.httpEndpoint = env.OPENCLAW_HTTP_ENDPOINT;

  if (env.STORAGE_HTTP_HOST) config.storage.httpHost = env.STORAGE_HTTP_HOST;
  if (env.STORAGE_HTTP_PORT) config.storage.httpPort = Number(env.STORAGE_HTTP_PORT);
  if (env.STORAGE_DB_PATH) config.storage.dbPath = env.STORAGE_DB_PATH;
  if (env.STORAGE_RETENTION_DAYS) config.storage.retentionDays = Number(env.STORAGE_RETENTION_DAYS);

  if (env.TTS_STOP_WINDOW_MS) config.tts.stopWindowMs = Number(env.TTS_STOP_WINDOW_MS);
  if ("TTS_PLAY_CMD" in env) config.tts.playCmd = env.TTS_PLAY_CMD;
  if (env.TTS_TEMP_AUDIO) config.tts.tempAudio = env.TTS_TEMP_AUDIO;

  if (env.INWORLD_BASE_URL) config.tts.inworld.baseUrl = env.INWORLD_BASE_URL;
  if (env.INWORLD_VOICE_ID) config.tts.inworld.voiceId = env.INWORLD_VOICE_ID;
  if (env.INWORLD_MODEL) config.tts.inworld.modelId = env.INWORLD_MODEL;
  if (env.INWORLD_WORKSPACE_ID) config.tts.inworld.workspaceId = env.INWORLD_WORKSPACE_ID;
  if (env.INWORLD_AUDIO_ENCODING) config.tts.inworld.audioEncoding = env.INWORLD_AUDIO_ENCODING;
  if (env.INWORLD_SPEAKING_RATE) {
    config.tts.inworld.speakingRate = Number(env.INWORLD_SPEAKING_RATE);
  }
  if (env.INWORLD_TEMPERATURE) config.tts.inworld.temperature = Number(env.INWORLD_TEMPERATURE);

  if (env.PIPER_BIN) config.tts.piper.bin = env.PIPER_BIN;
  if ("PIPER_MODEL" in env) config.tts.piper.model = env.PIPER_MODEL;
  if (env.PIPER_OUTPUT_PATH) config.tts.piper.outputPath = env.PIPER_OUTPUT_PATH;

  return config;
}

function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const repoRoot = path.resolve(__dirname, "..", "..");
  const configPath = process.env.APP_CONFIG_PATH
    ? path.resolve(repoRoot, process.env.APP_CONFIG_PATH)
    : path.join(repoRoot, "config", "app.config.json");

  let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  try {
    const fileConfig = readJsonFile(configPath);
    if (fileConfig) {
      config = deepMerge(config, fileConfig);
    }
  } catch (error) {
    console.warn(`[config] failed to read ${configPath}:`, error.message);
  }

  if (!process.env.APP_CONFIG_PATH) {
    const localPath = path.join(repoRoot, "config", "app.config.local.json");
    try {
      const localConfig = readJsonFile(localPath);
      if (localConfig) {
        config = deepMerge(config, localConfig);
      }
    } catch (error) {
      console.warn(`[config] failed to read ${localPath}:`, error.message);
    }
  }

  cachedConfig = applyEnvOverrides(config);
  return cachedConfig;
}

module.exports = { getConfig: loadConfig };
