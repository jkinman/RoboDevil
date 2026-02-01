const http = require("http");

function fetchCommands({ host, port, token }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "GET",
        host,
        port,
        path: "/commands",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`commands failed: ${res.statusCode}`));
          }
          try {
            const parsed = JSON.parse(body || "{}");
            resolve(parsed.commands || []);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

module.exports = { fetchCommands };
