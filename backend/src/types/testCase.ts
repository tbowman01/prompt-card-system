export interface TestCase {
  id: number;
  prompt_card_id: number;
  name: string;
  input_variables: string; // JSON string in database
  expected_output?: string;
  assertions: string; // JSON string in database
  created_at: string;
}

export interface CreateTestCaseRequest {
  prompt_card_id: number;
  name: string;
  input_variables: Record<string, any>;
  expected_output?: string;
  assertions?: AssertionType[];
}

export interface AssertionType {
  type: 'contains' | 'not-contains' | 'equals' | 'not-equals' | 'regex' | 'length';
  value: string | number;
  description?: string;
}