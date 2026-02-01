const http = require("http");
const https = require("https");
const { getConfig } = require("../../common/config");

const config = getConfig();
const gatewayHost = config.openclaw.gatewayHost;
const gatewayPort = Number(config.openclaw.gatewayPort || 18789);
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || null;
const agentId = config.openclaw.agentId || "main";
const sessionUser = config.openclaw.sessionUser || "";
const sessionKey = process.env.OPENCLAW_SESSION_KEY || "";
const endpoint = config.openclaw.httpEndpoint || "responses";
const scheme = config.openclaw.gatewayScheme || "http";

function buildRequestPayload(text) {
  const base = endpoint === "chat"
    ? { model: "openclaw", messages: [{ role: "user", content: text }] }
    : { model: "openclaw", input: text };

  if (sessionUser) {
    return { ...base, user: sessionUser };
  }

  return base;
}

function extractText(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (Array.isArray(payload.choices) && payload.choices.length > 0) {
    const message = payload.choices[0]?.message;
    if (message && typeof message.content === "string") {
      return message.content;
    }
  }

  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (typeof part?.text === "string") {
            return part.text;
          }
        }
      }
    }
  }

  return "";
}

function sendToOpenClaw(text) {
  const payload = buildRequestPayload(text);
  const data = JSON.stringify(payload);
  const client = scheme === "https" ? https : http;
  const path = endpoint === "chat" ? "/v1/chat/completions" : "/v1/responses";

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        method: "POST",
        host: gatewayHost,
        port: gatewayPort,
        path,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...(gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {}),
          ...(agentId ? { "x-openclaw-agent-id": agentId } : {}),
          ...(sessionKey ? { "x-openclaw-session-key": sessionKey } : {})
        }
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`OpenClaw gateway ${res.statusCode}: ${body}`));
          }

          try {
            const parsed = JSON.parse(body || "{}");
            const responseText = extractText(parsed);
            return resolve({ text: responseText, raw: parsed });
          } catch (error) {
            return reject(new Error("OpenClaw response parse failed"));
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("OpenClaw request timeout"));
    });
    req.write(data);
    req.end();
  });
}

module.exports = { sendToOpenClaw };
