import { api, apiRequest, ApiError } from '@/lib/api'

// Mock fetch globally
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('apiRequest', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    // Reset environment variable
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api'
  })

  it('makes successful API request', async () => {
    const mockData = { id: 1, name: 'Test' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    } as Response)

    const result = await apiRequest('/test')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/test',
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    expect(result).toEqual(mockData)
  })

  it('throws ApiError for HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: 'Not Found' }),
    } as Response)

    await expect(apiRequest('/not-found')).rejects.toThrow(ApiError)
    await expect(apiRequest('/not-found')).rejects.toThrow('Not Found')
  })

  it('throws Error for API failures', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Server Error' }),
    } as Response)

    await expect(apiRequest('/error')).rejects.toThrow('Server Error')
  })

  it('throws network error for fetch failures', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network Error'))

    await expect(apiRequest('/network-error')).rejects.toThrow('Network error: Network Error')
  })

  it('includes custom headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    } as Response)

    await apiRequest('/test', {
      headers: {
        'Authorization': 'Bearer token',
      },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/test',
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
      }
    )
  })
})

describe('api.getPromptCards', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('calls correct endpoint without parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response)

    await api.getPromptCards()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/prompt-cards',
      expect.any(Object)
    )
  })

  it('includes query parameters when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response)

    await api.getPromptCards({ page: 2, limit: 10, search: 'test' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/prompt-cards?page=2&limit=10&search=test',
      expect.any(Object)
    )
  })
})

describe('api.createPromptCard', () => {
  it('sends POST request with correct data', async () => {
    const cardData = {
      title: 'Test Card',
      prompt_template: 'Hello {{name}}',
      variables: ['name'],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 1, ...cardData } }),
    } as Response)

    await api.createPromptCard(cardData)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/prompt-cards',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cardData),
      }
    )
  })
})

describe('api.runTests', () => {
  it('sends POST request to correct endpoint', async () => {
    const testData = {
      prompt_card_id: 1,
      test_case_ids: [1, 2, 3],
      model: 'gpt-4',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { execution_id: 'exec-123' } }),
    } as Response)

    await api.runTests(testData)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/test-execution/run',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      }
    )
  })
})

describe('api.getDashboardMetrics', () => {
  it('fetches analytics dashboard data', async () => {
    const mockMetrics = {
      realtime: { activeTests: 5 },
      historical: { totalTests: 100 },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockMetrics }),
    } as Response)

    const result = await api.getDashboardMetrics()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/analytics/dashboard',
      expect.any(Object)
    )
    expect(result).toEqual(mockMetrics)
  })
})

describe('api.exportYAML', () => {
  it('returns raw fetch response for file download', async () => {
    const mockResponse = new Response('yaml content', {
      headers: { 'Content-Type': 'application/yaml' },
    })

    mockFetch.mockResolvedValueOnce(mockResponse)

    const result = await api.exportYAML(1)

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/yaml/export/1')
    expect(result).toBe(mockResponse)
  })

  it('exports all cards when no ID provided', async () => {
    const mockResponse = new Response('yaml content')
    mockFetch.mockResolvedValueOnce(mockResponse)

    await api.exportYAML()

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/yaml/export')
  })
})

describe('ApiError', () => {
  it('creates error with status and message', () => {
    const error = new ApiError(404, 'Not Found')

    expect(error.status).toBe(404)
    expect(error.message).toBe('Not Found')
    expect(error.name).toBe('ApiError')
    expect(error).toBeInstanceOf(Error)
  })
})