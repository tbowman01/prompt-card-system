/**
 * Root Jest Configuration for Comprehensive Test Suite
 * @description Central Jest configuration managing all test types
 */

module.exports = {
  projects: [
    // Unit Tests
    {
      displayName: 'unit-backend',
      testMatch: ['<rootDir>/tests/unit/backend/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      collectCoverageFrom: [
        '<rootDir>/backend/src/**/*.{ts,tsx}',
        '!<rootDir>/backend/src/**/*.d.ts',
        '!<rootDir>/backend/src/**/*.test.ts',
        '!<rootDir>/backend/src/tests/**',
      ],
      coverageDirectory: '<rootDir>/coverage/unit/backend',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/unit-setup.ts'],
      moduleNameMapper: {
        '^@backend/(.*)$': '<rootDir>/backend/src/$1',
      },
    },
    {
      displayName: 'unit-frontend',
      testMatch: ['<rootDir>/tests/unit/frontend/**/*.test.tsx', '<rootDir>/tests/unit/frontend/**/*.test.ts'],
      testEnvironment: 'jsdom',
      preset: 'ts-jest',
      collectCoverageFrom: [
        '<rootDir>/frontend/src/**/*.{ts,tsx}',
        '!<rootDir>/frontend/src/**/*.d.ts',
        '!<rootDir>/frontend/src/**/*.test.ts',
        '!<rootDir>/frontend/src/**/*.test.tsx',
        '!<rootDir>/frontend/src/app/layout.tsx',
      ],
      coverageDirectory: '<rootDir>/coverage/unit/frontend',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/frontend-setup.ts'],
      moduleNameMapper: {
        '^@frontend/(.*)$': '<rootDir>/frontend/src/$1',
        '^@/(.*)$': '<rootDir>/frontend/src/$1',
      },
    },
    {
      displayName: 'unit-auth',
      testMatch: ['<rootDir>/tests/unit/auth/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      collectCoverageFrom: [
        '<rootDir>/auth/src/**/*.{ts,tsx}',
        '!<rootDir>/auth/src/**/*.d.ts',
        '!<rootDir>/auth/src/**/*.test.ts',
      ],
      coverageDirectory: '<rootDir>/coverage/unit/auth',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/auth-setup.ts'],
      moduleNameMapper: {
        '^@auth/(.*)$': '<rootDir>/auth/src/$1',
      },
    },
    // Integration Tests
    {
      displayName: 'integration-api',
      testMatch: ['<rootDir>/tests/integration/api/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.ts'],
      testTimeout: 60000,
    },
    {
      displayName: 'integration-database',
      testMatch: ['<rootDir>/tests/integration/database/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.ts'],
      testTimeout: 30000,
    },
    {
      displayName: 'integration-services',
      testMatch: ['<rootDir>/tests/integration/services/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.ts'],
      testTimeout: 45000,
    },
    // Performance Tests
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/performance/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/performance-setup.ts'],
      testTimeout: 180000,
    },
    // E2E Tests
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e-setup.ts'],
      testTimeout: 300000,
    },
    // Docker Tests
    {
      displayName: 'docker',
      testMatch: ['<rootDir>/tests/docker/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/docker-setup.ts'],
      testTimeout: 600000,
    },
  ],
  // Global configuration
  collectCoverageFrom: [
    '<rootDir>/backend/src/**/*.{ts,tsx}',
    '<rootDir>/frontend/src/**/*.{ts,tsx}',
    '<rootDir>/auth/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: '<rootDir>/coverage',
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
};