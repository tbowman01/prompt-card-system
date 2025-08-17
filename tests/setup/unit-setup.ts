/**
 * Unit Test Setup Configuration
 * @description Global setup for all unit tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Mock external dependencies for unit tests
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    }),
    close: jest.fn(),
    exec: jest.fn(),
  }));
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    disconnect: jest.fn(),
  }));
});

jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
  })),
}));

// Global test utilities
global.TEST_TIMEOUT = {
  UNIT: 15000,
  INTEGRATION: 60000,
  E2E: 120000,
  PERFORMANCE: 180000,
};

// Test environment validation
beforeAll(async () => {
  // Validate test environment
  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }
  
  // Setup test database path
  process.env.DATABASE_PATH = ':memory:';
  process.env.LOG_LEVEL = 'error';
  
  console.log('🧪 Unit Test Environment Initialized');
});

afterAll(async () => {
  console.log('🧪 Unit Test Environment Cleanup Complete');
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});