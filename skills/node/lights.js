/**
 * Light Control Skill (Node.js)
 * Complex skill with Home Assistant integration
 * Supports flexible sentence structures
 */

const axios = require('axios');

const HA_URL = process.env.HOME_ASSISTANT_URL || 'http://localhost:8123';
const HA_TOKEN = process.env.HOME_ASSISTANT_TOKEN;

// Home Assistant API helper
async function haCallService(domain, service, data) {
  if (!HA_TOKEN) {
    throw new Error('Home Assistant token not configured');
  }

  await axios.post(
    `${HA_URL}/api/services/${domain}/${service}`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

// Get all lights
async function getLights() {
  const response = await axios.get(
    `${HA_URL}/api/states`,
    {
      headers: { 'Authorization': `Bearer ${HA_TOKEN}` }
    }
  );
  
  return response.data
    .filter(entity => entity.entity_id.startsWith('light.'))
    .map(entity => entity.entity_id);
}

// Main skill execution
async function execute(command, context) {
  const cmdLower = command.toLowerCase().trim();
  
  // DEBUG: Log what we received
  console.log(`  [lights] Processing: "${cmdLower}"`);
  
  // Parse brightness - look for patterns like "50%", "50 percent"
  let brightness = null;
  const brightnessMatch = cmdLower.match(/(\d+)\s*(%|percent|percent brightness)/);
  if (brightnessMatch) {
    brightness = Math.min(100, parseInt(brightnessMatch[1]));
    console.log(`  [lights] Found brightness: ${brightness}%`);
  }
  
  // Parse color - check if color words appear anywhere in command
  const colors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'white', 'warm', 'cool', 'cold'];
  let color = null;
  for (const c of colors) {
    // Use word boundary check to avoid partial matches
    const colorRegex = new RegExp(`\\b${c}\\b`);
    if (colorRegex.test(cmdLower)) {
      color = c;
      console.log(`  [lights] Found color: ${color}`);
      break;
    }
  }
  
  // Parse target room
  const rooms = ['bedroom', 'living', 'living room', 'hallway', 'kitchen', 'entrance', 'all'];
  let target = null;
  for (const room of rooms) {
    if (cmdLower.includes(room)) {
      target = room.replace(' ', '_'); // living room -> living_room
      console.log(`  [lights] Found room: ${target}`);
      break;
    }
  }
  
  // Parse action - be more flexible with sentence structures
  let action = null;
  
  // Direct on/off commands
  if (cmdLower.includes('turn on') || cmdLower.match(/\bon\b/)) {
    action = 'turn_on';
    console.log(`  [lights] Action: turn_on`);
  } else if (cmdLower.includes('turn off') || cmdLower.match(/\boff\b/)) {
    action = 'turn_off';
    console.log(`  [lights] Action: turn_off`);
  } 
  // Brightness commands - various ways to say it
  else if (brightness !== null && (
    cmdLower.includes('set') || 
    cmdLower.includes('brightness') || 
    cmdLower.includes('dim') ||
    cmdLower.includes('bright') ||
    cmdLower.includes('make')
  )) {
    action = 'brightness';
    console.log(`  [lights] Action: brightness`);
  }
  // Color commands - various ways to say it
  else if (color !== null && (
    cmdLower.includes('color') ||
    cmdLower.includes('set') ||
    cmdLower.includes('make') ||
    cmdLower.includes('change') ||
    cmdLower.includes('switch') ||
    cmdLower.includes('to') ||
    cmdLower.includes('the')
  )) {
    action = 'color';
    console.log(`  [lights] Action: color (${color})`);
  }
  // Fallback: if we have a color but no other action detected, assume color change
  else if (color !== null) {
    action = 'color';
    console.log(`  [lights] Action: color (fallback, ${color})`);
  }
  
  if (!action) {
    console.log(`  [lights] No action detected`);
    return "I can turn lights on/off, set brightness (0-100%), or change colors. Try 'turn on bedroom lights', 'set lights to 50%', 'make lights warm', or 'change lights to blue'";
  }
  
  // Get lights
  const lights = await getLights();
  let targetLights = lights;
  
  console.log(`  [lights] Total lights: ${lights.length}`);
  
  // Filter by room
  if (target && target !== 'all') {
    targetLights = lights.filter(light => 
      light.toLowerCase().includes(target.toLowerCase())
    );
    console.log(`  [lights] Filtered to ${targetLights.length} lights for room: ${target}`);
  }
  
  if (targetLights.length === 0) {
    return `I couldn't find any lights matching '${target || 'all'}'`;
  }
  
  // Execute action
  let success = 0;
  
  for (const light of targetLights) {
    try {
      if (action === 'brightness') {
        const brightnessValue = Math.round(brightness * 255 / 100);
        await haCallService('light', 'turn_on', {
          entity_id: light,
          brightness: brightnessValue
        });
      } else if (action === 'color') {
        const colorMap = {
          red: [255, 0, 0],
          green: [0, 255, 0],
          blue: [0, 0, 255],
          yellow: [255, 255, 0],
          orange: [255, 165, 0],
          purple: [128, 0, 128],
          pink: [255, 192, 203],
          white: [255, 255, 255],
          warm: [255, 200, 100],      // Warm white (2700K)
          cool: [200, 220, 255],      // Cool white (6500K)
          cold: [200, 220, 255]       // Alias for cool
        };
        await haCallService('light', 'turn_on', {
          entity_id: light,
          rgb_color: colorMap[color] || [255, 255, 255]
        });
      } else {
        await haCallService('light', action, {
          entity_id: light
        });
      }
      success++;
    } catch (err) {
      console.error(`  [lights] Failed to control ${light}:`, err.message);
    }
  }
  
  // Response
  if (success > 0) {
    const roomName = target === 'all' || !target ? '' : target.replace('_', ' ') + ' ';
    
    switch (action) {
      case 'turn_on':
        return `I've turned on ${success} ${roomName}lights.`;
      case 'turn_off':
        return `I've turned off ${success} ${roomName}lights.`;
      case 'brightness':
        return `I've set ${success} ${roomName}lights to ${brightness}% brightness.`;
      case 'color':
        return `I've set ${success} ${roomName}lights to ${color}.`;
      default:
        return `I've controlled ${success} lights.`;
    }
  }
  
  return "Sorry, I couldn't control the lights.";
}

module.exports = { execute };
