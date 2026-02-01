const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const net = require("net");
const path = require("path");
const os = require("os");
const fs = require("fs");

const { sendToLlm } = require("../src/llmClient");
const { resetConfig } = require("../../common/config");

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

test("sendToLlm uses OpenClaw gateway response", async () => {
  const port = await getFreePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "robodevil-llm-"));
  const configPath = path.join(tempDir, "app.config.json");

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/responses") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ output_text: "openclaw ok" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(port, resolve));

  const config = {
    ipc: { httpHost: "127.0.0.1", httpPort: 17171, socketPath: "/tmp/robodevil_state.sock" },
    health: { pingIntervalSec: 30 },
    stt: {},
    openclaw: {
      gatewayHost: "127.0.0.1",
      gatewayPort: port,
      agentId: "main",
      sessionUser: "",
      gatewayScheme: "http",
      httpEndpoint: "responses"
    },
    llm: { provider: "openclaw", model: "grok-4", xai: { baseUrl: "", endpoint: "responses" } },
    storage: {},
    tts: {}
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  process.env.APP_CONFIG_PATH = configPath;
  resetConfig();

  try {
    const response = await sendToLlm("ping");
    assert.equal(response.text, "openclaw ok");
  } finally {
    server.close();
  }
});

test("sendToLlm uses xAI responses API", async () => {
  const port = await getFreePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "robodevil-llm-"));
  const configPath = path.join(tempDir, "app.config.json");

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/responses") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output_text: "grok ok"
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(port, resolve));

  const config = {
    ipc: { httpHost: "127.0.0.1", httpPort: 17171, socketPath: "/tmp/robodevil_state.sock" },
    health: { pingIntervalSec: 30 },
    stt: {},
    openclaw: {},
    llm: {
      provider: "xai",
      model: "grok-4",
      xai: { baseUrl: `http://127.0.0.1:${port}`, endpoint: "responses" }
    },
    storage: {},
    tts: {}
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  process.env.APP_CONFIG_PATH = configPath;
  process.env.XAI_API_KEY = "test-key";
  resetConfig();

  try {
    const response = await sendToLlm("ping");
    assert.equal(response.text, "grok ok");
  } finally {
    server.close();
    delete process.env.XAI_API_KEY;
  }
});
