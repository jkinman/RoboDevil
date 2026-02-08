module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/services/**/tests/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/archive/'
  ],
  verbose: true,
  collectCoverage: false,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
