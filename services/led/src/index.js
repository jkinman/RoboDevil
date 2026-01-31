const net = require("net");
const {
  DEFAULT_STATE,
  shouldExpire,
  applyUpdate
} = require("./stateMachine");

let currentState = { ...DEFAULT_STATE };
const socketPath = process.env.IPC_SOCKET_PATH || "/tmp/robodevil_state.sock";

function updateState(update) {
  currentState = applyUpdate(currentState, update);
}

function tick() {
  const nowIso = new Date().toISOString();
  if (shouldExpire(currentState, nowIso)) {
    currentState = { ...DEFAULT_STATE };
  }
}

setInterval(tick, 500);

console.log("[led] Ready", { state: currentState.state });

// IPC subscription: listen for state updates from IPC bridge.
const server = net.createServer((socket) => {
  let data = "";
  socket.on("data", (chunk) => {
    data += chunk.toString();
  });
  socket.on("end", () => {
    try {
      const update = JSON.parse(data);
      updateState(update);
    } catch (error) {
      // ignore invalid input for now
    }
  });
});

if (require("fs").existsSync(socketPath)) {
  require("fs").unlinkSync(socketPath);
}

server.listen(socketPath, () => {
  console.log("[led] Listening", { socketPath });
});

// Temporary: accept JSON state updates via stdin for manual testing.
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  try {
    const update = JSON.parse(chunk);
    updateState(update);
  } catch (error) {
    // ignore invalid input for now
  }
});
