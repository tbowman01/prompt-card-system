import request from 'supertest';
import assert from 'assert';
import app from '../../server';
import { EventStore } from '../../services/analytics/EventStore';
import { AnalyticsEngine } from '../../services/analytics/AnalyticsEngine';

describe('Analytics Dashboard Integration Tests', () => {
  let eventStore: EventStore;
  let analyticsEngine: AnalyticsEngine;
  const testCardId = 'test-card-analytics-123';
  const testSessionId = 'test-session-analytics-456';

  beforeEach(async () => {
    eventStore = EventStore.getInstance();
    analyticsEngine = AnalyticsEngine.getInstance();
    
    // Initialize analytics with test data
    await eventStore.recordEvent({
      event_type: 'test_execution_start',
      entity_id: testCardId,
      entity_type: 'prompt_card',
      data: {
        testSessionId,
        cardId: testCardId
      },
      timestamp: new Date(),
      metadata: {
        testType: 'integration',
        userAgent: 'test-runner'
      }
    });
  });

  describe('Frontend-Backend Analytics Communication', () => {
    it('should handle analytics data retrieval for dashboard', async () => {
      const response = await request(app)
        .get(`/api/analytics/dashboard/${testCardId}`)
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('costAnalysis');
      expect(response.body.data).toHaveProperty('timeSeriesData');
    });

    it('should handle real-time analytics updates', async () => {
      // Record multiple events
      await eventStore.recordEvent({
        event_type: 'test_execution_complete',
        entity_id: testCardId,
        entity_type: 'prompt_card',
        data: {
          testSessionId,
          cardId: testCardId,
          duration: 1500,
          success: true,
          tokensUsed: 250,
          cost: 0.025
        },
        timestamp: new Date()
      });

      await eventStore.recordEvent({
        event_type: 'test_execution_complete',
        entity_id: testCardId,
        entity_type: 'prompt_card',
        data: {
          testSessionId: testSessionId + '-2',
          cardId: testCardId,
          duration: 2000,
          success: false,
          tokensUsed: 300,
          cost: 0.030
        },
        timestamp: new Date()
      });

      // Test real-time metrics endpoint
      const response = await request(app)
        .get(`/api/analytics/metrics/real-time/${testCardId}`)
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('activeTests');
      expect(response.body.data).toHaveProperty('recentCompletions');
      expect(response.body.data).toHaveProperty('averageExecutionTime');
    });
  });

  describe('Performance Analytics', () => {
    it('should calculate and store performance metrics correctly', async () => {
      // Record test execution with performance data
      await eventStore.recordEvent({
        event_type: 'test_execution_complete',
        entity_id: testCardId,
        entity_type: 'prompt_card',
        data: {
          testSessionId,
          cardId: testCardId,
          duration: 1500,
          success: true,
          tokensUsed: 250,
          cost: 0.025,
          model: 'gpt-4'
        },
        timestamp: new Date(),
        metadata: {
          promptLength: 120,
          responseLength: 85,
          cacheHit: false
        }
      });

      // Get performance metrics
      const response = await request(app)
        .get(`/api/analytics/performance/${testCardId}`)
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('averageExecutionTime');
      expect(response.body.data).toHaveProperty('successRate');
      expect(response.body.data).toHaveProperty('tokenUsageStats');
      expect(typeof response.body.data.averageExecutionTime).toBe('number');
      expect(response.body.data.successRate).toBeGreaterThanOrEqual(0);
      expect(response.body.data.successRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Cost Analytics', () => {
    it('should track costs across multiple models correctly', async () => {
      const executions = [
        { model: 'gpt-4', tokens: 250, cost: 0.025 },
        { model: 'gpt-3.5-turbo', tokens: 300, cost: 0.015 },
        { model: 'claude-2', tokens: 200, cost: 0.020 }
      ];

      for (const exec of executions) {
        await eventStore.recordEvent({
          event_type: 'test_execution_complete',
          entity_id: testCardId,
          entity_type: 'prompt_card',
          data: {
            testSessionId: `cost-${exec.tokens}`,
            cardId: testCardId,
            tokensUsed: exec.tokens,
            cost: exec.cost,
            model: exec.model
          },
          timestamp: new Date()
        });
      }

      // Get cost analytics
      const response = await request(app)
        .get(`/api/analytics/costs/${testCardId}`)
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('totalCost');
      expect(response.body.data).toHaveProperty('costBreakdown');
      expect(response.body.data.totalCost).toBeCloseTo(0.060, 3);
    });
  });
});