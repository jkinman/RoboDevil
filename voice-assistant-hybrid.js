#!/usr/bin/env node
/**
 * Squidworth Voice Assistant - Hybrid Skill System
 * Node.js version with TypeScript support ready
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { HybridSkillLoader } = require('./skill-loader');

// Configuration
const AUDIO_FILE = '/tmp/voice-assistant.wav';
const WHISPER_URL = 'http://127.0.0.1:8080/inference';
const IPC_URL = 'http://127.0.0.1:17171';

// TTS function using Inworld
async function speak(text) {
  console.log(`🔊 ${text}`);
  
  try {
    const axios = require('axios');
    const response = await axios.post(
      'https://api.inworld.ai/tts/v1/voice',
      {
        text: text,
        voice_id: 'Hades',
        model_id: 'inworld-tts-1.5-max',
        audio_config: {
          audio_encoding: 'MP3',
          speaking_rate: 1.0
        }
      },
      {
        headers: {
          'Authorization': `Basic ${process.env.INWORLD_BASIC}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    
    // Save and play audio
    const ttsFile = '/tmp/tts-response.mp3';
    fs.writeFileSync(ttsFile, response.data);
    
    await new Promise((resolve) => {
      const play = spawn('pw-play', [ttsFile], { stdio: 'ignore' });
      play.on('close', resolve);
    });
    
  } catch (err) {
    console.error('TTS error:', err.message);
  }
}

// Record audio
async function recordAudio() {
  return new Promise((resolve) => {
    console.log('[Recording+++++]');
    
    const record = spawn('pw-record', [
      '--rate', '16000',
      '--channels', '1',
      '--format', 's16',
      AUDIO_FILE
    ], { stdio: 'ignore' });
    
    // Record for 5 seconds
    setTimeout(() => {
      record.kill();
      resolve();
    }, 5000);
  });
}

// Transcribe audio
async function transcribe() {
  try {
    const axios = require('axios');
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(AUDIO_FILE));
    form.append('response_format', 'text');
    
    const response = await axios.post(WHISPER_URL, form, {
      headers: form.getHeaders()
    });
    
    return response.data.trim();
  } catch (err) {
    console.error('Transcription error:', err.message);
    return '[BLANK_AUDIO]';
  }
}

// Send to OpenClaw
async function sendToOpenClaw(message) {
  try {
    const axios = require('axios');
    await axios.post(`${IPC_URL}/responses`, {
      text: message,
      source: 'voice',
      agentId: 'main'
    });
  } catch (err) {
    // Non-critical
  }
}

// Main loop
async function main() {
  console.log('🦑 Squidworth Voice Assistant - Hybrid Skills');
  console.log('==============================================');
  
  // Load skills
  const skillLoader = new HybridSkillLoader(path.join(__dirname, 'node'));
  await skillLoader.load();
  
  const skills = skillLoader.listSkills();
  console.log(`\n📄 Simple skills: ${skills.simple.map(s => s.name).join(', ')}`);
  console.log(`⚙️  Node skills: ${skills.node.map(s => s.name).join(', ')}`);
  
  await speak("Hello! I'm Squidworth. I can control your lights and help with tasks.");
  
  let cycle = 0;
  
  while (true) {
    cycle++;
    console.log(`\n[${cycle}] 🎤 Listening...`);
    
    await recordAudio();
    
    console.log('  📝 Transcribing...');
    const text = await transcribe();
    
    if (!text || text === '[BLANK_AUDIO]') {
      console.log('  (silence)');
      continue;
    }
    
    console.log(`  ✅ Heard: '${text}'`);
    const textLower = text.toLowerCase();
    
    // Check for wake word
    if (textLower.includes('squidworth') || textLower.includes('squidward')) {
      const message = text.replace(/.*squid(worth|ward)/i, '').trim();
      
      if (!message) {
        await speak("Yes? How can I help?");
        continue;
      }
      
      console.log(`  💬 Routing: '${message}'`);
      
      // Execute skill with context including speak function
      const result = await skillLoader.execute(message, {
        speak: async (text) => {
          await speak(text);
        }
      });
      
      if (result) {
        await speak(result);
      } else {
        await speak("I'm not sure how to help with that yet.");
        await sendToOpenClaw(message);
      }
    } else {
      console.log('  (no wake word)');
    }
  }
}

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled error:', err);
});

// Start
main().catch(console.error);
