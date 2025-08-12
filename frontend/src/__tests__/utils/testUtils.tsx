import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Test data factories
export const createMockPromptCard = (overrides = {}) => ({
  id: 1,
  title: 'Test Prompt Card',
  description: 'A test prompt card for testing',
  prompt_template: 'Hello {{name}}, welcome to {{platform}}!',
  variables: ['name', 'platform'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  test_case_count: 2,
  ...overrides,
})

export const createMockTestCase = (overrides = {}) => ({
  id: 1,
  prompt_card_id: 1,
  name: 'Test Case 1',
  input_variables: {
    name: 'John',
    platform: 'TestApp',
  },
  expected_output: 'Hello John, welcome to TestApp!',
  assertions: [
    {
      type: 'contains' as const,
      value: 'Hello',
      description: 'Should greet user',
    },
    {
      type: 'contains' as const,
      value: 'TestApp',
      description: 'Should mention platform',
    },
  ],
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockTestExecution = (overrides = {}) => ({
  id: 'exec-123',
  prompt_card_id: 1,
  status: 'completed' as const,
  test_results: [],
  total_tests: 2,
  passed_tests: 1,
  failed_tests: 1,
  execution_time_ms: 2500,
  model_used: 'gpt-4',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockDashboardMetrics = (overrides = {}) => ({
  realtime: {
    activeTests: 5,
    testsPerSecond: 2.5,
    successRate: 0.85,
    averageResponseTime: 1200,
    errorRate: 0.15,
  },
  historical: {
    totalTests: 1000,
    totalExecutions: 150,
    overallSuccessRate: 0.88,
    averageExecutionTime: 1100,
    mostUsedModels: [
      { model: 'gpt-4', count: 400 },
      { model: 'claude-3', count: 300 },
      { model: 'gpt-3.5-turbo', count: 200 },
    ],
  },
  trends: {
    testsOverTime: [
      { timestamp: new Date('2024-01-01'), count: 10 },
      { timestamp: new Date('2024-01-02'), count: 15 },
    ],
    successRateOverTime: [
      { timestamp: new Date('2024-01-01'), rate: 0.8 },
      { timestamp: new Date('2024-01-02'), rate: 0.85 },
    ],
    performanceOverTime: [
      { timestamp: new Date('2024-01-01'), avgTime: 1300 },
      { timestamp: new Date('2024-01-02'), avgTime: 1200 },
    ],
  },
  insights: [
    {
      id: '1',
      type: 'trend' as const,
      title: 'Performance Improvement',
      description: 'Response times have improved by 15% this week',
      severity: 'low' as const,
      data: {},
      timestamp: new Date('2024-01-01T10:00:00Z'),
      recommendations: ['Continue optimizations'],
    },
  ],
  ...overrides,
})

export const createMockTestResult = (overrides = {}) => ({
  id: 1,
  test_case_id: 1,
  test_case_name: 'Test Case 1',
  status: 'passed' as const,
  actual_output: 'Hello John, welcome to TestApp!',
  expected_output: 'Hello John, welcome to TestApp!',
  assertion_results: [
    {
      type: 'contains',
      expected: 'Hello',
      actual: 'Hello John, welcome to TestApp!',
      passed: true,
      description: 'Should greet user',
    },
  ],
  execution_time_ms: 850,
  model_used: 'gpt-4',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

// Mock API response helpers
export const mockApiResponse = (data: any, success = true) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : data,
})

export const mockApiResponseWithPagination = (data: any[], page = 1, limit = 10) => ({
  success: true,
  data: {
    prompt_cards: data,
    pagination: {
      page,
      limit,
      total: data.length,
      pages: Math.ceil(data.length / limit),
    },
  },
})

// Custom render function that includes common providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add any custom provider props here if needed
}

export const render = (ui: ReactElement, options?: CustomRenderOptions) => {
  // For now, just use standard render. Can be extended with providers later.
  return rtlRender(ui, options)
}

// Helper functions for common test scenarios
export const fillFormField = (input: HTMLElement, value: string) => {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.focus()
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

export const expectElementToHaveClasses = (element: HTMLElement, classes: string[]) => {
  classes.forEach(className => {
    expect(element).toHaveClass(className)
  })
}

export const expectElementNotToHaveClasses = (element: HTMLElement, classes: string[]) => {
  classes.forEach(className => {
    expect(element).not.toHaveClass(className)
  })
}

// Mock fetch responses for common API calls
export const setupMockFetch = () => {
  global.fetch = jest.fn()
  return fetch as jest.MockedFunction<typeof fetch>
}

export const mockSuccessfulFetch = (data: any) => {
  return Promise.resolve({
    ok: true,
    json: async () => mockApiResponse(data),
  } as Response)
}

export const mockFailedFetch = (error: string, status = 400) => {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => mockApiResponse(error, false),
  } as Response)
}

export const mockNetworkError = () => {
  return Promise.reject(new Error('Network error'))
}

// Test data collections for bulk testing
export const generateMockPromptCards = (count: number) => {
  return Array.from({ length: count }, (_, index) => createMockPromptCard({
    id: index + 1,
    title: `Test Card ${index + 1}`,
    description: `Description for test card ${index + 1}`,
    test_case_count: Math.floor(Math.random() * 5),
  }))
}

export const generateMockTestCases = (promptCardId: number, count: number) => {
  return Array.from({ length: count }, (_, index) => createMockTestCase({
    id: index + 1,
    prompt_card_id: promptCardId,
    name: `Test Case ${index + 1}`,
    input_variables: {
      name: `User${index + 1}`,
      platform: `Platform${index + 1}`,
    },
  }))
}

// Utility for waiting for async state updates
export const waitForCondition = (condition: () => boolean, timeout = 5000) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now()
    const checkCondition = () => {
      if (condition()) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'))
      } else {
        setTimeout(checkCondition, 10)
      }
    }
    checkCondition()
  })
}

