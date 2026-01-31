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
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  child.on("exit", (code) => {
    console.log(`[dev] ${name} exited with code ${code}`);
  });

  children.push(child);
  return child;
}

console.log("[dev] Starting local services...");
services.forEach(startService);

setInterval(() => {
  const running = children.filter((child) => child.exitCode === null).length;
  console.log(`[dev] status ${running}/${children.length} running`);
}, 5000);

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
