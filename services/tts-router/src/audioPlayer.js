const { spawn } = require("child_process");
const path = require("path");

function defaultPlayCmd(filePath) {
  if (process.platform === "darwin") {
    return `afplay "${filePath}"`;
  }
  return `aplay "${filePath}"`;
}

function playAudio(filePath) {
  const resolved = path.resolve(filePath);
  const cmdTemplate = process.env.TTS_PLAY_CMD;
  const command = cmdTemplate
    ? cmdTemplate.replace("{file}", resolved)
    : defaultPlayCmd(resolved);

  return new Promise((resolve, reject) => {
    const proc = spawn(command, { shell: true, stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`play failed: ${code}`));
      }
    });
  });
}

module.exports = { playAudio };
