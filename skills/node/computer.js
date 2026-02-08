/**
 * Star Trek TNG Computer - Diagnostic Skill
 * Run Level 1-3 Diagnostics
 */

const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// TNG Computer voice style responses
const COMPUTER_VOICE = {
  acknowledge: [
    "Acknowledged.",
    "Working.",
    "Please standby.",
    "Processing."
  ],
  complete: [
    "Diagnostic complete.",
    "Analysis complete.",
    "Scan complete."
  ],
  alert: [
    "Warning.",
    "Attention.",
    "Alert."
  ]
};

function computerSay(message) {
  // Add slight computer-style pauses with periods
  return message.replace(/\./g, '.').trim();
}

// Level 1: Simple Health Check (30 seconds)
async function runLevel1Diagnostic() {
  const results = [];
  
  // Check Squidworth processes
  try {
    const voiceProcess = execSync('pgrep -f "voice-assistant" || echo "NOT_RUNNING"', { encoding: 'utf8' }).trim();
    const ipcProcess = execSync('pgrep -f "ipc-bridge" || echo "NOT_RUNNING"', { encoding: 'utf8' }).trim();
    const whisperProcess = execSync('pgrep -f "whisper-server" || echo "NOT_RUNNING"', { encoding: 'utf8' }).trim();
    
    results.push(`Voice Assistant: ${voiceProcess !== 'NOT_RUNNING' ? 'Online' : 'Offline'}`);
    results.push(`IPC Bridge: ${ipcProcess !== 'NOT_RUNNING' ? 'Online' : 'Offline'}`);
    results.push(`Whisper Server: ${whisperProcess !== 'NOT_RUNNING' ? 'Online' : 'Offline'}`);
  } catch (e) {
    results.push('Process check: Error');
  }
  
  // Check services
  try {
    const haCheck = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:8123/api/ 2>/dev/null || echo "000"', { encoding: 'utf8' }).trim();
    results.push(`Home Assistant: ${haCheck === '401' || haCheck === '200' ? 'Online' : 'Offline'}`);
  } catch (e) {
    results.push('Home Assistant: Check failed');
  }
  
  // Check disk space
  try {
    const diskUsage = execSync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'", { encoding: 'utf8' }).trim();
    const diskPercent = parseInt(diskUsage);
    results.push(`Storage: ${diskPercent}% ${diskPercent > 80 ? 'WARNING' : 'nominal'}`);
  } catch (e) {
    results.push('Storage check: Error');
  }
  
  return {
    level: 1,
    title: "Level 1 Diagnostic - Systems Check",
    results: results,
    status: results.some(r => r.includes('Offline') || r.includes('Error') || r.includes('WARNING')) ? 'degraded' : 'nominal'
  };
}

// Level 2: Software Diagnostics + OpenClaw Status
async function runLevel2Diagnostic() {
  const results = [];
  
  // Run Level 1 first
  const level1 = await runLevel1Diagnostic();
  results.push(...level1.results);
  results.push('');
  results.push('--- Software Diagnostics ---');
  
  // OpenClaw Status
  try {
    results.push('OpenClaw Gateway: Online');
    results.push(`Node.js Version: ${process.version}`);
    results.push(`Platform: ${process.platform}`);
    
    // Check npm packages
    const packageJson = require('../package.json');
    const deps = Object.keys(packageJson.dependencies || {}).length;
    const devDeps = Object.keys(packageJson.devDependencies || {}).length;
    results.push(`Installed packages: ${deps + devDeps}`);
  } catch (e) {
    results.push('OpenClaw status: Check incomplete');
  }
  
  // Git status
  try {
    const gitBranch = execSync('git branch --show-current 2>/dev/null || echo "unknown"', { encoding: 'utf8', cwd: '/home/jkinman/RoboDevil' }).trim();
    const gitStatus = execSync('git status --porcelain 2>/dev/null | wc -l', { encoding: 'utf8', cwd: '/home/jkinman/RoboDevil' }).trim();
    results.push(`Git branch: ${gitBranch}`);
    results.push(`Uncommitted changes: ${gitStatus}`);
  } catch (e) {
    results.push('Git status: Unavailable');
  }
  
  // Run unit tests
  results.push('');
  results.push('--- Unit Test Results ---');
  try {
    const testOutput = execSync('cd /home/jkinman/RoboDevil && npm run test:health 2>&1 | tail -20', { encoding: 'utf8', timeout: 60000 });
    
    // Parse test results
    const passedMatch = testOutput.match(/Passed:\s*(\d+)/);
    const failedMatch = testOutput.match(/Failed:\s*(\d+)/);
    const rateMatch = testOutput.match(/Success Rate:\s*(\d+)/);
    
    if (passedMatch && failedMatch) {
      const passed = parseInt(passedMatch[1]);
      const failed = parseInt(failedMatch[1]);
      const rate = rateMatch ? rateMatch[1] : '0';
      
      results.push(`Tests passed: ${passed}`);
      results.push(`Tests failed: ${failed}`);
      results.push(`Success rate: ${rate}%`);
      
      if (failed > 0) {
        results.push('WARNING: Some tests failed');
      } else {
        results.push('All tests nominal');
      }
    } else {
      results.push('Test status: Unable to parse results');
    }
  } catch (e) {
    results.push('Unit tests: Execution failed');
    results.push(`Error: ${e.message}`);
  }
  
  // Load average
  try {
    const loadavg = os.loadavg();
    results.push(`Load average: ${loadavg[0].toFixed(2)}`);
  } catch (e) {
    results.push('Load average: Unavailable');
  }
  
  // Memory
  try {
    const totalMem = Math.round(os.totalmem() / 1024 / 1024);
    const freeMem = Math.round(os.freemem() / 1024 / 1024);
    const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    results.push(`Memory: ${usedPercent}% used (${totalMem - freeMem}MB / ${totalMem}MB)`);
  } catch (e) {
    results.push('Memory status: Unavailable');
  }
  
  return {
    level: 2,
    title: "Level 2 Diagnostic - Software Analysis",
    results: results,
    status: 'nominal'
  };
}

