/**
 * Integration Test Setup Configuration
 * @description Global setup for integration tests with real services
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';

// Test database setup
let testDbPath: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Create test database
  testDbPath = path.join(__dirname, '../../data/test.sqlite');
  await fs.mkdir(path.dirname(testDbPath), { recursive: true });
  
  process.env.DATABASE_PATH = testDbPath;
  process.env.REDIS_URL = 'redis://localhost:6379/15'; // Use test DB
  
  // Test API configuration
  process.env.API_PORT = '0'; // Use random port
  process.env.AUTH_PORT = '0';
  
  console.log('🔗 Integration Test Environment Initialized');
});

afterAll(async () => {
  // Cleanup test database
  try {
    await fs.unlink(testDbPath);
  } catch (error) {
    // File might not exist
  }
  
  console.log('🔗 Integration Test Environment Cleanup Complete');
});

beforeEach(async () => {
  // Reset test database for each test
  try {
    await fs.unlink(testDbPath);
  } catch (error) {
    // File might not exist
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Global utilities for integration tests
global.INTEGRATION_TEST_CONFIG = {
  API_TIMEOUT: 30000,
  DB_TIMEOUT: 10000,
  HEALTH_CHECK_TIMEOUT: 5000,
  MAX_RETRIES: 3,
};