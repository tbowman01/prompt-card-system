export interface PromptCard {
  id: number;
  title: string;
  description?: string;
  prompt_template: string;
  variables: string; // JSON string in database
  created_at: string;
  updated_at: string;
  test_case_count?: number;
  test_cases?: any[];
}

export interface CreatePromptCardRequest {
  title: string;
  description?: string;
  prompt_template: string;
  variables?: string[];
}

export interface PromptCardWithTestCases extends PromptCard {
  test_cases: any[];
}