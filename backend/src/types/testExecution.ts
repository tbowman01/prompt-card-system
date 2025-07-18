export interface TestResult {
  id: number;
  test_case_id: number;
  execution_id: string;
  llm_output: string;
  passed: boolean;
  assertion_results: string; // JSON string in database
  execution_time_ms: number;
  created_at: string;
}

export interface TestExecutionResult {
  execution_id: string;
  test_case_id: number;
  passed: boolean;
  llm_output: string;
  assertion_results: AssertionResult[];
  execution_time_ms: number;
  model: string;
  prompt_used: string;
}

export interface BatchExecutionResult {
  execution_id: string;
  prompt_card_id: number;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  results: TestExecutionResult[];
  overall_passed: boolean;
  execution_time_ms: number;
}

export interface AssertionResult {
  assertion: {
    type: 'contains' | 'not-contains' | 'equals' | 'not-equals' | 'regex' | 'length';
    value: string | number;
    description?: string;
  };
  passed: boolean;
  error?: string;
}

export interface ExecuteTestRequest {
  model?: string;
}

export interface ExecuteAllTestsRequest {
  model?: string;
  stopOnFirstFailure?: boolean;
}