// Mock timer utilities
export const mockTimers = () => {
  jest.useFakeTimers()
  return {
    advanceTimers: (ms: number) => jest.advanceTimersByTime(ms),
    runAllTimers: () => jest.runAllTimers(),
    restore: () => jest.useRealTimers(),
  }
}

// Form testing utilities
export const getFormElements = (container: HTMLElement) => ({
  inputs: container.querySelectorAll('input'),
  textareas: container.querySelectorAll('textarea'),
  selects: container.querySelectorAll('select'),
  buttons: container.querySelectorAll('button'),
  form: container.querySelector('form'),
})

export const validateFormAccessibility = (form: HTMLFormElement) => {
  const inputs = form.querySelectorAll('input, textarea, select')
  const labels = form.querySelectorAll('label')
  
  // Check that all inputs have labels
  inputs.forEach(input => {
    const id = input.getAttribute('id')
    const hasLabel = id && form.querySelector(`label[for="${id}"]`)
    const hasAriaLabel = input.getAttribute('aria-label')
    const hasAriaLabelledBy = input.getAttribute('aria-labelledby')
    
    expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBeTruthy()
  })
}

// Performance testing utilities
export const measureRenderTime = (renderFn: () => void) => {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

// Console error/warning suppression for tests
export const suppressConsoleErrors = () => {
  const originalError = console.error
  const originalWarn = console.warn
  
  console.error = jest.fn()
  console.warn = jest.fn()
  
  return {
    restore: () => {
      console.error = originalError
      console.warn = originalWarn
    },
    getErrors: () => (console.error as jest.Mock).mock.calls,
    getWarnings: () => (console.warn as jest.Mock).mock.calls,
  }
}

// Custom matchers for better assertions
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidationError(message: string): R
      toBeAccessible(): R
    }
  }
}

// Export everything for easy importing
export * from '@testing-library/react'
export { screen, waitFor, act, fireEvent } from '@testing-library/react'