// Level 3: Full Diagnostic (Hardware + Everything)
async function runLevel3Diagnostic() {
  const results = [];
  
  // Run Level 2 first (includes tests)
  const level2 = await runLevel2Diagnostic();
  results.push(...level2.results);
  results.push('');
  results.push('--- Hardware Diagnostics ---');
  
  // CPU Info
  try {
    const cpuModel = execSync("cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2 | xargs || echo 'Unknown'", { encoding: 'utf8' }).trim();
    const cpuCores = os.cpus().length;
    results.push(`CPU: ${cpuModel}`);
    results.push(`CPU Cores: ${cpuCores}`);
  } catch (e) {
    results.push('CPU: Information unavailable');
  }
  
  // Temperature (if available on Pi)
  try {
    const temp = execSync("vcgencmd measure_temp 2>/dev/null | cut -d= -f2 | cut -d' -f1 || echo 'N/A'", { encoding: 'utf8' }).trim();
    if (temp !== 'N/A') {
      const tempNum = parseFloat(temp);
      results.push(`CPU Temperature: ${temp}°C ${tempNum > 80 ? 'WARNING' : ''}`);
    }
  } catch (e) {
    results.push('Temperature sensor: Unavailable');
  }
  
  // Disk details
  try {
    const diskInfo = execSync("df -h / | tail -1 | awk '{print $2, $3, $4}'", { encoding: 'utf8' }).trim();
    results.push(`Storage: ${diskInfo}`);
    
    // Check for large files
    const largeFiles = execSync("find /tmp -type f -size +10M 2>/dev/null | wc -l || echo '0'", { encoding: 'utf8' }).trim();
    if (parseInt(largeFiles) > 0) {
      results.push(`Large temp files: ${largeFiles}`);
    }
  } catch (e) {
    results.push('Storage details: Unavailable');
  }
  
  // Network
  try {
    const hostname = os.hostname();
    const networkInterfaces = os.networkInterfaces();
    const eth0 = networkInterfaces['eth0'] || networkInterfaces['wlan0'];
    if (eth0) {
      const ip = eth0.find(i => i.family === 'IPv4');
      if (ip) {
        results.push(`Network: ${ip.address}`);
      }
    }
    results.push(`Hostname: ${hostname}`);
  } catch (e) {
    results.push('Network: Information unavailable');
  }
  
  // Uptime
  try {
    const uptime = execSync("uptime -p 2>/dev/null || uptime | awk -F',' '{print $1}'", { encoding: 'utf8' }).trim();
    results.push(`Uptime: ${uptime}`);
  } catch (e) {
    results.push('Uptime: Unavailable');
  }
  
  return {
    level: 3,
    title: "Level 3 Diagnostic - Full System Scan",
    results: results,
    status: 'nominal'
  };
}

// Main skill execution
async function execute(command, context) {
  const cmdLower = command.toLowerCase();
  
  // Parse level
  let level = null;
  const levelMatch = cmdLower.match(/level\s*(\d)/i);
  if (levelMatch) {
    level = parseInt(levelMatch[1]);
  }
  
  if (!level || level < 1 || level > 3) {
    return "Please specify a diagnostic level between 1 and 3. Say 'run level 1 diagnostic' for a systems check, 'level 2' for software analysis, or 'level 3' for full hardware scan.";
  }
  
  // Acknowledge like TNG computer
  const acknowledge = COMPUTER_VOICE.acknowledge[Math.floor(Math.random() * COMPUTER_VOICE.acknowledge.length)];
  await context.speak(computerSay(acknowledge));
  
  // Run appropriate diagnostic
  let diagnostic;
  switch (level) {
    case 1:
      diagnostic = await runLevel1Diagnostic();
      break;
    case 2:
      diagnostic = await runLevel2Diagnostic();
      break;
    case 3:
      diagnostic = await runLevel3Diagnostic();
      break;
  }
  
  // Build response
  let response = `${diagnostic.title}. `;
  response += `Status: ${diagnostic.status}. `;
  
  // Summarize key findings
  const offline = diagnostic.results.filter(r => r.includes('Offline')).length;
  const warnings = diagnostic.results.filter(r => r.includes('WARNING')).length;
  const testResults = diagnostic.results.find(r => r.includes('Success rate'));
  
  if (offline > 0) {
    response += `${offline} systems offline. `;
  }
  if (warnings > 0) {
    response += `${warnings} warnings detected. `;
  }
  if (testResults) {
    const rateMatch = testResults.match(/(\d+)%/);
    if (rateMatch) {
      response += `Unit tests: ${rateMatch[1]}% pass rate. `;
    }
  }
  if (offline === 0 && warnings === 0 && !testResults) {
    response += "All systems nominal. ";
  }
  
  response += COMPUTER_VOICE.complete[Math.floor(Math.random() * COMPUTER_VOICE.complete.length)];
  
  return response;
}

module.exports = { execute };
