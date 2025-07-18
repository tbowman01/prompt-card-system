// API configuration and utilities
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.error || 'Request failed');
    }

    if (!data.success) {
      throw new Error(data.error || 'API request failed');
    }

    return data.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error('Network error: ' + (error as Error).message);
  }
}

// Specific API functions
export const api = {
  // Prompt Cards
  getPromptCards: (params?: { page?: number; limit?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    
    const query = searchParams.toString();
    return apiRequest(`/prompt-cards${query ? `?${query}` : ''}`);
  },

  getPromptCard: (id: number) => apiRequest(`/prompt-cards/${id}`),

  createPromptCard: (data: any) => 
    apiRequest('/prompt-cards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePromptCard: (id: number, data: any) =>
    apiRequest(`/prompt-cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePromptCard: (id: number) =>
    apiRequest(`/prompt-cards/${id}`, {
      method: 'DELETE',
    }),

  // Test Cases
  getTestCases: (promptCardId: number) =>
    apiRequest(`/test-cases/prompt-cards/${promptCardId}/test-cases`),

  createTestCase: (data: any) =>
    apiRequest('/test-cases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTestCase: (id: number, data: any) =>
    apiRequest(`/test-cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTestCase: (id: number) =>
    apiRequest(`/test-cases/${id}`, {
      method: 'DELETE',
    }),

  // YAML Operations
  importYAML: (yamlContent: string) =>
    apiRequest('/yaml/import', {
      method: 'POST',
      body: JSON.stringify({ yamlContent }),
    }),

  validateYAML: (yamlContent: string) =>
    apiRequest('/yaml/validate', {
      method: 'POST',
      body: JSON.stringify({ yamlContent }),
    }),

  exportYAML: (id?: number) => {
    const endpoint = id ? `/yaml/export/${id}` : '/yaml/export';
    return fetch(`${API_BASE_URL}${endpoint}`);
  },

  // Health Check
  getHealth: () => apiRequest('/health'),

  // Test Execution
  runTests: (data: any) =>
    apiRequest('/test-execution/run', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTestExecution: (executionId: string) =>
    apiRequest(`/test-execution/${executionId}`),

  getTestExecutionResults: (executionId: string) =>
    apiRequest(`/test-execution/${executionId}/results`),

  runSingleTest: (testCaseId: number, data?: any) =>
    apiRequest(`/test-execution/test-case/${testCaseId}/run`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
};