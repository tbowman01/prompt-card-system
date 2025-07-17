import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('API Request:', {
        method: config.method,
        url: config.url,
        data: config.data,
      })
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('API Response:', {
        status: response.status,
        data: response.data,
      })
    }
    return response
  },
  (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      })
    }
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      throw new Error('Resource not found')
    } else if (error.response?.status === 500) {
      throw new Error('Server error occurred')
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout')
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to server')
    }
    
    throw error
  }
)

// API service functions
export const promptCardService = {
  getAll: () => apiClient.get('/prompt-cards'),
  getById: (id: string) => apiClient.get(`/prompt-cards/${id}`),
  create: (data: any) => apiClient.post('/prompt-cards', data),
  update: (id: string, data: any) => apiClient.put(`/prompt-cards/${id}`, data),
  delete: (id: string) => apiClient.delete(`/prompt-cards/${id}`),
}

export const testCaseService = {
  getByPromptCardId: (promptCardId: string) => apiClient.get(`/test-cases/prompt-card/${promptCardId}`),
  getById: (id: string) => apiClient.get(`/test-cases/${id}`),
  create: (data: any) => apiClient.post('/test-cases', data),
  update: (id: string, data: any) => apiClient.put(`/test-cases/${id}`, data),
  delete: (id: string) => apiClient.delete(`/test-cases/${id}`),
}

export const yamlService = {
  import: (yamlContent: string) => apiClient.post('/yaml/import', { yamlContent }),
  exportCard: (id: string) => apiClient.get(`/yaml/export/${id}`),
  exportAll: () => apiClient.get('/yaml/export'),
}

export const healthService = {
  check: () => apiClient.get('/health'),
  checkDatabase: () => apiClient.get('/health/db'),
}