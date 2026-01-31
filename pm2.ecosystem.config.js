module.exports = {
  apps: [
    {
      name: "stt",
      cwd: __dirname + "/services/stt",
      script: "src/index.js"
    },
    {
      name: "tts-router",
      cwd: __dirname + "/services/tts-router",
      script: "src/index.js"
    },
    {
      name: "led",
      cwd: __dirname + "/services/led",
      script: "src/index.js"
    },
    {
      name: "orchestrator",
      cwd: __dirname + "/services/orchestrator",
      script: "src/index.js"
    },
    {
      name: "storage",
      cwd: __dirname + "/services/storage",
      script: "src/index.js"
    },
    {
      name: "ipc-bridge",
      cwd: __dirname + "/services/ipc-bridge",
      script: "src/index.js"
    }
  ]
};
