const { spawn } = require("child_process");

function buildRecordCommand({ seconds, outputPath }) {
  const cmd = process.env.STT_RECORD_CMD;
  if (cmd) {
    return cmd.replace("{out}", outputPath).replace("{sec}", String(seconds));
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
