const { shouldResetState, resetToIdle } = require("./watchdog");

const state = {
  current: {
    state: "idle",
    expiresAt: null
  }
};

function handleStateUpdate(update) {
  if (!update || typeof update !== "object") {
    return;
  }
  state.current = {
    state: update.state || state.current.state,
    expiresAt: update.expiresAt || state.current.expiresAt
  };
}

function tick() {
  if (shouldResetState(state.current, new Date().toISOString())) {
    state.current = resetToIdle();
  }
}

setInterval(tick, 500);

console.log("[orchestrator] Ready", { state: state.current.state });

// TODO: Replace with IPC subscription. Temporary stdin support.
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  try {
    const update = JSON.parse(chunk);
    handleStateUpdate(update);
  } catch (error) {
    // ignore invalid input for now
  }
});
