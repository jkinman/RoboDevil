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

// Level 3: Critical System Health - Dynamic/Problem Indicators Only
async function runLevel3Diagnostic() {
  const results = [];
  const warnings = [];
  
  results.push('--- Critical System Health ---');
  
  // 1. CPU Temperature (Dynamic - changes with load)
  try {
    const temp = execSync("vcgencmd measure_temp 2>/dev/null | cut -d= -f2 | cut -d' -f1 || echo 'N/A'", { encoding: 'utf8' }).trim();
    if (temp !== 'N/A') {
      const tempNum = parseFloat(temp);
      if (tempNum > 80) {
        warnings.push(`CRITICAL: CPU temperature ${temp}°C - thermal throttling imminent`);
      } else if (tempNum > 70) {
        warnings.push(`WARNING: CPU temperature ${temp}°C - elevated`);
      } else {
        results.push(`CPU temperature: ${temp}°C - normal`);
      }
    }
  } catch (e) {
    results.push('Temperature: Unavailable');
  }
  
  // 2. Power/Undervoltage (Causes SD card corruption, instability)
  try {
    const throttled = execSync("vcgencmd get_throttled 2>/dev/null | cut -d= -f2 || echo 'unknown'", { encoding: 'utf8' }).trim();
    if (throttled !== '0x0' && throttled !== 'unknown') {
      const throttledHex = parseInt(throttled, 16);
      // Decode throttled bits
      if (throttledHex & 0x1) warnings.push('CRITICAL: Under-voltage detected - power supply insufficient');
      if (throttledHex & 0x2) warnings.push('WARNING: ARM frequency capped due to temperature');
      if (throttledHex & 0x4) warnings.push('WARNING: Currently throttled');
      if (throttledHex & 0x8) warnings.push('WARNING: Soft temperature limit active');
      if (throttledHex & 0x10000) warnings.push('HISTORY: Under-voltage occurred since boot');
      if (throttledHex & 0x20000) warnings.push('HISTORY: ARM frequency capped since boot');
      if (throttledHex & 0x40000) warnings.push('HISTORY: Throttling occurred since boot');
      if (throttledHex & 0x80000) warnings.push('HISTORY: Soft temperature limit reached since boot');
    } else {
      results.push('Power status: Nominal - no throttling');
    }
  } catch (e) {
    results.push('Power status: Check unavailable');
  }
  
  // 3. Memory Pressure (Dynamic - can cause OOM kills)
  try {
    const totalMem = Math.round(os.totalmem() / 1024 / 1024);
    const freeMem = Math.round(os.freemem() / 1024 / 1024);
    const availableMem = Math.round(parseInt(execSync("cat /proc/meminfo | grep MemAvailable | awk '{print $2}'", { encoding: 'utf8' }).trim()) / 1024);
    const usedPercent = Math.round(((totalMem - availableMem) / totalMem) * 100);
    
    if (usedPercent > 95) {
      warnings.push(`CRITICAL: Memory pressure ${usedPercent}% - OOM kills imminent`);
    } else if (usedPercent > 85) {
      warnings.push(`WARNING: Memory pressure ${usedPercent}% - elevated`);
    } else {
      results.push(`Memory pressure: ${usedPercent}% - acceptable`);
    }
    
    // Check swap usage (indicates memory pressure)
    const swapUsed = parseInt(execSync("free -m | grep Swap | awk '{print $3}'", { encoding: 'utf8' }).trim());
    if (swapUsed > 500) {
      warnings.push(`WARNING: Heavy swap usage ${swapUsed}MB - system thrashing`);
    } else if (swapUsed > 100) {
      results.push(`Swap usage: ${swapUsed}MB - light`);
    } else {
      results.push(`Swap usage: ${swapUsed}MB - minimal`);
    }
  } catch (e) {
    results.push('Memory status: Check unavailable');
  }
  
  // 4. Disk Space (Dynamic - fills up over time)
  try {
    const diskUsage = execSync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'", { encoding: 'utf8' }).trim();
    const diskPercent = parseInt(diskUsage);
    const diskFree = execSync("df -h / | tail -1 | awk '{print $4}'", { encoding: 'utf8' }).trim();
    
    if (diskPercent > 95) {
      warnings.push(`CRITICAL: Disk ${diskPercent}% full - only ${diskFree} remaining`);
    } else if (diskPercent > 85) {
      warnings.push(`WARNING: Disk ${diskPercent}% full`);
    } else {
      results.push(`Disk usage: ${diskPercent}% - healthy`);
    }
  } catch (e) {
    results.push('Disk status: Check unavailable');
  }
  
  // 5. I/O Wait (Dynamic - indicates disk/SD card problems)
  try {
    const iowait = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $10}' | sed 's/%wa,//'", { encoding: 'utf8' }).trim();
    const iowaitNum = parseFloat(iowait);
    if (iowaitNum > 20) {
      warnings.push(`CRITICAL: High I/O wait ${iowaitNum}% - SD card may be failing`);
    } else if (iowaitNum > 10) {
      warnings.push(`WARNING: Elevated I/O wait ${iowaitNum}%`);
    } else {
      results.push(`I/O wait: ${iowaitNum}% - normal`);
    }
  } catch (e) {
    results.push('I/O status: Check unavailable');
  }
  
  // 6. Load Average (Dynamic - system stress indicator)
  try {
    const loadavg = os.loadavg();
    const cpuCores = os.cpus().length;
    const loadPercent = (loadavg[0] / cpuCores) * 100;
    
    if (loadPercent > 200) {
      warnings.push(`CRITICAL: System overloaded - load ${loadavg[0].toFixed(2)} on ${cpuCores} cores`);
    } else if (loadPercent > 100) {
      warnings.push(`WARNING: High load ${loadavg[0].toFixed(2)} - all cores busy`);
    } else if (loadPercent > 70) {
      results.push(`Load: ${loadavg[0].toFixed(2)} - elevated`);
    } else {
      results.push(`Load: ${loadavg[0].toFixed(2)} - normal`);
    }
  } catch (e) {
    results.push('Load status: Check unavailable');
  }
  
  // 7. Failed Systemd Units (Services that crashed)
  try {
    const failedUnits = execSync("systemctl --failed --no-pager --no-legend 2>/dev/null | wc -l", { encoding: 'utf8' }).trim();
    const failedCount = parseInt(failedUnits);
    if (failedCount > 0) {
      warnings.push(`WARNING: ${failedCount} failed systemd units detected`);
    } else {
      results.push('Services: All systemd units active');
    }
  } catch (e) {
    results.push('Services: Check unavailable');
  }
  
  // 8. Zombie Processes (Indicate process issues)
  try {
    const zombies = execSync("ps aux | grep -c '[Zz]ombie' || echo '0'", { encoding: 'utf8' }).trim();
    const zombieCount = parseInt(zombies);
    if (zombieCount > 5) {
      warnings.push(`WARNING: ${zombieCount} zombie processes - parent processes not reaping children`);
    } else if (zombieCount > 0) {
      results.push(`Zombies: ${zombieCount} - minor`);
    } else {
      results.push('Zombies: None');
    }
  } catch (e) {
    results.push('Process status: Check unavailable');
  }
  
  // 9. Recent System Errors (Last hour)
  try {
    const recentErrors = execSync("journalctl --priority=err --since '1 hour ago' --no-pager 2>/dev/null | wc -l || echo '0'", { encoding: 'utf8' }).trim();
    const errorCount = parseInt(recentErrors);
    if (errorCount > 10) {
      warnings.push(`WARNING: ${errorCount} errors in last hour`);
    } else if (errorCount > 0) {
      results.push(`Recent errors: ${errorCount} in last hour`);
    } else {
      results.push('Recent errors: None in last hour');
    }
  } catch (e) {
    results.push('Error log: Check unavailable');
  }
  
  // 10. Network Issues (Packet errors)
  try {
    const eth0Errors = execSync("cat /sys/class/net/eth0/statistics/rx_errors 2>/dev/null || echo '0'", { encoding: 'utf8' }).trim();
    const eth0Drops = execSync("cat /sys/class/net/eth0/statistics/rx_dropped 2>/dev/null || echo '0'", { encoding: 'utf8' }).trim();
    const errorCount = parseInt(eth0Errors) + parseInt(eth0Drops);
    
    if (errorCount > 100) {
      warnings.push(`WARNING: Network errors/drops: ${errorCount} - check cable/interface`);
    } else if (errorCount > 0) {
      results.push(`Network errors: ${errorCount} - minor`);
    } else {
      results.push('Network: No errors');
    }
  } catch (e) {
    results.push('Network: Check unavailable');
  }
  
  // Combine results - warnings first, then normal results
  const finalResults = [...warnings, '', ...results];
  
  return {
    level: 3,
    title: "Level 3 Diagnostic - Critical System Health",
    results: finalResults,
    status: warnings.length > 0 ? (warnings.some(w => w.includes('CRITICAL')) ? 'critical' : 'degraded') : 'nominal',
    warningCount: warnings.length,
    criticalCount: warnings.filter(w => w.includes('CRITICAL')).length
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
    return "Please specify a diagnostic level between 1 and 3. Say 'run level 1 diagnostic' for a systems check, 'level 2' for software analysis, or 'level 3' for critical health scan.";
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
  if (level === 3) {
    if (diagnostic.criticalCount > 0) {
      response += `${diagnostic.criticalCount} CRITICAL issues detected. Immediate attention required. `;
    } else if (diagnostic.warningCount > 0) {
      response += `${diagnostic.warningCount} warnings detected. `;
    } else {
      response += "All critical systems nominal. ";
    }
  } else {
    const offline = diagnostic.results.filter(r => r.includes('Offline')).length;
    const warnings = diagnostic.results.filter(r => r.includes('WARNING')).length;
    const testResults = diagnostic.results.find(r => r.includes('Success rate'));
    
    if (offline > 0) response += `${offline} systems offline. `;
    if (warnings > 0) response += `${warnings} warnings detected. `;
    if (testResults) {
      const rateMatch = testResults.match(/(\d+)%/);
      if (rateMatch) response += `Unit tests: ${rateMatch[1]}% pass rate. `;
    }
    if (offline === 0 && warnings === 0 && !testResults) {
      response += "All systems nominal. ";
    }
  }
  
  response += COMPUTER_VOICE.complete[Math.floor(Math.random() * COMPUTER_VOICE.complete.length)];
  
  return response;
}

module.exports = { execute };
