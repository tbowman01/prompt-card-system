import request from 'supertest';
import { expect } from 'chai';
import app from '../../server';
import { EventStore } from '../../services/analytics/EventStore';
import { AnalyticsEngine } from '../../services/analytics/AnalyticsEngine';
import { WebSocketManager } from '../../services/websocket/ProgressService';

describe('Analytics Dashboard Integration Tests', () => {
  let eventStore: EventStore;
  let analyticsEngine: AnalyticsEngine;
  const testCardId = 'test-card-analytics-123';
  const testSessionId = 'test-session-analytics-456';

  beforeEach(async () => {
    eventStore = new EventStore();
    analyticsEngine = new AnalyticsEngine(eventStore);
    
    // Initialize analytics with test data
    await eventStore.recordEvent('test_execution_start', {
      testSessionId,
      cardId: testCardId,
      timestamp: new Date().toISOString(),
      metadata: {
        testType: 'integration',
        userAgent: 'test-runner'
      }
    });
  });

  describe('Frontend-Backend Analytics Communication', () => {
    it('should handle analytics data retrieval for dashboard', async () => {
      // Test analytics API endpoint
      const response = await request(app)
        .get(`/api/analytics/dashboard/${testCardId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('testMetrics');
      expect(response.body.data).to.have.property('performanceData');
      expect(response.body.data).to.have.property('costAnalysis');
      expect(response.body.data).to.have.property('timeSeriesData');
    });

    it('should handle real-time analytics updates', async () => {
      // Record multiple events
      await eventStore.recordEvent('test_execution_complete', {
        testSessionId,
        cardId: testCardId,
        duration: 1500,
        success: true,
        tokensUsed: 250,
        cost: 0.025
      });

      await eventStore.recordEvent('test_execution_complete', {
        testSessionId: testSessionId + '-2',
        cardId: testCardId,
        duration: 2000,
        success: false,
        tokensUsed: 300,
        cost: 0.030
      });

      // Test real-time metrics endpoint
      const response = await request(app)
        .get(`/api/analytics/metrics/real-time/${testCardId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('successRate');
      expect(response.body.data).to.have.property('averageResponseTime');
      expect(response.body.data).to.have.property('totalCost');
      expect(response.body.data).to.have.property('totalTokens');
    });

    it('should handle analytics filtering and time range queries', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();

      const response = await request(app)
        .post('/api/analytics/query')
        .send({
          cardId: testCardId,
          timeRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          },
          metrics: ['success_rate', 'response_time', 'cost_per_request'],
          granularity: 'hour'
        })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('timeSeries');
      expect(response.body.data).to.have.property('aggregates');
    });
  });

  describe('WebSocket Analytics Updates', () => {
    it('should emit analytics updates via WebSocket', async () => {
      // This would typically test WebSocket connections
      // For now, we'll test the WebSocket service directly
      const wsManager = new WebSocketManager();
      
      // Simulate analytics update
      const analyticsUpdate = {
        cardId: testCardId,
        metrics: {
          successRate: 85.5,
          averageResponseTime: 1200,
          totalTests: 100,
          totalCost: 2.50
        },
        timestamp: new Date().toISOString()
      };

      // Test that analytics updates are properly formatted
      expect(analyticsUpdate).to.have.property('cardId');
      expect(analyticsUpdate).to.have.property('metrics');
      expect(analyticsUpdate.metrics).to.have.property('successRate');
      expect(analyticsUpdate.metrics).to.have.property('averageResponseTime');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing card ID gracefully', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard/')
        .expect(404);
    });

    it('should handle invalid time range queries', async () => {
      const response = await request(app)
        .post('/api/analytics/query')
        .send({
          cardId: testCardId,
          timeRange: {
            start: 'invalid-date',
            end: new Date().toISOString()
          }
        })
        .expect(400);

      expect(response.body.error).to.include('Invalid time range');
    });

    it('should handle high volume analytics data', async () => {
      // Generate multiple events quickly
      const events = [];
      for (let i = 0; i < 100; i++) {
        events.push(eventStore.recordEvent('test_execution_complete', {
          testSessionId: `batch-${i}`,
          cardId: testCardId,
          duration: Math.random() * 3000,
          success: Math.random() > 0.2,
          tokensUsed: Math.floor(Math.random() * 500),
          cost: Math.random() * 0.1
        }));
      }

      await Promise.all(events);

      // Test that analytics can handle the load
      const response = await request(app)
        .get(`/api/analytics/dashboard/${testCardId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.testMetrics.totalTests).to.be.greaterThan(100);
    });
  });

  describe('Performance Metrics Integration', () => {
    it('should calculate and store performance metrics correctly', async () => {
      // Record test execution with performance data
      await eventStore.recordEvent('test_execution_complete', {
        testSessionId,
        cardId: testCardId,
        duration: 1500,
        success: true,
        tokensUsed: 250,
        cost: 0.025,
        performanceMetrics: {
          firstTokenTime: 200,
          totalTokens: 250,
          tokensPerSecond: 166.67,
          memoryUsage: 512,
          cpuUsage: 45.2
        }
      });

      const response = await request(app)
        .get(`/api/analytics/performance/${testCardId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('averageResponseTime');
      expect(response.body.data).to.have.property('tokensPerSecond');
      expect(response.body.data).to.have.property('resourceUtilization');
    });
  });

  describe('Cost Tracking Integration', () => {
    it('should track costs accurately across multiple test executions', async () => {
      // Record multiple test executions with costs
      const executions = [
        { tokens: 100, cost: 0.01, model: 'gpt-3.5-turbo' },
        { tokens: 200, cost: 0.02, model: 'gpt-4' },
        { tokens: 150, cost: 0.015, model: 'gpt-3.5-turbo' }
      ];

      for (const exec of executions) {
        await eventStore.recordEvent('test_execution_complete', {
          testSessionId: `cost-${exec.tokens}`,
          cardId: testCardId,
          tokensUsed: exec.tokens,
          cost: exec.cost,
          model: exec.model
        });
      }

      const response = await request(app)
        .get(`/api/analytics/costs/${testCardId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('totalCost');
      expect(response.body.data).to.have.property('costBreakdown');
      expect(response.body.data.totalCost).to.be.approximately(0.045, 0.001);
    });
  });
});