// Jest configuration with fixed coverage collection
const path = require('path');

module.exports = {
  // Use SWC for speed
  preset: undefined,
  testEnvironment: 'node',
  
  // Define project root
  rootDir: path.resolve(__dirname),
  
  // Only look for tests in src
  roots: ['<rootDir>/src'],
  
  // Test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.ts',
    '<rootDir>/src/**/?(*.)+(spec|test).ts'
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: false,
          decorators: true
        },
        target: 'es2020',
        loose: false,
        externalHelpers: false
      },
      module: {
        type: 'commonjs'
      },
      sourceMaps: 'inline'
    }]
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  globalSetup: '<rootDir>/src/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/src/tests/globalTeardown.ts',
  
  // Module configuration
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // CRITICAL: Fixed coverage collection
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/tests/**',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/**/index.ts',
    '!<rootDir>/src/types/**'
  ],
  
  // Coverage options
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageProvider: 'v8',
  
  // Only collect coverage from src directory
  collectCoverageOnlyFrom: {
    '<rootDir>/src/**/*.ts': true
  },
  
  // Ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.jest-cache/',
    '/dist/',
    '/coverage/'
  ],
  
  // Path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(chai|better-sqlite3)/)'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85
    }
  },
  
  // Performance settings
  testTimeout: 30000,
  maxWorkers: '50%',
  forceExit: true,
  detectOpenHandles: true,
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache'
};