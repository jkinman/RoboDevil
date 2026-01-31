const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function synthesize({ text }) {
  const bin = process.env.PIPER_BIN || "piper";
  const model = process.env.PIPER_MODEL;
  const outputPath = process.env.PIPER_OUTPUT_PATH || "./tmp/tts-output.wav";
  if (!model) {
    throw new Error("missing PIPER_MODEL");
  }

  ensureDir(outputPath);

  return new Promise((resolve, reject) => {
    const args = ["--model", model, "--output_file", outputPath];
    const proc = spawn(bin, args, { stdio: ["pipe", "inherit", "inherit"] });
    proc.on("error", reject);
    proc.stdin.write(text);
    proc.stdin.end();
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`piper failed: ${code}`));
      }
    });
  });
}

module.exports = { synthesize };
