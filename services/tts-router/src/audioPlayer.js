const { spawn } = require("child_process");
const path = require("path");
const { getConfig } = require("../../common/config");

function defaultPlayCmd(filePath) {
  if (process.platform === "darwin") {
    return `afplay "${filePath}"`;
  }
  return `aplay "${filePath}"`;
}

let currentProcess = null;

function stopPlayback() {
  if (currentProcess && !currentProcess.killed) {
    currentProcess.kill("SIGTERM");
  }
}

function playAudio(filePath) {
  const resolved = path.resolve(filePath);
  const config = getConfig();
  const cmdTemplate = config.tts.playCmd;
  const command = cmdTemplate
    ? cmdTemplate.replace("{file}", resolved)
    : defaultPlayCmd(resolved);

  return new Promise((resolve, reject) => {
    const proc = spawn(command, { shell: true, stdio: "inherit" });
    currentProcess = proc;
    proc.on("error", (error) => {
      currentProcess = null;
      reject(error);
    });
    proc.on("exit", (code) => {
      currentProcess = null;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`play failed: ${code}`));
      }
    });
  });
}

module.exports = { playAudio, stopPlayback };
