const { spawn } = require("child_process");

function buildWhisperCommand({ bin, model, input }) {
  return `"${bin}" -m "${model}" -f "${input}" -nt -np`;
}

function transcribeAudio(command) {
  return new Promise((resolve, reject) => {
    let output = "";
    const proc = spawn(command, { shell: true });
    proc.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`whisper failed: ${code}`));
      }
    });
  });
}

module.exports = { buildWhisperCommand, transcribeAudio };
