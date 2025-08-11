// Test setup for backend tests
import 'reflect-metadata';
import { TestTimeouts } from './jest.timeouts';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_PATH = ':memory:';
process.env.LOG_LEVEL = 'error';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless LOG_LEVEL is debug
  if (process.env.LOG_LEVEL !== 'debug') {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    // Keep console.error for debugging failed tests
  }
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test timeout - default to integration timeout
jest.setTimeout(TestTimeouts.INTEGRATION);

// Mock fetch for Node.js environment
global.fetch = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});