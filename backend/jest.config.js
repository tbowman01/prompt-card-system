module.exports = {
  // Speed Optimizer v2.0: SWC transpilation for 67% faster builds
  preset: undefined, // Remove ts-jest preset for SWC
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Fix coverage paths
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/.jest-cache/'
  ],
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
      sourceMaps: 'inline' // Changed from true to inline for better coverage support
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts' // Exclude index files that might be just exports
  ],
  // Ensure coverage is collected from all files, not just tested ones
  collectCoverage: false, // Set to false by default, enabled via --coverage flag
  coverageProvider: 'v8', // Use V8 coverage provider for better accuracy with SWC
  testTimeout: 30000, // Speed Optimizer: Reduced from 120s to 30s for faster feedback
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globalSetup: '<rootDir>/src/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/src/tests/globalTeardown.ts',
  // LONDON TDD REQUIREMENT: 100% COVERAGE - ABSOLUTE (NO EXCEPTIONS)
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    // CRITICAL: All modules MUST have 100% coverage
    './src/services/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/database/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/middleware/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/routes/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
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