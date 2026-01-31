const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createJwt({ key, secret, audience }) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key,
    iat: now,
    exp: now + 300
  };
  if (audience) {
    payload.aud = audience;
  }

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function synthesize({ text }) {
  const baseUrl = process.env.INWORLD_BASE_URL;
  const basicToken = process.env.INWORLD_BASIC;
  const key = process.env.INWORLD_JWT_KEY;
  const secret = process.env.INWORLD_SECRET;
  if (!baseUrl) {
    throw new Error("missing INWORLD_BASE_URL");
  }
  if (!basicToken && (!key || !secret)) {
    throw new Error("missing Inworld auth env vars");
  }

  const jwt = basicToken
    ? null
    : createJwt({ key, secret, audience: process.env.INWORLD_JWT_AUD });
  const voiceId = process.env.INWORLD_VOICE_ID;
  const modelId = process.env.INWORLD_MODEL;
  const workspaceId = process.env.INWORLD_WORKSPACE_ID;

  const audioEncoding = process.env.INWORLD_AUDIO_ENCODING || "MP3";
  const speakingRate = Number(process.env.INWORLD_SPEAKING_RATE || 1);
  const temperature = Number(process.env.INWORLD_TEMPERATURE || 1);

  const body = {
    text,
    voice_id: voiceId,
    model_id: modelId,
    audio_config: {
      audio_encoding: audioEncoding,
      speaking_rate: speakingRate
    },
    temperature
  };
  if (workspaceId) {
    body.workspace_id = workspaceId;
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: basicToken ? `Basic ${basicToken}` : `Bearer ${jwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Inworld TTS failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  let audioBuffer;
  if (contentType.includes("audio")) {
    audioBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    const payload = await res.json();
    const audio =
      payload.audioContent ||
      payload.audio_content ||
      payload.audio ||
      "";
    if (!audio) {
      throw new Error("Inworld response missing audio");
    }
    audioBuffer = Buffer.from(audio, "base64");
  }

  const outPath = process.env.TTS_TEMP_AUDIO || "./tmp/tts-output.wav";
  ensureDir(outPath);
  fs.writeFileSync(outPath, audioBuffer);
  return outPath;
}

module.exports = { synthesize, createJwt };
