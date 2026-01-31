const net = require("net");

const DEFAULT_SOCKET_PATH = "/tmp/robodevil_state.sock";

function buildStatePayload({ state, source, expiresAt }) {
  const now = new Date().toISOString();
  return {
    state,
    source,
    timestamp: now,
    expiresAt: expiresAt || now,
    sessionId: now,
    details: {}
  };
}

function sendState({ state, expiresAt, token } = {}) {
  const socketPath = process.env.IPC_SOCKET_PATH || DEFAULT_SOCKET_PATH;
  const source = "stt";
  const payload = buildStatePayload({ state, source, expiresAt });
  if (token) {
    payload.token = token;
  }

  return new Promise((resolve) => {
    const client = net.createConnection(socketPath, () => {
      client.write(JSON.stringify(payload));
      client.end();
    });

    client.on("error", () => resolve(false));
    client.on("close", () => resolve(true));
  });
}

module.exports = { buildStatePayload, sendState };
