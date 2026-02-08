const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildRecordCommand({ seconds, outputPath, recordCmd }) {
  ensureDir(outputPath);
  // Use pw-record now that audio is working post-reboot
  return `timeout ${seconds} pw-record --rate 16000 --channels 1 --format s16 "${outputPath}"`;
}

function recordAudio(command) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, { shell: true, stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      // 0 = success, 124 = timeout (expected)
      if (code === 0 || code === 124) {
        resolve();
      } else {
        reject(new Error(`record failed: ${code}`));
      }
    });
  });
}

module.exports = { buildRecordCommand, recordAudio };
