#!/usr/bin/env node
/**
 * Voice Assistant Health Check & Test Suite
 * For Hybrid Skill System
 */

const { HybridSkillLoader } = require('../skills/skill-loader');
const path = require('path');
const axios = require('axios');

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  return new Promise(async (resolve) => {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: '✅ PASS' });
      console.log(`  ✅ ${name}`);
      resolve(true);
    } catch (err) {
      results.failed++;
      results.tests.push({ name, status: '❌ FAIL', error: err.message });
      console.log(`  ❌ ${name}: ${err.message}`);
      resolve(false);
    }
  });
}

async function runTests() {
  console.log('🦑 Squidworth Health Check & Test Suite');
  console.log('========================================\n');

  // 1. Skill System Tests
  console.log('📦 Skill System Tests');
  
  await test('Skill loader initializes', async () => {
    const loader = new HybridSkillLoader(path.join(__dirname, '../skills'));
    const loaded = await loader.load();
    if (!loaded) throw new Error('Failed to load skills');
  });

  await test('Simple skills loaded', async () => {
    const loader = new HybridSkillLoader(path.join(__dirname, '../skills'));
    await loader.load();
    const skills = loader.listSkills();
    if (skills.simple.length === 0) throw new Error('No simple skills found');
  });

  await test('Node skills loaded', async () => {
    const loader = new HybridSkillLoader(path.join(__dirname, '../skills'));
    await loader.load();
    const skills = loader.listSkills();
    if (skills.node.length === 0) throw new Error('No Node skills found');
  });

  await test('Simple skill execution works', async () => {
    const loader = new HybridSkillLoader(path.join(__dirname, '../skills'));
    await loader.load();
    const result = await loader.execute('what time is it', {});
    if (!result || !result.includes('M')) throw new Error('Unexpected response: ' + result);
  });

  // 2. Service Connectivity Tests
  console.log('\n🌐 Service Connectivity Tests');

  await test('IPC Bridge is accessible', async () => {
    try {
      const response = await axios.get('http://localhost:17171/', { timeout: 2000 });
      if (response.status !== 200) throw new Error(`Status: ${response.status}`);
    } catch (err) {
      throw new Error(`IPC Bridge not responding: ${err.message}`);
    }
  });

  await test('Whisper Server is accessible', async () => {
    try {
      // Whisper returns 404 for GET, that's ok - means it's running
      await axios.get('http://localhost:8080/', { timeout: 2000 });
    } catch (err) {
      if (!err.response || err.response.status !== 404) {
        throw new Error(`Whisper not responding: ${err.message}`);
      }
    }
  });

  await test('Home Assistant is accessible', async () => {
    try {
      const response = await axios.get('http://localhost:8123/api/', { 
        timeout: 3000,
        validateStatus: () => true
      });
      // 401 is expected if token not provided, means HA is running
      if (response.status !== 401 && response.status !== 200) {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (err) {
      throw new Error(`HA not responding: ${err.message}`);
    }
  });

  // 3. Environment Tests
  console.log('\n🔐 Environment Tests');

  await test('MATON_API_KEY is set', async () => {
    if (!process.env.MATON_API_KEY) throw new Error('MATON_API_KEY not found');
  });

  await test('HOME_ASSISTANT_TOKEN is set', async () => {
    if (!process.env.HOME_ASSISTANT_TOKEN) throw new Error('HA token not found');
  });

  await test('INWORLD_BASIC is set', async () => {
    if (!process.env.INWORLD_BASIC) throw new Error('Inworld token not found');
  });

  // 4. Light Control Tests (if HA available)
  console.log('\n💡 Light Control Tests');

  await test('Can fetch lights from HA', async () => {
    const token = process.env.HOME_ASSISTANT_TOKEN;
    if (!token) throw new Error('HA token not set');
    
    const response = await axios.get('http://localhost:8123/api/states', {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 5000
    });
    
    const lights = response.data.filter(e => e.entity_id.startsWith('light.'));
    if (lights.length === 0) throw new Error('No lights found in HA');
    console.log(`     Found ${lights.length} lights`);
  });

  // 5. Summary
  console.log('\n========================================');
  console.log('📊 Test Summary');
  console.log('========================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  
  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests.filter(t => t.status === '❌ FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Squidworth is healthy.');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  runTests().catch(err => {
    console.error('💥 Test suite crashed:', err);
    process.exit(1);
  });
}

module.exports = { runTests, results };
