/**
 * Jest Test Setup
 */

// Set test environment variables if not already set
process.env.HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://localhost:8123';
process.env.WHISPER_URL = process.env.WHISPER_URL || 'http://localhost:8080/inference';
process.env.IPC_URL = process.env.IPC_URL || 'http://localhost:17171';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  mockSkillResponse(skillName, response) {
    return {
      name: skillName,
      patterns: [skillName],
      execute: jest.fn().mockResolvedValue(response)
    };
  }
};

// Log test start
console.log('🦑 Squidworth Test Suite Starting...\n');
