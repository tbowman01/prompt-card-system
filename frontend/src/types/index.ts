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