const { spawn } = require("child_process");

function buildWhisperCommand({ bin, model, input }) {
  // Use -t 2 to limit threads and reduce memory usage on Pi
  return `"${bin}" -m "${model}" -f "${input}" -nt -np -t 2`;
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
      } else if (code === 3) {
        // Exit code 3 = no speech detected, not an error
        resolve("");
      } else {
        reject(new Error(`whisper failed: ${code}`));
      }
    });
  });
}

module.exports = { buildWhisperCommand, transcribeAudio };
