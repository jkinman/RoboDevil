/**
 * Disk Cleanup Skill
 * Helps free up disk space on the Raspberry Pi
 */

const { execSync } = require('child_process');

async function getDiskUsage() {
  try {
    const output = execSync("df -h / | tail -1 | awk '{print $5, $4}'", { encoding: 'utf8' }).trim();
    const [used, free] = output.split(' ');
    return { used: parseInt(used.replace('%', '')), free, raw: output };
  } catch (e) {
    return { used: 0, free: 'unknown', raw: 'unknown' };
  }
}

async function analyzeSpace() {
  const analysis = {
    totalSize: 0,
    items: []
  };
  
  // Check various directories
  const checks = [
    { name: 'Ollama models', path: '~/.ollama', cmd: "du -sh ~/.ollama 2>/dev/null | cut -f1 || echo '0'" },
    { name: 'Cache directory', path: '~/.cache', cmd: "du -sh ~/.cache 2>/dev/null | cut -f1 || echo '0'" },
    { name: 'npm cache', path: '~/.npm', cmd: "du -sh ~/.npm 2>/dev/null | cut -f1 || echo '0'" },
    { name: 'Global npm', path: '~/.npm-global', cmd: "du -sh ~/.npm-global 2>/dev/null | cut -f1 || echo '0'" },
    { name: 'Go toolchain', path: '~/go', cmd: "du -sh ~/go 2>/dev/null | cut -f1 || echo '0'" },
    { name: 'Docker images', path: 'docker', cmd: "docker system df 2>/dev/null | grep Images | awk '{print $4}' || echo '0'" },
    { name: 'System logs', path: '/var/log', cmd: "du -sh /var/log 2>/dev/null | cut -f1 || echo '0'" },
    { name: 'Temp files', path: '/tmp', cmd: "du -sh /tmp 2>/dev/null | cut -f1 || echo '0'" }
  ];
  
  for (const check of checks) {
    try {
      const size = execSync(check.cmd, { encoding: 'utf8' }).trim();
      if (size && size !== '0') {
        analysis.items.push({ name: check.name, path: check.path, size });
      }
    } catch (e) {
      // Skip if command fails
    }
  }
  
  return analysis;
}

async function cleanup(cleanLevel = 'safe') {
  const results = [];
  let freedSpace = 0;
  
  // Always safe cleanups
  try {
    // Clean npm cache
    execSync('npm cache clean --force 2>/dev/null || true', { encoding: 'utf8' });
    results.push('npm cache cleaned');
  } catch (e) {
    results.push('npm cache: nothing to clean');
  }
  
  try {
    // Clean Go cache
    execSync('go clean -cache 2>/dev/null || true', { encoding: 'utf8' });
    results.push('Go cache cleaned');
  } catch (e) {
    results.push('Go cache: nothing to clean');
  }
  
  try {
    // Vacuum journal logs (keep last 7 days)
    execSync('sudo journalctl --vacuum-time=7d 2>/dev/null || true', { encoding: 'utf8' });
    results.push('System logs cleaned (7 days kept)');
  } catch (e) {
    results.push('System logs: nothing to clean');
  }
  
  try {
    // Clean temp files older than 3 days
    execSync("find /tmp -type f -atime +3 -delete 2>/dev/null || true", { encoding: 'utf8' });
    results.push('Old temp files cleaned');
  } catch (e) {
    results.push('Temp files: nothing to clean');
  }
  
  // Aggressive cleanups (only if requested)
  if (cleanLevel === 'aggressive') {
    try {
      // Remove unused Docker images
      execSync('docker system prune -f 2>/dev/null || true', { encoding: 'utf8' });
      results.push('Unused Docker images removed');
    } catch (e) {
      results.push('Docker: no images to prune');
    }
  }
  
  // Calculate freed space (approximate)
  return { results, freedSpace: 'calculating...' };
}

async function execute(command, context) {
  const cmdLower = command.toLowerCase();
  
  // Analyze disk space
  if (cmdLower.includes('analyze') || cmdLower.includes('check') || cmdLower.includes('what') || cmdLower.includes('where')) {
    const disk = await getDiskUsage();
    const analysis = await analyzeSpace();
    
    let response = `Disk is ${disk.used}% full with ${disk.free} remaining. `;
    response += `Top space consumers: `;
    
    // Top 5 largest items
    analysis.items.slice(0, 5).forEach(item => {
      response += `${item.name}: ${item.size}. `;
    });
    
    response += "Say 'clean up disk' to free space safely. ";
    response += "Or 'aggressive cleanup' for more space.";
    
    return response;
  }
  
  // Cleanup
  if (cmdLower.includes('clean') || cmdLower.includes('free') || cmdLower.includes('clear')) {
    const aggressive = cmdLower.includes('aggressive') || cmdLower.includes('more');
    
    await context.speak("Cleaning up disk space. Please wait.");
    
    const result = await cleanup(aggressive ? 'aggressive' : 'safe');
    
    let response = `Cleanup complete. Actions taken: `;
    result.results.forEach(r => {
      response += r + ". ";
    });
    
    if (aggressive) {
      response += "Aggressive cleanup included Docker images. ";
    } else {
      response += "For more space, say 'aggressive cleanup'. ";
    }
    
    return response;
  }
  
  return "I can analyze disk usage or clean up space. Say 'check disk space' or 'clean up disk'.";
}

module.exports = { execute };
