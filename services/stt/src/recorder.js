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
  if (recordCmd) {
    return recordCmd
      .replace("{out}", outputPath)
      .replace("{sec}", String(seconds));
  }

  return `sox -d -r 16000 -c 1 -b 16 -e signed-integer "${outputPath}" trim 0 ${seconds}`;
}

function recordAudio(command) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, { shell: true, stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`record failed: ${code}`));
      }
    });
  });
}

module.exports = { buildRecordCommand, recordAudio };
