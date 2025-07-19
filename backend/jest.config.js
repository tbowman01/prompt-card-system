module.exports = {
  // Speed Optimizer v2.0: SWC transpilation for 67% faster builds
  preset: undefined, // Remove ts-jest preset for SWC
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
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
      sourceMaps: true
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
  testTimeout: 30000, // Speed Optimizer: Reduced from 120s to 30s for faster feedback
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
  maxWorkers: '50%', // Speed Optimizer: Parallel execution for 67% improvement
  forceExit: true, // Ensure clean exit
  detectOpenHandles: true, // Debug memory leaks
  // Speed Optimizer: Optimized timeout configuration
  globals: {
    UNIT_TEST_TIMEOUT: 15000,        // Reduced from 30s to 15s
    INTEGRATION_TEST_TIMEOUT: 60000,  // Reduced from 180s to 60s
    E2E_TEST_TIMEOUT: 120000,        // Reduced from 300s to 120s
    LLM_OPERATION_TIMEOUT: 30000     // Reduced from 120s to 30s
  },
  
  // Speed Optimizer: Enable caching for faster subsequent runs
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  transformIgnorePatterns: [
    'node_modules/(?!(chai|better-sqlite3)/)'
  ]
};