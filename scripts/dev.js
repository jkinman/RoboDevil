const { spawn } = require("child_process");
const path = require("path");

const services = [
  "services/ipc-bridge",
  "services/storage",
  "services/tts-router",
  "services/led",
  "services/orchestrator"
];

const children = [];

function startService(servicePath) {
  const cwd = path.resolve(__dirname, "..", servicePath);
  const name = path.basename(servicePath);
  const child = spawn("node", ["src/index.js"], {
    cwd,
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", (code) => {
    console.log(`[dev] ${name} exited with code ${code}`);
  });

  children.push(child);
  return child;
}

console.log("[dev] Starting local services...");
services.forEach(startService);

function shutdown() {
  console.log("[dev] Shutting down services...");
  children.forEach((child) => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  });
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
