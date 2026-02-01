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

function waitForLogLine(logPath, text, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, "utf8");
        if (content.includes(text)) {
          return resolve(content);
        }
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`log timeout: ${text}`));
      }
      setTimeout(poll, 100);
    };
    poll();
  });
}

test("stop command interrupts playback and suppresses queue", async () => {
  const ipcPort = await getFreePort();
  const storagePort = await getFreePort();
  const inworldPort = await getFreePort();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "robodevil-"));
  const dbPath = path.join(tmpDir, "test.db");
  const tempAudioPath = path.join(tmpDir, "tts-output.wav");
  const playScript = path.join(tmpDir, "play-script.js");
  const logPath = path.join(tmpDir, "play.log");
  const configPath = path.join(tmpDir, "app.config.json");

  fs.writeFileSync(
    playScript,
    [
      "const fs = require('fs');",
      "const logPath = process.env.PLAY_LOG_PATH;",
      "fs.appendFileSync(logPath, 'start\\n');",
      "let done = false;",
      "const finish = (label) => {",
      "  if (done) return;",
      "  done = true;",
      "  fs.appendFileSync(logPath, `${label}\\n`);",
      "  process.exit(0);",
      "};",
      "process.on('SIGTERM', () => finish('stopped'));",
      "setTimeout(() => finish('completed'), 5000);",
      "setInterval(() => {}, 1000);"
    ].join("\n")
  );
  fs.chmodSync(playScript, 0o755);

  const appConfig = {
    ipc: { httpHost: "127.0.0.1", httpPort: ipcPort, socketPath: "/tmp/robodevil_state.sock" },
    storage: { httpHost: "127.0.0.1", httpPort: storagePort, dbPath },
    tts: {
      stopWindowMs: 2000,
      playCmd: `node "${playScript}" "{file}"`,
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
  await new Promise((resolve) => inworldServer.listen(inworldPort, resolve));

  const env = {
    ...process.env,
    APP_CONFIG_PATH: configPath,
    IPC_AUTH_TOKEN: "",
    INWORLD_BASIC: "test",
    PLAY_LOG_PATH: logPath,
    IPC_HTTP_HOST: "",
    IPC_HTTP_PORT: "",
    IPC_SOCKET_PATH: "",
    STORAGE_HTTP_HOST: "",
    STORAGE_HTTP_PORT: "",
    STORAGE_DB_PATH: "",
    STORAGE_RETENTION_DAYS: "",
    HEALTH_PING_INTERVAL_SEC: "",
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

  try {
    await waitForHealthy(storagePort, "/health");
    await waitForHealthy(ipcPort, "/health");

    await requestJson({
      method: "POST",
      port: ipcPort,
      pathName: "/responses",
      body: { text: "hello world", source: "test" }
    });

    await waitForLogLine(logPath, "start");

    await requestJson({
      method: "POST",
      port: ipcPort,
      pathName: "/commands",
      body: { type: "stop_tts", source: "test" }
    });

    await waitForLogLine(logPath, "stopped");

    await requestJson({
      method: "POST",
      port: ipcPort,
      pathName: "/responses",
      body: { text: "second response", source: "test" }
    });

    const logContents = fs.readFileSync(logPath, "utf8").trim().split("\n");
    const startCount = logContents.filter((line) => line === "start").length;
    assert.equal(startCount, 1);
    assert.ok(!logContents.includes("completed"));
  } finally {
    tts.kill("SIGTERM");
    ipc.kill("SIGTERM");
    storage.kill("SIGTERM");
    inworldServer.close();
  }
});
