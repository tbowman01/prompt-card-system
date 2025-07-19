module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      isolatedModules: true,
      tsconfig: {
        module: 'commonjs',
        target: 'es2020'
      }
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  testTimeout: 120000, // 2 minutes for LLM operations
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globalSetup: '<rootDir>/src/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/src/tests/globalTeardown.ts',
  // Enhanced coverage settings for quality assurance
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85
    },
    // Specific thresholds for critical modules
    './src/services/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/database/': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',
  maxWorkers: 1, // Sequential execution for database tests
  forceExit: true, // Ensure clean exit
  detectOpenHandles: true, // Debug memory leaks
  // Test environment variables for timeout configuration
  globals: {
    UNIT_TEST_TIMEOUT: 30000,        // 30 seconds for unit tests
    INTEGRATION_TEST_TIMEOUT: 180000, // 3 minutes for integration tests
    E2E_TEST_TIMEOUT: 300000,        // 5 minutes for end-to-end tests
    LLM_OPERATION_TIMEOUT: 120000    // 2 minutes for LLM operations
  },
  transformIgnorePatterns: [
    'node_modules/(?!(chai|better-sqlite3)/)'
  ]
};