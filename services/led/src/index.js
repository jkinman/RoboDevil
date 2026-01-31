const {
  DEFAULT_STATE,
  shouldExpire,
  applyUpdate
} = require("./stateMachine");

let currentState = { ...DEFAULT_STATE };

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

// TODO: Replace with IPC subscription + GPIO/PWM output.
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
