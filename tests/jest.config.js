/**
 * Enterprise Jest Configuration - London TDD Compliant
 * Enforces 100% test coverage across all services
 */

module.exports = {
  // Root configuration for monorepo
  projects: [
    '<rootDir>/backend/jest.config.js',
    '<rootDir>/frontend/jest.config.js',
    '<rootDir>/auth/jest.config.js',
  ],

  // Global coverage configuration
  collectCoverageFrom: [
    '**/{src,lib}/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/jest.config.js',
    '!**/webpack.config.js',
    '!**/rollup.config.js',
    '!**/vite.config.js',
    '!**/*.stories.{js,jsx,ts,tsx}',
    '!**/*.test.{js,jsx,ts,tsx}',
    '!**/*.spec.{js,jsx,ts,tsx}',
  ],

  // STRICT LONDON TDD COVERAGE REQUIREMENTS - NO EXCEPTIONS
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    // Per-service requirements
    './backend/src/**/*.{js,ts}': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './frontend/src/**/*.{js,jsx,ts,tsx}': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './auth/src/**/*.{js,ts}': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

  // Coverage reporting
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
    'cobertura',
    'clover',
  ],

  // Global settings
  verbose: true,
  testTimeout: 30000,
  maxWorkers: '50%',
  
  // Fail fast on coverage
  bail: false, // Continue all tests but fail build on coverage
  passWithNoTests: false, // Require tests to exist
  errorOnDeprecated: true,

  // Global test patterns
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)',
  ],

  // Global ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.next/',
    '/coverage/',
  ],

  // Global watch settings
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.next/',
    '/coverage/',
  ],

  // Reporters for CI/CD
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicDir: './coverage',
        filename: 'test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Enterprise Test Report',
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/jest.global-setup.js',
  globalTeardown: '<rootDir>/tests/jest.global-teardown.js',
};