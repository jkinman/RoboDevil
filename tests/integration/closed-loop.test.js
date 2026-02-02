const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const net = require("net");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawn } = require("child_process");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function waitForHealthy(port, pathName) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      const req = http.request(
        { method: "GET", host: "127.0.0.1", port, path: pathName },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            return resolve();
          }
          if (Date.now() - start > 7000) {
            return reject(new Error("health timeout"));
          }
          setTimeout(poll, 100);
        }
      );
      req.on("error", () => {
        if (Date.now() - start > 7000) {
          return reject(new Error("health timeout"));
        }
        setTimeout(poll, 100);
      });
      req.end();
    };
    poll();
  });
}

function requestJson({ method, port, pathName, body }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        method,
        host: "127.0.0.1",
        port,
        path: pathName,
        headers: data
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(data)
            }
          : {}
      },
      (res) => {
        let output = "";
        res.on("data", (chunk) => {
          output += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: output ? JSON.parse(output) : {} });
        });
      }
    );
    req.on("error", reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

function waitForStates(storagePort, expected, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = async () => {
      const events = await requestJson({
        method: "GET",
        port: storagePort,
        pathName: "/events"
      });
      if (events.status === 200) {
        const states = events.body.events
          .filter((event) => event.type === "state_update")
          .map((event) => event.payload);
        const indexes = expected.map(({ source, state }) =>
          states.findIndex((entry, idx) =>
            idx >= 0 && entry?.source === source && entry?.state === state
          )
        );
        const allFound = indexes.every((index) => index >= 0);
        if (allFound) {
          const isOrdered = indexes.every((value, idx) =>
            idx === 0 ? true : value >= indexes[idx - 1]
          );
          if (isOrdered) {
            return resolve(states);
          }
        }
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("state sequence timeout"));
      }
      setTimeout(poll, 200);
    };
    poll().catch(reject);
  });
}

test("closed loop: STT -> OpenClaw -> IPC -> TTS", async () => {
  const ipcPort = await getFreePort();
  const storagePort = await getFreePort();
  const openclawPort = await getFreePort();
  const inworldPort = await getFreePort();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "robodevil-"));
  const dbPath = path.join(tmpDir, "test.db");
  const tempAudioPath = path.join(tmpDir, "tts-output.wav");
  const whisperScript = path.join(tmpDir, "fake-whisper.sh");
  const configPath = path.join(tmpDir, "app.config.json");

  fs.writeFileSync(
    whisperScript,
    "#!/bin/sh\n\necho \"hello there\"\n"
  );
  fs.chmodSync(whisperScript, 0o755);

  const appConfig = {
    ipc: { httpHost: "127.0.0.1", httpPort: ipcPort, socketPath: "/tmp/robodevil_state.sock" },
    storage: { httpHost: "127.0.0.1", httpPort: storagePort, dbPath },
    stt: {
      recordSeconds: 0,
      audioPath: path.join(tmpDir, "stt-input.wav"),
      whisperBin: whisperScript,
      whisperModel: "ignored",
      recordCmd: "true",
      requireWake: false,
      wakePhrase: ""
    },
    openclaw: {
      gatewayHost: "127.0.0.1",
      gatewayPort: openclawPort,
      httpEndpoint: "responses",
      gatewayScheme: "http",
      agentId: "main"
    },
    tts: {
      stopWindowMs: 1000,
      playCmd: "true",
      tempAudio: tempAudioPath,
      inworld: {
        baseUrl: `http://127.0.0.1:${inworldPort}/tts`,
        audioEncoding: "MP3",
        speakingRate: 1,
        temperature: 1
      }
    }
  };
  fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));

  const openclawServer = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/responses") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ output_text: "test response" }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const inworldServer = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/tts") {
      const audio = Buffer.from("fake-audio");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ audioContent: audio.toString("base64") }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => openclawServer.listen(openclawPort, resolve));
  await new Promise((resolve) => inworldServer.listen(inworldPort, resolve));

  const env = {
    ...process.env,
    APP_CONFIG_PATH: configPath,
    IPC_AUTH_TOKEN: "",
    OPENCLAW_GATEWAY_TOKEN: "",
    OPENCLAW_SESSION_KEY: "",
    INWORLD_BASIC: "test",
    NODE_OPTIONS: "",
    IPC_HTTP_HOST: "",
    IPC_HTTP_PORT: "",
    IPC_SOCKET_PATH: "",
    STORAGE_HTTP_HOST: "",
    STORAGE_HTTP_PORT: "",
    STORAGE_DB_PATH: "",
    STORAGE_RETENTION_DAYS: "",
    HEALTH_PING_INTERVAL_SEC: "",
    STT_RECORD_SECONDS: "",
    STT_AUDIO_PATH: "",
    STT_WHISPER_BIN: "",
    STT_WHISPER_MODEL: "",
    STT_WAKE_COOLDOWN_MS: "",
    STT_INTERCEPT_COOLDOWN_MS: "",
    STT_INTERCEPT_COMMAND: "",
    OPENCLAW_GATEWAY_HOST: "",
    OPENCLAW_GATEWAY_PORT: "",
    OPENCLAW_GATEWAY_SCHEME: "",
    OPENCLAW_HTTP_ENDPOINT: "",
    OPENCLAW_AGENT_ID: "",
    TTS_STOP_WINDOW_MS: "",
    TTS_TEMP_AUDIO: "",
    INWORLD_BASE_URL: "",
    INWORLD_VOICE_ID: "",
    INWORLD_MODEL: "",
    INWORLD_WORKSPACE_ID: "",
    INWORLD_AUDIO_ENCODING: "",
    INWORLD_SPEAKING_RATE: "",
    INWORLD_TEMPERATURE: "",
    PIPER_BIN: "",
    PIPER_OUTPUT_PATH: ""
  };
  delete env.STT_RECORD_CMD;
  delete env.STT_WAKE_PHRASE;
  delete env.STT_REQUIRE_WAKE;
  delete env.STT_INTERCEPT_PHRASES;
  delete env.OPENCLAW_SESSION_USER;
  delete env.TTS_PLAY_CMD;
  delete env.PIPER_MODEL;

  const cwd = path.resolve(__dirname, "../..");
  const storage = spawn("node", ["services/storage/src/index.js"], {
    cwd,
    env,
    stdio: "ignore"
  });
  const ipc = spawn("node", ["services/ipc-bridge/src/index.js"], {
    cwd,
    env,
    stdio: "ignore"
  });
  const tts = spawn("node", ["services/tts-router/src/index.js"], {
    cwd,
    env,
    stdio: "ignore"
  });
  const stt = spawn("node", ["services/stt/src/index.js"], {
    cwd,
    env,
    stdio: "ignore"
  });

  try {
    await waitForHealthy(storagePort, "/health");
    await waitForHealthy(ipcPort, "/health");

    await waitForStates(storagePort, [
      { source: "stt", state: "listening" },
      { source: "stt", state: "thinking" },
      { source: "tts-router", state: "talking" },
      { source: "tts-router", state: "idle" }
    ]);
  } finally {
    stt.kill("SIGTERM");
    tts.kill("SIGTERM");
    ipc.kill("SIGTERM");
    storage.kill("SIGTERM");
    openclawServer.close();
    inworldServer.close();
  }
});
