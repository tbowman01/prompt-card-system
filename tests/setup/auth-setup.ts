/**
 * Auth Service Test Setup Configuration
 * @description Global setup for authentication service tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Mock auth dependencies
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ id: 'test-user-id', email: 'test@example.com' }),
  decode: jest.fn().mockReturnValue({ id: 'test-user-id', email: 'test@example.com' }),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('salt'),
}));

jest.mock('fastify', () => {
  const mockFastify = {
    register: jest.fn().mockResolvedValue(undefined),
    listen: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    addHook: jest.fn(),
    decorateRequest: jest.fn(),
    decorateReply: jest.fn(),
    ready: jest.fn().mockResolvedValue(undefined),
    log: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  };
  
  return jest.fn(() => mockFastify);
});

// Global auth test configuration
global.AUTH_TEST_CONFIG = {
  JWT_SECRET: 'test-secret-key',
  JWT_EXPIRES_IN: '1h',
  REDIS_URL: 'redis://localhost:6379',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test_auth',
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = global.AUTH_TEST_CONFIG.JWT_SECRET;
  process.env.LOG_LEVEL = 'error';
  
  console.log('🔐 Auth Test Environment Initialized');
});

afterAll(async () => {
  console.log('🔐 Auth Test Environment Cleanup Complete');
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});