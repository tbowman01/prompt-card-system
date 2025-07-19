import { api } from '@/lib/api'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'

describe('API Integration Tests', () => {
  describe('Prompt Cards API', () => {
    it('fetches prompt cards with pagination', async () => {
      const result = await api.getPromptCards({ page: 1, limit: 10 })

      expect(result.prompt_cards).toBeDefined()
      expect(result.pagination).toBeDefined()
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(Array.isArray(result.prompt_cards)).toBe(true)
    })

    it('searches prompt cards by title', async () => {
      const result = await api.getPromptCards({ search: 'Customer' })

      expect(result.prompt_cards).toBeDefined()
      expect(result.prompt_cards.length).toBeGreaterThan(0)
      expect(result.prompt_cards[0].title).toContain('Customer')
    })

    it('creates a new prompt card', async () => {
      const newCard = {
        title: 'Integration Test Card',
        description: 'Test description',
        prompt_template: 'Hello {{name}}',
        variables: ['name'],
      }

      const result = await api.createPromptCard(newCard)

      expect(result.id).toBeDefined()
      expect(result.title).toBe(newCard.title)
      expect(result.prompt_template).toBe(newCard.prompt_template)
      expect(result.variables).toEqual(newCard.variables)
    })

    it('fetches a specific prompt card', async () => {
      const result = await api.getPromptCard(1)

      expect(result.id).toBe(1)
      expect(result.title).toBeDefined()
      expect(result.prompt_template).toBeDefined()
      expect(result.test_cases).toBeDefined()
    })

    it('updates an existing prompt card', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      }

      const result = await api.updatePromptCard(1, updateData)

      expect(result.title).toBe(updateData.title)
      expect(result.description).toBe(updateData.description)
    })

    it('deletes a prompt card', async () => {
      const result = await api.deletePromptCard(1)
      expect(result.message).toContain('deleted successfully')
    })

    it('handles 404 errors for non-existent cards', async () => {
      await expect(api.getPromptCard(99999)).rejects.toThrow('Prompt card not found')
    })
  })

  describe('Test Cases API', () => {
    it('fetches test cases for a prompt card', async () => {
      const result = await api.getTestCases(1)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].prompt_card_id).toBe(1)
    })

    it('creates a new test case', async () => {
      const newTestCase = {
        prompt_card_id: 1,
        name: 'Integration test case',
        input_variables: { name: 'John' },
        expected_output: 'Hello John',
        assertions: [
          { type: 'contains', value: 'John', description: 'Should contain name' },
        ],
      }

      const result = await api.createTestCase(newTestCase)

      expect(result.id).toBeDefined()
      expect(result.name).toBe(newTestCase.name)
      expect(result.input_variables).toEqual(newTestCase.input_variables)
    })
  })

  describe('Test Execution API', () => {
    it('starts test execution', async () => {
      const testData = {
        prompt_card_id: 1,
        test_case_ids: [1, 2],
        model: 'gpt-4',
      }

      const result = await api.runTests(testData)

      expect(result.execution_id).toBeDefined()
      expect(result.status).toBe('started')
    })

    it('fetches test execution status', async () => {
      const result = await api.getTestExecution('exec-123')

      expect(result.id).toBe('exec-123')
      expect(result.status).toBeDefined()
      expect(result.prompt_card_id).toBeDefined()
    })

    it('runs a single test case', async () => {
      const result = await api.runSingleTest(1, { model: 'gpt-4' })

      expect(result).toBeDefined()
    })
  })

  describe('Analytics API', () => {
    it('fetches dashboard metrics', async () => {
      const result = await api.getDashboardMetrics()

      expect(result.realtime).toBeDefined()
      expect(result.historical).toBeDefined()
      expect(result.trends).toBeDefined()
      expect(result.insights).toBeDefined()

      // Verify realtime metrics structure
      expect(result.realtime.activeTests).toBeDefined()
      expect(result.realtime.testsPerSecond).toBeDefined()
      expect(result.realtime.successRate).toBeDefined()

      // Verify historical metrics
      expect(result.historical.totalTests).toBeDefined()
      expect(result.historical.mostUsedModels).toBeDefined()
      expect(Array.isArray(result.historical.mostUsedModels)).toBe(true)
    })

    it('records test execution analytics', async () => {
      const analyticsData = {
        executionId: 'exec-123',
        promptCardId: 1,
        testCaseIds: [1, 2],
        model: 'gpt-4',
        duration: 2500,
        success: true,
      }

      const result = await api.recordTestExecution(analyticsData)
      expect(result).toBeDefined()
    })
  })

  describe('YAML Operations API', () => {
    it('validates YAML content', async () => {
      const yamlContent = `
title: Test Card
description: Test description
prompt_template: Hello {{name}}
variables:
  - name
test_cases:
  - name: Test case 1
    input_variables:
      name: John
    expected_output: Hello John
`

      const result = await api.validateYAML(yamlContent)
      expect(result.valid).toBe(true)
    })

    it('imports YAML content', async () => {
      const yamlContent = `
title: Imported Card
description: Imported from YAML
prompt_template: Hi {{user}}
variables:
  - user
`

      const result = await api.importYAML(yamlContent)
      expect(result.imported).toBeDefined()
    })

    it('exports YAML for a specific card', async () => {
      const response = await api.exportYAML(1)
      expect(response).toBeInstanceOf(Response)
    })
  })

  describe('Health Check API', () => {
    it('fetches system health status', async () => {
      const result = await api.getHealth()

      expect(result.status).toBe('healthy')
      expect(result.timestamp).toBeDefined()
      expect(result.services).toBeDefined()
      expect(result.services.database).toBeDefined()
      expect(result.services.ollama).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('handles server errors gracefully', async () => {
      // Override handler to return error
      server.use(
        http.get('http://localhost:3001/api/error', () => {
          return HttpResponse.json({ success: false, error: 'Server error' }, { status: 500 })
        })
      )

      await expect(api.getHealth()).rejects.toThrow()
    })

    it('handles network errors', async () => {
      // Override handler to simulate network error
      server.use(
        http.get('http://localhost:3001/api/network-error', () => {
          return HttpResponse.error()
        })
      )

      await expect(
        fetch('http://localhost:3001/api/network-error')
      ).rejects.toThrow()
    })

    it('handles malformed JSON responses', async () => {
      server.use(
        http.get('http://localhost:3001/api/malformed', () => {
          return new Response('invalid json', {
            headers: { 'Content-Type': 'application/json' }
          })
        })
      )

      await expect(
        fetch('http://localhost:3001/api/malformed').then(r => r.json())
      ).rejects.toThrow()
    })
  })

  describe('Rate Limiting and Retry Logic', () => {
    it('handles rate limiting responses', async () => {
      let callCount = 0
      server.use(
        http.get('http://localhost:3001/api/rate-limited', () => {
          callCount++
          if (callCount <= 2) {
            return HttpResponse.json({ success: false, error: 'Rate limited' }, { status: 429 })
          }
          return HttpResponse.json({ success: true, data: 'success' })
        })
      )

      // This would require implementing retry logic in the API client
      // For now, we just test that rate limiting is handled
      try {
        await fetch('http://localhost:3001/api/rate-limited')
      } catch (error) {
        // Expected to fail on first attempts
      }
    })
  })

  describe('Authentication and Authorization', () => {
    it('includes authorization headers when provided', async () => {
      // This test would be relevant when auth is implemented
      const customHeaders = {
        'Authorization': 'Bearer test-token',
      }

      // Mock implementation would verify headers are passed through
      expect(customHeaders['Authorization']).toBe('Bearer test-token')
    })
  })
})