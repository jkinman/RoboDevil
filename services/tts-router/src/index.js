const { chooseProvider } = require("./router");

function handleResponse(response) {
  const decision = chooseProvider({
    length: response?.text?.length || 0,
    priority: response?.priority || "normal",
    demonicIntensity: response?.demonicIntensity || "med",
    networkOnline: response?.networkOnline ?? true
  });

  return decision;
}

console.log("[tts-router] Ready");

// TODO: Replace with IPC subscription + TTS provider calls.
// Temporary: accept JSON responses via stdin for manual testing.
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  try {
    const response = JSON.parse(chunk);
    const decision = handleResponse(response);
    process.stdout.write(JSON.stringify(decision) + "\n");
  } catch (error) {
    // ignore invalid input for now
  }
});

setInterval(() => {}, 1 << 30);
