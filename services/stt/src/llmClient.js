const { sendToOpenClaw } = require("./openclawClient");
const { getConfig } = require("../../common/config");

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

async function sendToXai(text) {
  const config = getConfig();
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("missing XAI_API_KEY");
  }

  const baseUrl = config.llm.xai.baseUrl || "https://api.x.ai";
  const endpoint = config.llm.xai.endpoint || "responses";
  const model = config.llm.model || "grok-4";
  const url =
    endpoint === "chat"
      ? `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`
      : `${baseUrl.replace(/\/+$/, "")}/v1/responses`;
  const payload =
    endpoint === "chat"
      ? { model, messages: [{ role: "user", content: text }] }
      : { model, input: text };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`xai request failed: ${res.status} ${errorText}`);
  }

  const parsed = await res.json();
  return { text: extractText(parsed), raw: parsed };
}

function sendToLlm(text) {
  const config = getConfig();
  const provider = config.llm.provider || "openclaw";
  if (provider === "openclaw") {
    return sendToOpenClaw(text);
  }
  if (provider === "xai") {
    return sendToXai(text);
  }
  throw new Error(`unsupported LLM provider: ${provider}`);
}

module.exports = { sendToLlm };
