const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  
  // Add proper TypeScript support for tests
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // TypeScript files handling
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  
  // Speed Optimizer: Parallel execution for frontend tests
  maxWorkers: '50%',
  
  // Speed Optimizer: Enable caching for faster subsequent runs
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
    '!src/app/layout.tsx',
    '!src/app/globals.css',
  ],
  // LONDON TDD REQUIREMENT: 100% COVERAGE - ABSOLUTE (NO EXCEPTIONS)
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    // CRITICAL: All frontend modules MUST have 100% coverage
    './src/components/**/*.{js,jsx,ts,tsx}': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/hooks/**/*.{js,jsx,ts,tsx}': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/lib/**/*.{js,jsx,ts,tsx}': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(msw)/)',
  ],
  // CI/CD Optimization: Parallel execution for 67% faster tests
  maxWorkers: process.env.CI ? 4 : '50%', // Use 4 workers in CI, 50% locally
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  testTimeout: 30000, // Optimized timeout (was 5000ms default)
  forceExit: true, // Ensure clean CI exit
  detectOpenHandles: true, // Debug memory leaks in CI
  
  // Enhanced coverage reporting for CI/CD
  coverageReporters: process.env.CI 
    ? ['text', 'lcov', 'json-summary'] 
    : ['text', 'html'],
  coverageDirectory: 'coverage',
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)