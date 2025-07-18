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
  type: 'contains' | 'not-contains' | 'equals' | 'not-equals' | 'regex' | 'length' | 
        'semantic-similarity' | 'custom' | 'json-schema' | 'sentiment' | 'language' | 'toxicity';
  value: string | number | object;
  description?: string;
  threshold?: number; // For semantic similarity, sentiment, etc.
  config?: Record<string, any>; // Additional configuration
}