const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// CI-optimized Jest configuration
const ciJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  
  // CI-specific optimizations
  maxWorkers: process.env.CI ? 2 : '50%', // Limit workers in CI to avoid memory issues
  cache: false, // Disable cache in CI for clean runs
  
  // Comprehensive test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/e2e/**/*.spec.{js,ts}', // Include E2E tests in CI
  ],
  
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/src/__tests__/visual/', // Visual tests run separately
  ],
  
  // Enhanced coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
    '!src/app/layout.tsx',
    '!src/app/globals.css',
    '!src/__tests__/**/*', // Exclude test files from coverage
    '!src/**/__mocks__/**/*', // Exclude mocks from coverage
  ],
  
  // Strict coverage thresholds for CI
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Per-directory thresholds
    'src/components/ui/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'src/lib/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/hooks/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  
  // Comprehensive coverage reporters
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura', // For CI integration
  ],
  coverageDirectory: 'coverage',
  
  // Test execution configuration
  testTimeout: 30000, // 30 seconds for complex integration tests
  forceExit: true, // Ensure clean CI exit
  detectOpenHandles: true, // Debug memory leaks
  verbose: true, // Detailed output for CI logs
  
  // Retry configuration for flaky tests
  retry: process.env.CI ? 2 : 0,
  
  // Performance optimizations
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { 
      presets: ['next/babel'],
      cacheDirectory: false, // Disable transform cache in CI
    }],
  },
  
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@testing-library)/)',
  ],
  
  // Error handling
  bail: process.env.CI ? 1 : 0, // Stop on first failure in CI
  
  // Test categorization
  projects: [
    // Unit tests
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
        '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/src/__tests__/integration/',
        '<rootDir>/src/__tests__/visual/',
        '<rootDir>/src/__tests__/performance/',
        '<rootDir>/src/__tests__/utils/accessibility.test.tsx',
        '<rootDir>/src/__tests__/utils/performance.test.tsx',
      ],
    },
    
    // Integration tests
    {
      displayName: 'integration',
      testMatch: [
        '<rootDir>/src/__tests__/integration/**/*.{test,spec}.{js,jsx,ts,tsx}',
      ],
      testTimeout: 45000, // Longer timeout for integration tests
    },
    
    // Accessibility tests
    {
      displayName: 'accessibility',
      testMatch: [
        '<rootDir>/src/__tests__/utils/accessibility.test.tsx',
      ],
      testTimeout: 60000, // Longer timeout for axe tests
    },
    
    // Performance tests
    {
      displayName: 'performance',
      testMatch: [
        '<rootDir>/src/__tests__/utils/performance.test.tsx',
      ],
      testTimeout: 30000,
    },
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/src/__tests__/setup/globalSetup.js',
  globalTeardown: '<rootDir>/src/__tests__/setup/globalTeardown.js',
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Custom environment variables for tests
  setupFiles: ['<rootDir>/src/__tests__/setup/env.js'],
  
  // Watch mode configuration (disabled in CI)
  watchman: false,
  
  // Snapshot configuration
  updateSnapshot: false, // Never auto-update snapshots in CI
  
  // Test result processors
  testResultsProcessor: '<rootDir>/src/__tests__/utils/testResultsProcessor.js',
  
  // Custom reporters for CI
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: 'false',
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }],
    ['jest-html-reporter', {
      pageTitle: 'Test Results',
      outputPath: 'test-results/test-report.html',
      includeFailureMsg: true,
      includeSuiteFailure: true,
    }],
  ],
  
  // Notification configuration (disabled in CI)
  notify: false,
  notifyMode: 'failure-change',
}

module.exports = createJestConfig(ciJestConfig)