/**
 * Light Control Skill (Node.js)
 * Complex skill with Home Assistant integration
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
  const cmdLower = command.toLowerCase();
  
  // Parse brightness
  let brightness = null;
  const brightnessMatch = cmdLower.match(/(\d+)\s*(%|percent)/);
  if (brightnessMatch) {
    brightness = Math.min(100, parseInt(brightnessMatch[1]));
  }
  
  // Parse color
  const colors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'white'];
  let color = null;
  for (const c of colors) {
    if (cmdLower.includes(c)) {
      color = c;
      break;
    }
  }
  
  // Parse target room
  const rooms = ['bedroom', 'living', 'hallway', 'kitchen', 'entrance', 'all'];
  let target = null;
  for (const room of rooms) {
    if (cmdLower.includes(room)) {
      target = room;
      break;
    }
  }
  
  // Parse action
  let action = null;
  if (cmdLower.includes('turn on') || cmdLower.includes('on')) {
    action = 'turn_on';
  } else if (cmdLower.includes('turn off') || cmdLower.includes('off')) {
    action = 'turn_off';
  } else if (brightness !== null) {
    action = 'brightness';
  } else if (color !== null) {
    action = 'color';
  }
  
  if (!action) {
    return "I can turn lights on/off, set brightness (0-100%), or change colors. Try 'turn on bedroom lights' or 'set lights to 50%'";
  }
  
  // Get lights
  const lights = await getLights();
  let targetLights = lights;
  
  // Filter by room
  if (target && target !== 'all') {
    targetLights = lights.filter(light => 
      light.toLowerCase().includes(target.toLowerCase())
    );
  }
  
  if (targetLights.length === 0) {
    return `I couldn't find any lights matching '${target}'`;
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
          white: [255, 255, 255]
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
      console.error(`Failed to control ${light}:`, err.message);
    }
  }
  
  // Response
  if (success > 0) {
    const roomName = target === 'all' ? '' : target + ' ';
    
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
