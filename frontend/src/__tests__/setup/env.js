// Environment setup for tests

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Disable console warnings for tests unless explicitly enabled
if (!process.env.ENABLE_TEST_WARNINGS) {
  const originalWarn = console.warn
  console.warn = (...args) => {
    // Allow specific warnings that are useful for testing
    const message = args.join(' ')
    if (
      message.includes('validateDOMNesting') ||
      message.includes('React.createFactory') ||
      message.includes('componentWillReceiveProps') ||
      message.includes('findDOMNode')
    ) {
      return // Suppress these warnings
    }
    originalWarn(...args)
  }
}

// Suppress React act warnings in tests unless explicitly enabled
if (!process.env.ENABLE_ACT_WARNINGS) {
  const originalError = console.error
  console.error = (...args) => {
    const message = args.join(' ')
    if (message.includes('Warning: An invalid form control')) {
      return // Suppress form validation warnings
    }
    if (message.includes('Warning: React does not recognize')) {
      return // Suppress unknown prop warnings
    }
    if (message.includes('Warning: Failed prop type')) {
      return // Suppress prop type warnings (handled by TypeScript)
    }
    originalError(...args)
  }
}

// Mock window.matchMedia if not available
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock IntersectionObserver
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() { return null }
    disconnect() { return null }
    unobserve() { return null }
  }
}

// Mock ResizeObserver
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() { return null }
    disconnect() { return null }
    unobserve() { return null }
  }
}

// Mock URL.createObjectURL
if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
  window.URL.createObjectURL = jest.fn(() => 'mocked-url')
  window.URL.revokeObjectURL = jest.fn()
}

// Mock fetch if not available (for Node environment)
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn()
}

// Performance API mock for older environments
if (typeof global.performance === 'undefined') {
  const { performance } = require('perf_hooks')
  global.performance = performance
}

// Setup realistic viewport dimensions
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024,
  })
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 768,
  })
}

// Mock scrollTo methods
if (typeof window !== 'undefined') {
  window.scrollTo = jest.fn()
  Element.prototype.scrollTo = jest.fn()
  Element.prototype.scrollIntoView = jest.fn()
}

// Mock localStorage and sessionStorage
if (typeof window !== 'undefined') {
  const localStorageMock = {
    getItem: jest.fn(key => null),
    setItem: jest.fn((key, value) => {}),
    removeItem: jest.fn(key => {}),
    clear: jest.fn(),
    key: jest.fn(index => null),
    length: 0,
  }
  
  const sessionStorageMock = { ...localStorageMock }
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })
  
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
  })
}

// Mock WebSocket for testing
if (typeof window !== 'undefined') {
  global.WebSocket = jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    send: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  }))
}

// Setup test timing functions
if (typeof window !== 'undefined') {
  window.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16))
  window.cancelAnimationFrame = jest.fn(id => clearTimeout(id))
  window.requestIdleCallback = jest.fn(cb => setTimeout(cb, 1))
  window.cancelIdleCallback = jest.fn(id => clearTimeout(id))
}

// Mock Clipboard API
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: jest.fn(() => Promise.resolve()),
      readText: jest.fn(() => Promise.resolve('')),
    },
    writable: true,
  })
}

// Mock File and FileReader
if (typeof window !== 'undefined') {
  global.File = jest.fn().mockImplementation((parts, filename, options) => ({
    parts,
    filename,
    options,
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
    name: filename,
  }))
  
  global.FileReader = jest.fn().mockImplementation(() => ({
    readAsText: jest.fn(),
    readAsDataURL: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    result: null,
    error: null,
    readyState: 0,
    EMPTY: 0,
    LOADING: 1,
    DONE: 2,
  }))
}

// Setup test-specific console methods
global.testConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

// Export environment info for debugging
global.testEnvironmentInfo = {
  nodeVersion: process.version,
  platform: process.platform,
  ci: !!process.env.CI,
  testFramework: 'Jest',
  testEnvironment: 'jsdom',
}