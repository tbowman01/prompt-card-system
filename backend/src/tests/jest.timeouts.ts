// Jest timeout configuration for different test types
// This file provides centralized timeout management for all test types

export const TestTimeouts = {
  // Unit tests - fast, no external dependencies
  UNIT: 5000,
  
  // Integration tests - may involve database, Redis, etc.
  INTEGRATION: 30000,
  
  // Docker/E2E tests - full system tests
  DOCKER: 120000,
  
  // Performance baseline tests - comprehensive system profiling
  PERFORMANCE: 300000,
  
  // LLM operation tests - AI model interaction
  LLM_OPERATION: 60000,
  
  // WebSocket tests - real-time communication
  WEBSOCKET: 30000,
  
  // Database tests - complex queries and migrations
  DATABASE: 15000
} as const;

// Helper function to set timeout for specific test types
export function setTestTimeout(testType: keyof typeof TestTimeouts): void {
  jest.setTimeout(TestTimeouts[testType]);
}

// Helper for individual test timeout
export function getTestTimeout(testType: keyof typeof TestTimeouts): number {
  return TestTimeouts[testType];
}

// Timeout configuration for different Jest hooks
export const HookTimeouts = {
  beforeAll: {
    unit: 10000,
    integration: 60000,
    docker: 180000,
    performance: 300000
  },
  afterAll: {
    unit: 5000,
    integration: 30000,
    docker: 60000,
    performance: 60000
  },
  beforeEach: {
    unit: 2000,
    integration: 10000,
    docker: 30000,
    performance: 30000
  },
  afterEach: {
    unit: 2000,
    integration: 10000,
    docker: 15000,
    performance: 15000
  }
} as const;