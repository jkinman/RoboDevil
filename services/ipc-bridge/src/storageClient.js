const http = require("http");

function sendEvent({ host, port, event }) {
  const payload = JSON.stringify(event);

  return new Promise((resolve) => {
    const req = http.request(
      {
        method: "POST",
        host,
        port,
        path: "/events",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res.statusCode === 200));
      }
    );

    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

module.exports = { sendEvent };
