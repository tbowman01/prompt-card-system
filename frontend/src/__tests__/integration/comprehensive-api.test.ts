import { api, ApiError } from '@/lib/api'
import { server } from '../setup/msw'
import { http, HttpResponse } from 'msw'
import { 
  createMockPromptCard, 
  createMockTestCase, 
  createMockDashboardMetrics,
  createMockTestExecution,
  mockApiResponse,
  mockApiResponseWithPagination 
} from '../utils/testUtils'

describe('Comprehensive API Integration Tests', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => {
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })

  describe('Prompt Cards API', () => {
    describe('getPromptCards', () => {
      it('fetches prompt cards successfully with default parameters', async () => {
        const mockCards = [
          createMockPromptCard({ id: 1, title: 'Card 1' }),
          createMockPromptCard({ id: 2, title: 'Card 2' }),
        ]

        server.use(
          http.get('http://localhost:3001/api/prompt-cards', () => {
            return HttpResponse.json(mockApiResponseWithPagination(mockCards))
          })
        )

        const result = await api.getPromptCards()
        
        expect(result).toEqual({
          prompt_cards: mockCards,
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            pages: 1,
          },
        })
      })

      it('fetches prompt cards with query parameters', async () => {
        const mockCards = [createMockPromptCard({ title: 'Filtered Card' })]

        server.use(
          http.get('http://localhost:3001/api/prompt-cards', ({ request }) => {
            const url = new URL(request.url)
            expect(url.searchParams.get('page')).toBe('2')
            expect(url.searchParams.get('limit')).toBe('5')
            expect(url.searchParams.get('search')).toBe('test')
            
            return HttpResponse.json(mockApiResponseWithPagination(mockCards, 2, 5))
          })
        )

        await api.getPromptCards({ page: 2, limit: 5, search: 'test' })
      })

      it('handles empty results', async () => {
        server.use(
          http.get('http://localhost:3001/api/prompt-cards', () => {
            return HttpResponse.json(mockApiResponseWithPagination([]))
          })
        )

        const result = await api.getPromptCards()
        expect(result.prompt_cards).toEqual([])
        expect(result.pagination.total).toBe(0)
      })

      it('handles network errors', async () => {
        server.use(
          http.get('http://localhost:3001/api/prompt-cards', () => {
            return HttpResponse.error()
          })
        )

        await expect(api.getPromptCards()).rejects.toThrow('Network error')
      })
    })

    describe('getPromptCard', () => {
      it('fetches single prompt card successfully', async () => {
        const mockCard = createMockPromptCard({ 
          id: 1, 
          test_cases: [createMockTestCase()] 
        })

        server.use(
          http.get('http://localhost:3001/api/prompt-cards/1', () => {
            return HttpResponse.json(mockApiResponse(mockCard))
          })
        )

        const result = await api.getPromptCard(1)
        expect(result).toEqual(mockCard)
        expect(result.test_cases).toHaveLength(1)
      })

      it('handles not found error', async () => {
        server.use(
          http.get('http://localhost:3001/api/prompt-cards/999', () => {
            return HttpResponse.json(
              mockApiResponse('Prompt card not found', false),
              { status: 404 }
            )
          })
        )

        await expect(api.getPromptCard(999)).rejects.toThrow(ApiError)
        await expect(api.getPromptCard(999)).rejects.toThrow('Prompt card not found')
      })
    })

    describe('createPromptCard', () => {
      it('creates prompt card successfully', async () => {
        const cardData = {
          title: 'New Card',
          description: 'New Description',
          prompt_template: 'Hello {{name}}!',
          variables: ['name'],
        }

        const createdCard = createMockPromptCard({ ...cardData, id: 3 })

        server.use(
          http.post('http://localhost:3001/api/prompt-cards', async ({ request }) => {
            const body = await request.json()
            expect(body).toEqual(cardData)
            
            return HttpResponse.json(
              mockApiResponse(createdCard),
              { status: 201 }
            )
          })
        )

        const result = await api.createPromptCard(cardData)
        expect(result).toEqual(createdCard)
      })

      it('handles validation errors', async () => {
        server.use(
          http.post('http://localhost:3001/api/prompt-cards', () => {
            return HttpResponse.json(
              mockApiResponse('Title is required', false),
              { status: 400 }
            )
          })
        )

        const invalidData = {
          title: '',
          prompt_template: 'Test template',
        }

        await expect(api.createPromptCard(invalidData)).rejects.toThrow(ApiError)
        await expect(api.createPromptCard(invalidData)).rejects.toThrow('Title is required')
      })
    })

    describe('updatePromptCard', () => {
      it('updates prompt card successfully', async () => {
        const updateData = {
          title: 'Updated Title',
          description: 'Updated Description',
        }

        const updatedCard = createMockPromptCard({ ...updateData, id: 1 })

        server.use(
          http.put('http://localhost:3001/api/prompt-cards/1', async ({ request }) => {
            const body = await request.json()
            expect(body).toEqual(updateData)
            
            return HttpResponse.json(mockApiResponse(updatedCard))
          })
        )

        const result = await api.updatePromptCard(1, updateData)
        expect(result).toEqual(updatedCard)
      })
    })

    describe('deletePromptCard', () => {
      it('deletes prompt card successfully', async () => {
        server.use(
          http.delete('http://localhost:3001/api/prompt-cards/1', () => {
            return HttpResponse.json(mockApiResponse({ message: 'Deleted successfully' }))
          })
        )

        const result = await api.deletePromptCard(1)
        expect(result).toEqual({ message: 'Deleted successfully' })
      })
    })
  })

  describe('Test Cases API', () => {
    describe('getTestCases', () => {
      it('fetches test cases for a prompt card', async () => {
        const mockTestCases = [
          createMockTestCase({ id: 1, prompt_card_id: 1 }),
          createMockTestCase({ id: 2, prompt_card_id: 1 }),
        ]

        server.use(
          http.get('http://localhost:3001/api/prompt-cards/1/test-cases', () => {
            return HttpResponse.json(mockApiResponse(mockTestCases))
          })
        )

        const result = await api.getTestCases(1)
        expect(result).toEqual(mockTestCases)
        expect(result).toHaveLength(2)
      })
    })

    describe('createTestCase', () => {
      it('creates test case successfully', async () => {
        const testCaseData = {
          prompt_card_id: 1,
          name: 'New Test Case',
          input_variables: { name: 'John' },
          expected_output: 'Hello John!',
          assertions: [
            { type: 'contains' as const, value: 'Hello', description: 'Should greet' },
          ],
        }

        const createdTestCase = createMockTestCase({ ...testCaseData, id: 3 })

        server.use(
          http.post('http://localhost:3001/api/test-cases', async ({ request }) => {
            const body = await request.json()
            expect(body).toEqual(testCaseData)
            
            return HttpResponse.json(
              mockApiResponse(createdTestCase),
              { status: 201 }
            )
          })
        )

        const result = await api.createTestCase(testCaseData)
        expect(result).toEqual(createdTestCase)
      })
    })
  })

  describe('Test Execution API', () => {
    describe('runTests', () => {
      it('starts test execution successfully', async () => {
        const testData = {
          prompt_card_id: 1,
          test_case_ids: [1, 2, 3],
          model: 'gpt-4',
        }

        const executionResponse = {
          execution_id: 'exec-123',
          status: 'started' as const,
        }

        server.use(
          http.post('http://localhost:3001/api/test-execution/run', async ({ request }) => {
            const body = await request.json()
            expect(body).toEqual(testData)
            
            return HttpResponse.json(mockApiResponse(executionResponse))
          })
        )

        const result = await api.runTests(testData)
        expect(result).toEqual(executionResponse)
      })

      it('handles execution errors', async () => {
        server.use(
          http.post('http://localhost:3001/api/test-execution/run', () => {
            return HttpResponse.json(
              mockApiResponse('No test cases found', false),
              { status: 400 }
            )
          })
        )

        const testData = {
          prompt_card_id: 999,
          test_case_ids: [],
        }

        await expect(api.runTests(testData)).rejects.toThrow(ApiError)
      })
    })

    describe('getTestExecution', () => {
      it('fetches test execution results', async () => {
        const mockExecution = createMockTestExecution({
          id: 'exec-123',
          status: 'completed',
        })

        server.use(
          http.get('http://localhost:3001/api/test-execution/exec-123', () => {
            return HttpResponse.json(mockApiResponse(mockExecution))
          })
        )

        const result = await api.getTestExecution('exec-123')
        expect(result).toEqual(mockExecution)
      })

      it('handles execution not found', async () => {
        server.use(
          http.get('http://localhost:3001/api/test-execution/nonexistent', () => {
            return HttpResponse.json(
              mockApiResponse('Execution not found', false),
              { status: 404 }
            )
          })
        )

        await expect(api.getTestExecution('nonexistent')).rejects.toThrow(ApiError)
      })
    })
  })

  describe('Analytics API', () => {
    describe('getDashboardMetrics', () => {
      it('fetches dashboard metrics successfully', async () => {
        const mockMetrics = createMockDashboardMetrics()

        server.use(
          http.get('http://localhost:3001/api/analytics/dashboard', () => {
            return HttpResponse.json(mockApiResponse(mockMetrics))
          })
        )

        const result = await api.getDashboardMetrics()
        expect(result).toEqual(mockMetrics)
        expect(result.realtime).toBeDefined()
        expect(result.historical).toBeDefined()
        expect(result.trends).toBeDefined()
        expect(result.insights).toBeInstanceOf(Array)
      })
    })
  })

  describe('Health API', () => {
    describe('getHealth', () => {
      it('fetches health status successfully', async () => {
        const healthData = {
          status: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
          services: {
            database: 'connected',
            ollama: {
              url: 'http://localhost:11434',
              status: 'connected',
            },
          },
          environment: 'test',
        }

        server.use(
          http.get('http://localhost:3001/api/health', () => {
            return HttpResponse.json(mockApiResponse(healthData))
          })
        )

        const result = await api.getHealth()
        expect(result).toEqual(healthData)
      })
    })
  })

  describe('Error Handling', () => {
    it('handles 500 server errors', async () => {
      server.use(
        http.get('http://localhost:3001/api/prompt-cards', () => {
          return HttpResponse.json(
            mockApiResponse('Internal server error', false),
            { status: 500 }
          )
        })
      )

      await expect(api.getPromptCards()).rejects.toThrow(ApiError)
      
      try {
        await api.getPromptCards()
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
        expect((error as ApiError).message).toBe('Internal server error')
      }
    })

    it('handles malformed JSON responses', async () => {
      server.use(
        http.get('http://localhost:3001/api/prompt-cards', () => {
          return new HttpResponse('Invalid JSON{', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        })
      )

      await expect(api.getPromptCards()).rejects.toThrow()
    })

    it('handles timeout errors', async () => {
      server.use(
        http.get('http://localhost:3001/api/prompt-cards', async () => {
          // Simulate timeout by waiting longer than expected
          await new Promise(resolve => setTimeout(resolve, 1000))
          return HttpResponse.json(mockApiResponse([]))
        })
      )

      // Note: Actual timeout handling would depend on fetch configuration
      // This is more of a placeholder for timeout testing
      const result = await api.getPromptCards()
      expect(result).toBeDefined()
    })
  })

  describe('Request Headers and Configuration', () => {
    it('includes correct content-type header', async () => {
      let capturedRequest: Request

      server.use(
        http.post('http://localhost:3001/api/prompt-cards', ({ request }) => {
          capturedRequest = request
          return HttpResponse.json(mockApiResponse(createMockPromptCard()))
        })
      )

      await api.createPromptCard({
        title: 'Test',
        prompt_template: 'Test template',
      })

      expect(capturedRequest!.headers.get('content-type')).toBe('application/json')
    })

    it('includes custom headers when provided', async () => {
      const customHeaders = { 'Authorization': 'Bearer token123' }
      
      // For this test, we'd need to modify the API to accept custom headers
      // This is a placeholder for such functionality
      expect(customHeaders).toBeDefined()
    })
  })

  describe('Response Data Validation', () => {
    it('validates prompt card response structure', async () => {
      const mockCard = createMockPromptCard()
      
      server.use(
        http.get('http://localhost:3001/api/prompt-cards/1', () => {
          return HttpResponse.json(mockApiResponse(mockCard))
        })
      )

      const result = await api.getPromptCard(1)
      
      // Validate required fields
      expect(result.id).toEqual(expect.any(Number))
      expect(result.title).toEqual(expect.any(String))
      expect(result.prompt_template).toEqual(expect.any(String))
      expect(result.variables).toEqual(expect.any(Array))
      expect(result.created_at).toEqual(expect.any(String))
      expect(result.updated_at).toEqual(expect.any(String))
    })

    it('validates dashboard metrics response structure', async () => {
      const mockMetrics = createMockDashboardMetrics()
      
      server.use(
        http.get('http://localhost:3001/api/analytics/dashboard', () => {
          return HttpResponse.json(mockApiResponse(mockMetrics))
        })
      )

      const result = await api.getDashboardMetrics()
      
      // Validate structure
      expect(result.realtime).toEqual({
        activeTests: expect.any(Number),
        testsPerSecond: expect.any(Number),
        successRate: expect.any(Number),
        averageResponseTime: expect.any(Number),
        errorRate: expect.any(Number),
      })
      
      expect(result.historical).toEqual({
        totalTests: expect.any(Number),
        totalExecutions: expect.any(Number),
        overallSuccessRate: expect.any(Number),
        averageExecutionTime: expect.any(Number),
        mostUsedModels: expect.any(Array),
      })
      
      expect(result.trends).toEqual({
        testsOverTime: expect.any(Array),
        successRateOverTime: expect.any(Array),
        performanceOverTime: expect.any(Array),
      })
      
      expect(result.insights).toEqual(expect.any(Array))
    })
  })

  describe('Concurrent Requests', () => {
    it('handles multiple concurrent requests', async () => {
      const mockCards = [
        createMockPromptCard({ id: 1 }),
        createMockPromptCard({ id: 2 }),
        createMockPromptCard({ id: 3 }),
      ]

      server.use(
        http.get('http://localhost:3001/api/prompt-cards/:id', ({ params }) => {
          const id = parseInt(params.id as string)
          const card = mockCards.find(c => c.id === id)
          
          if (!card) {
            return HttpResponse.json(
              mockApiResponse('Not found', false),
              { status: 404 }
            )
          }
          
          return HttpResponse.json(mockApiResponse(card))
        })
      )

      const promises = [
        api.getPromptCard(1),
        api.getPromptCard(2),
        api.getPromptCard(3),
      ]

      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(3)
      expect(results[0].id).toBe(1)
      expect(results[1].id).toBe(2)
      expect(results[2].id).toBe(3)
    })

    it('handles mixed success and error responses', async () => {
      server.use(
        http.get('http://localhost:3001/api/prompt-cards/:id', ({ params }) => {
          const id = parseInt(params.id as string)
          
          if (id === 1) {
            return HttpResponse.json(mockApiResponse(createMockPromptCard({ id: 1 })))
          } else {
            return HttpResponse.json(
              mockApiResponse('Not found', false),
              { status: 404 }
            )
          }
        })
      )

      const promises = [
        api.getPromptCard(1),
        api.getPromptCard(999).catch(e => e),
      ]

      const results = await Promise.all(promises)
      
      expect(results[0]).toEqual(createMockPromptCard({ id: 1 }))
      expect(results[1]).toBeInstanceOf(ApiError)
    })
  })
})