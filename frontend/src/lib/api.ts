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

  // Analytics
  getDashboardMetrics: () => apiRequest('/analytics/dashboard'),
  
  getRealtimeMetrics: () => apiRequest('/analytics/realtime'),
  
  getHistoricalMetrics: () => apiRequest('/analytics/historical'),
  
  getTrends: (period?: 'hour' | 'day' | 'week' | 'month', limit?: number) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    return apiRequest(`/analytics/trends${query ? `?${query}` : ''}`);
  },
  
  getInsights: () => apiRequest('/analytics/insights'),
  
  recordTestExecution: (data: any) =>
    apiRequest('/analytics/events/test-execution', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  recordBatchExecution: (data: any) =>
    apiRequest('/analytics/events/batch-execution', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  recordModelUsage: (model: string, usage: any) =>
    apiRequest('/analytics/events/model-usage', {
      method: 'POST',
      body: JSON.stringify({ model, usage }),
    }),
  
  recordSystemMetrics: (metrics: any) =>
    apiRequest('/analytics/events/system-metrics', {
      method: 'POST',
      body: JSON.stringify({ metrics }),
    }),

  // Monitoring and Advanced Analytics
  getSystemHealth: () => apiRequest('/monitoring/system-health'),
  
  getAlerts: (params?: { 
    status?: string; 
    severity?: string; 
    category?: string; 
    limit?: number; 
    offset?: number; 
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    
    const query = searchParams.toString();
    return apiRequest(`/monitoring/alerts${query ? `?${query}` : ''}`);
  },

  updateAlertStatus: (alertId: string, status: string) =>
    apiRequest(`/monitoring/alerts/${alertId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  acknowledgeAlert: (alertId: string, acknowledgedBy?: string) =>
    apiRequest(`/monitoring/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledgedBy }),
    }),

  resolveAlert: (alertId: string) =>
    apiRequest(`/monitoring/alerts/${alertId}/resolve`, {
      method: 'POST',
    }),

  getDistributedTraces: (params?: {
    timeRange?: string;
    service?: string;
    operation?: string;
    minDuration?: number;
    maxDuration?: number;
    status?: string;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
    if (params?.service) searchParams.set('service', params.service);
    if (params?.operation) searchParams.set('operation', params.operation);
    if (params?.minDuration) searchParams.set('minDuration', params.minDuration.toString());
    if (params?.maxDuration) searchParams.set('maxDuration', params.maxDuration.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    
    const query = searchParams.toString();
    return apiRequest(`/monitoring/traces${query ? `?${query}` : ''}`);
  },

  getTrace: (traceId: string) => apiRequest(`/monitoring/traces/${traceId}`),

  getPerformanceData: (params?: {
    timeRange?: string;
    endpoint?: string;
    method?: string;
    groupBy?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
    if (params?.endpoint) searchParams.set('endpoint', params.endpoint);
    if (params?.method) searchParams.set('method', params.method);
    if (params?.groupBy) searchParams.set('groupBy', params.groupBy);
    
    const query = searchParams.toString();
    return apiRequest(`/monitoring/performance${query ? `?${query}` : ''}`);
  },

  getCustomMetrics: () => apiRequest('/monitoring/custom-metrics'),

  createCustomMetric: (data: any) =>
    apiRequest('/monitoring/custom-metrics', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomMetric: (metricId: string, data: any) =>
    apiRequest(`/monitoring/custom-metrics/${metricId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCustomMetric: (metricId: string) =>
    apiRequest(`/monitoring/custom-metrics/${metricId}`, {
      method: 'DELETE',
    }),

  refreshCustomMetric: (metricId: string) =>
    apiRequest(`/monitoring/custom-metrics/${metricId}/refresh`, {
      method: 'POST',
    }),

  // KPI Management
  getKpis: () => apiRequest('/monitoring/kpis'),

  createKpi: (data: any) =>
    apiRequest('/monitoring/kpis', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateKpi: (kpiId: string, data: any) =>
    apiRequest(`/monitoring/kpis/${kpiId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteKpi: (kpiId: string) =>
    apiRequest(`/monitoring/kpis/${kpiId}`, {
      method: 'DELETE',
    }),

  // Dashboard Configuration
  getDashboardConfig: () => apiRequest('/monitoring/dashboard/config'),

  saveDashboardConfig: (config: any) =>
    apiRequest('/monitoring/dashboard/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  exportDashboardConfig: () => 
    fetch(`${API_BASE_URL}/monitoring/dashboard/export`),

  importDashboardConfig: (config: any) =>
    apiRequest('/monitoring/dashboard/import', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
};