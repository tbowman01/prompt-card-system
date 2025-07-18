export interface PromptCard {
  id: number
  title: string
  description?: string
  prompt_template: string
  variables: string[]
  created_at: string
  updated_at: string
  test_case_count?: number
  test_cases?: TestCase[]
}

export interface TestCase {
  id: number
  prompt_card_id: number
  name: string
  input_variables: Record<string, any>
  expected_output?: string
  assertions: AssertionType[]
  created_at: string
}

export interface AssertionType {
  type: 'contains' | 'not-contains' | 'equals' | 'not-equals' | 'regex' | 'length'
  value: string | number
  description?: string
}

export interface CreatePromptCardRequest {
  title: string
  description?: string
  prompt_template: string
  variables?: string[]
}

export interface CreateTestCaseRequest {
  prompt_card_id: number
  name: string
  input_variables: Record<string, any>
  expected_output?: string
  assertions?: AssertionType[]
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface HealthStatus {
  status: string
  timestamp: string
  services: {
    database: string
    ollama: {
      url: string
      status: string
    }
  }
  environment: string
}

export interface TestResult {
  id: number
  test_case_id: number
  test_case_name: string
  status: 'passed' | 'failed' | 'error'
  actual_output: string
  expected_output?: string
  assertion_results: AssertionResult[]
  execution_time_ms: number
  model_used: string
  created_at: string
  error_message?: string
}

export interface AssertionResult {
  type: string
  expected: string | number
  actual: string | number
  passed: boolean
  description?: string
}

export interface TestExecution {
  id: string
  prompt_card_id: number
  status: 'running' | 'completed' | 'failed'
  test_results: TestResult[]
  total_tests: number
  passed_tests: number
  failed_tests: number
  execution_time_ms: number
  model_used: string
  created_at: string
  error_message?: string
}

export interface RunTestsRequest {
  prompt_card_id: number
  test_case_ids?: number[]
  model?: string
}

export interface RunTestsResponse {
  execution_id: string
  status: 'started' | 'completed'
  execution?: TestExecution
}

// Analytics Types
export interface AnalyticsInsight {
  id: string
  type: 'trend' | 'anomaly' | 'comparison' | 'prediction'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  data: any
  timestamp: Date
  recommendations?: string[]
}

export interface DashboardMetrics {
  realtime: {
    activeTests: number
    testsPerSecond: number
    successRate: number
    averageResponseTime: number
    errorRate: number
  }
  historical: {
    totalTests: number
    totalExecutions: number
    overallSuccessRate: number
    averageExecutionTime: number
    mostUsedModels: Array<{ model: string; count: number }>
  }
  trends: {
    testsOverTime: Array<{ timestamp: Date; count: number }>
    successRateOverTime: Array<{ timestamp: Date; rate: number }>
    performanceOverTime: Array<{ timestamp: Date; avgTime: number }>
  }
  insights: AnalyticsInsight[]
}

export interface MetricValue {
  name: string
  value: number
  timestamp: Date
  labels?: Record<string, string>
}

export interface CostData {
  totalCost: number
  costByModel: Record<string, number>
  costOverTime: Array<{ timestamp: Date; cost: number }>
  tokenUsage: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
  }
}