const http = require("http");

function fetchResponses({ host, port, token }) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        method: "GET",
        host,
        port,
        path: "/responses",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            resolve(parsed.responses || []);
          } catch (error) {
            resolve([]);
          }
        });
      }
    );

    req.on("error", () => resolve([]));
    req.end();
  });
}

module.exports = { fetchResponses };
