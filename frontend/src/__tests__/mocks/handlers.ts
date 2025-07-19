const { http, HttpResponse } = require('msw')

const API_BASE_URL = 'http://localhost:3001/api'

// Mock data
const mockPromptCards: PromptCard[] = [
  {
    id: 1,
    title: 'Customer Service Response',
    description: 'Generate professional customer service responses',
    prompt_template: 'Respond to this customer inquiry: {{inquiry}}\nTone: {{tone}}',
    variables: ['inquiry', 'tone'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    test_case_count: 2,
  },
  {
    id: 2,
    title: 'Code Review',
    description: 'Generate code review comments',
    prompt_template: 'Review this code and provide feedback:\n{{code}}',
    variables: ['code'],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    test_case_count: 1,
  },
]

const mockTestCases: TestCase[] = [
  {
    id: 1,
    prompt_card_id: 1,
    name: 'Friendly response test',
    input_variables: {
      inquiry: 'I received a damaged product',
      tone: 'friendly',
    },
    expected_output: 'Professional and empathetic response',
    assertions: [
      { type: 'contains', value: 'sorry', description: 'Should apologize' },
      { type: 'not-contains', value: 'angry', description: 'Should not be angry' },
    ],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    prompt_card_id: 1,
    name: 'Professional response test',
    input_variables: {
      inquiry: 'What is your return policy?',
      tone: 'professional',
    },
    assertions: [
      { type: 'contains', value: 'return', description: 'Should mention returns' },
    ],
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockDashboardMetrics: DashboardMetrics = {
  realtime: {
    activeTests: 3,
    testsPerSecond: 1.5,
    successRate: 0.85,
    averageResponseTime: 1200,
    errorRate: 0.15,
  },
  historical: {
    totalTests: 850,
    totalExecutions: 120,
    overallSuccessRate: 0.88,
    averageExecutionTime: 1100,
    mostUsedModels: [
      { model: 'gpt-4', count: 400 },
      { model: 'claude-3', count: 250 },
      { model: 'gpt-3.5-turbo', count: 200 },
    ],
  },
  trends: {
    testsOverTime: [],
    successRateOverTime: [],
    performanceOverTime: [],
  },
  insights: [
    {
      id: '1',
      type: 'trend',
      title: 'Performance Improvement',
      description: 'Response times have improved by 20% this week',
      severity: 'low',
      data: {},
      timestamp: new Date(),
      recommendations: ['Continue current optimizations'],
    },
  ],
}

const handlers = [
  // Prompt Cards endpoints
  http.get(`${API_BASE_URL}/prompt-cards`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Number(url.searchParams.get('limit')) || 10
    const search = url.searchParams.get('search')

    let filteredCards = mockPromptCards
    if (search) {
      filteredCards = mockPromptCards.filter(card =>
        card.title.toLowerCase().includes(search.toLowerCase()) ||
        card.description?.toLowerCase().includes(search.toLowerCase())
      )
    }

    const start = (page - 1) * limit
    const end = start + limit
    const paginatedCards = filteredCards.slice(start, end)

    return HttpResponse.json({
      success: true,
      data: {
        prompt_cards: paginatedCards,
        pagination: {
          page,
          limit,
          total: filteredCards.length,
          pages: Math.ceil(filteredCards.length / limit),
        },
      },
    })
  }),

  http.get(`${API_BASE_URL}/prompt-cards/:id`, ({ params }) => {
    const id = Number(params.id)
    const card = mockPromptCards.find(c => c.id === id)

    if (!card) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Prompt card not found',
        },
        { status: 404 }
      )
    }

    const cardWithTestCases = {
      ...card,
      test_cases: mockTestCases.filter(tc => tc.prompt_card_id === id),
    }

    return HttpResponse.json({
      success: true,
      data: cardWithTestCases,
    })
  }),

  http.post(`${API_BASE_URL}/prompt-cards`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(
      {
        success: true,
        data: {
          id: 3,
          ...body,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    )
  }),

  http.put(`${API_BASE_URL}/prompt-cards/:id`, async ({ params, request }) => {
    const id = Number(params.id)
    const card = mockPromptCards.find(c => c.id === id)

    if (!card) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Prompt card not found',
        },
        { status: 404 }
      )
    }

    const body = await request.json()
    return HttpResponse.json({
      success: true,
      data: {
        ...card,
        ...body,
        updated_at: new Date().toISOString(),
      },
    })
  }),

  http.delete(`${API_BASE_URL}/prompt-cards/:id`, ({ params }) => {
    const id = Number(params.id)
    const cardExists = mockPromptCards.some(c => c.id === id)

    if (!cardExists) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Prompt card not found',
        },
        { status: 404 }
      )
    }

    return HttpResponse.json({
      success: true,
      message: 'Prompt card deleted successfully',
    })
  }),

  // Test Cases endpoints
  http.get(`${API_BASE_URL}/test-cases/prompt-cards/:id/test-cases`, ({ params }) => {
    const promptCardId = Number(params.id)
    const testCases = mockTestCases.filter(tc => tc.prompt_card_id === promptCardId)

    return HttpResponse.json({
      success: true,
      data: testCases,
    })
  }),

  http.post(`${API_BASE_URL}/test-cases`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(
      {
        success: true,
        data: {
          id: 3,
          ...body,
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    )
  }),

  // Test Execution endpoints
  http.post(`${API_BASE_URL}/test-execution/run`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        execution_id: 'exec-' + Date.now(),
        status: 'started',
      },
    })
  }),

  http.get(`${API_BASE_URL}/test-execution/:id`, ({ params }) => {
    const execution: TestExecution = {
      id: params.id as string,
      prompt_card_id: 1,
      status: 'completed',
      test_results: [],
      total_tests: 2,
      passed_tests: 1,
      failed_tests: 1,
      execution_time_ms: 2500,
      model_used: 'gpt-4',
      created_at: new Date().toISOString(),
    }

    return HttpResponse.json({
      success: true,
      data: execution,
    })
  }),

  // Analytics endpoints
  http.get(`${API_BASE_URL}/analytics/dashboard`, () => {
    return HttpResponse.json({
      success: true,
      data: mockDashboardMetrics,
    })
  }),

  // Health endpoint
  http.get(`${API_BASE_URL}/health`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          ollama: {
            url: 'http://localhost:11434',
            status: 'connected',
          },
        },
        environment: 'test',
      },
    })
  }),

  // Error simulation endpoints
  http.get(`${API_BASE_URL}/error`, () => {
    return HttpResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }),

  http.get(`${API_BASE_URL}/network-error`, () => {
    return HttpResponse.error()
  }),
]

module.exports = { handlers }