import request from 'supertest';
import app from '../server';
import { mlAnalyticsCoordinator } from '../services/analytics/MLAnalyticsCoordinator';
import { anomalyDetector } from '../services/analytics/AnomalyDetector';
import { capacityPlanner } from '../services/analytics/CapacityPlanner';

describe('Predictive Analytics API', () => {
  beforeAll(async () => {
    // Initialize ML Analytics Coordinator for testing
    await mlAnalyticsCoordinator.initialize();
  });

  afterAll(async () => {
    // Clean up
    await mlAnalyticsCoordinator.stop();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('predictiveAnalytics');
      expect(response.body.data).toHaveProperty('anomalyDetection');
      expect(response.body.data).toHaveProperty('capacityPlanning');
    });
  });

  describe('Model Training', () => {
    it('should train capacity prediction model', async () => {
      const response = await request(app)
        .post('/api/predictive-analytics/models/capacity/train')
        .send({
          metric: 'cpu_usage',
          timeframeDays: 7
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('modelId');
      expect(response.body.data).toHaveProperty('accuracy');
    });

    it('should train anomaly detection model', async () => {
      const response = await request(app)
        .post('/api/predictive-analytics/models/anomaly/train')
        .send({
          metrics: ['cpu_usage', 'memory_usage'],
          timeframeDays: 7
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('modelId');
      expect(response.body.data).toHaveProperty('features');
    });

    it('should handle insufficient training data', async () => {
      const response = await request(app)
        .post('/api/predictive-analytics/models/capacity/train')
        .send({
          metric: 'nonexistent_metric',
          timeframeDays: 1
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient training data');
    });
  });

  describe('Predictions', () => {
    it('should get capacity predictions', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/predictions/capacity')
        .query({
          metric: 'cpu_usage',
          timeframe: '24h'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metric');
      expect(response.body.data).toHaveProperty('currentValue');
      expect(response.body.data).toHaveProperty('predictedValue');
      expect(response.body.data).toHaveProperty('confidence');
    });

    it('should require metric parameter for predictions', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/predictions/capacity')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Metric parameter is required');
    });

    it('should get growth projections', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/projections/growth')
        .query({
          metric: 'memory_usage',
          projectionDays: 14
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('current');
      expect(response.body.data).toHaveProperty('projected');
      expect(response.body.data).toHaveProperty('growthRate');
      expect(response.body.data).toHaveProperty('recommendations');
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/anomalies/detect')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should start anomaly detection', async () => {
      const response = await request(app)
        .post('/api/predictive-analytics/anomaly-detection/start')
        .send({ intervalMs: 60000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('started');
    });

    it('should stop anomaly detection', async () => {
      const response = await request(app)
        .post('/api/predictive-analytics/anomaly-detection/stop')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('stopped');
    });

    it('should get active alerts', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/anomaly-detection/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get detection statistics', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/anomaly-detection/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalAlerts');
      expect(response.body.data).toHaveProperty('activeAlerts');
      expect(response.body.data).toHaveProperty('detectionAccuracy');
    });

    it('should update statistical thresholds', async () => {
      const response = await request(app)
        .post('/api/predictive-analytics/anomaly-detection/thresholds')
        .send({
          metric: 'cpu_usage',
          windowDays: 7
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metric');
      expect(response.body.data).toHaveProperty('upperBound');
      expect(response.body.data).toHaveProperty('lowerBound');
    });
  });

  describe('Capacity Planning', () => {
    it('should start capacity monitoring', async () => {
      const response = await request(app)
        .post('/api/predictive-analytics/capacity/monitoring/start')
        .send({ intervalMs: 300000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('started');
    });

    it('should generate capacity forecast', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/capacity/forecast')
        .query({
          resources: 'cpu,memory,storage',
          timeframes: '1h,6h,24h'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Object);
    });

    it('should generate scaling recommendations', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/capacity/recommendations/scaling')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should create growth projections', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/capacity/projections/cpu')
        .query({ projectionDays: 30 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('current');
      expect(response.body.data).toHaveProperty('projected');
      expect(response.body.data).toHaveProperty('seasonality');
      expect(response.body.data).toHaveProperty('scenarios');
    });

    it('should generate optimization recommendations', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/capacity/recommendations/optimization')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cpu');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('storage');
    });

    it('should get capacity alerts', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/capacity/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get capacity dashboard', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/capacity/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('resources');
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('forecasts');
    });
  });

  describe('ML Insights', () => {
    it('should generate ML insights', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/insights')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should auto-retrain models', async () => {
      const response = await request(app)
        .post('/api/predictive-analytics/models/retrain')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('retrained');
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge an alert', async () => {
      // First create a mock alert ID
      const alertId = 'test_alert_123';
      
      const response = await request(app)
        .post(`/api/predictive-analytics/anomaly-detection/alerts/${alertId}/acknowledge`)
        .send({ userId: 'test_user' })
        .expect(404); // Will be 404 for non-existent alert

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should resolve an alert', async () => {
      // First create a mock alert ID
      const alertId = 'test_alert_123';
      
      const response = await request(app)
        .post(`/api/predictive-analytics/anomaly-detection/alerts/${alertId}/resolve`)
        .send({ userId: 'test_user' })
        .expect(404); // Will be 404 for non-existent alert

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('Configuration Management', () => {
    it('should update detection configuration', async () => {
      const response = await request(app)
        .put('/api/predictive-analytics/anomaly-detection/config')
        .send({
          sensitivity: 'high',
          alertThreshold: 0.8
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated');
    });

    it('should export detection data', async () => {
      const response = await request(app)
        .get('/api/predictive-analytics/anomaly-detection/export')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('config');
      expect(response.body.data).toHaveProperty('models');
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('stats');
    });
  });
});

describe('ML Analytics Coordinator', () => {
  it('should get system health score', async () => {
    const healthScore = await mlAnalyticsCoordinator.getSystemHealthScore();
    
    expect(healthScore).toHaveProperty('overall');
    expect(healthScore).toHaveProperty('components');
    expect(healthScore).toHaveProperty('trends');
    expect(healthScore).toHaveProperty('riskLevel');
    expect(healthScore).toHaveProperty('recommendations');
    expect(Array.isArray(healthScore.recommendations)).toBe(true);
  });

  it('should get analytics summary', async () => {
    const summary = await mlAnalyticsCoordinator.getAnalyticsSummary();
    
    expect(summary).toHaveProperty('timestamp');
    expect(summary).toHaveProperty('systemHealth');
    expect(summary).toHaveProperty('uptime');
    expect(summary).toHaveProperty('insights');
  });

  it('should get status', () => {
    const status = mlAnalyticsCoordinator.getStatus();
    
    expect(status).toHaveProperty('isInitialized');
    expect(status).toHaveProperty('isRunning');
    expect(status).toHaveProperty('uptime');
    expect(status).toHaveProperty('services');
  });

  it('should perform comprehensive system analysis', async () => {
    const analysis = await mlAnalyticsCoordinator.performSystemAnalysis();
    
    expect(analysis).toHaveProperty('healthScore');
    expect(analysis).toHaveProperty('predictions');
    expect(analysis).toHaveProperty('anomalies');
    expect(analysis).toHaveProperty('capacityForecasts');
    expect(analysis).toHaveProperty('optimizationRecommendations');
    expect(analysis).toHaveProperty('actionPlan');
    expect(Array.isArray(analysis.actionPlan)).toBe(true);
  });

  it('should update configuration', () => {
    const newConfig = {
      enablePredictiveAnalytics: false,
      monitoring: {
        anomalyDetectionInterval: 60000,
        capacityPlanningInterval: 600000,
        performanceInterval: 10000
      }
    };
    
    mlAnalyticsCoordinator.updateConfig(newConfig);
    const config = mlAnalyticsCoordinator.getConfig();
    
    expect(config.enablePredictiveAnalytics).toBe(false);
    expect(config.monitoring.anomalyDetectionInterval).toBe(60000);
  });
});

describe('Error Handling', () => {
  it('should handle missing parameters gracefully', async () => {
    const response = await request(app)
      .post('/api/predictive-analytics/models/capacity/train')
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('required');
  });

  it('should handle invalid timeframes', async () => {
    const response = await request(app)
      .get('/api/predictive-analytics/predictions/capacity')
      .query({
        metric: 'cpu_usage',
        timeframe: 'invalid'
      })
      .expect(500);

    expect(response.body.success).toBe(false);
  });

  it('should handle service unavailable errors', async () => {
    // This test would simulate service failures
    // Implementation depends on how services handle failures
  });
});

describe('Performance Tests', () => {
  it('should respond quickly to health checks', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/predictive-analytics/health')
      .expect(200);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should respond within 1 second
  });

  it('should handle concurrent requests', async () => {
    const promises = Array(10).fill(null).map(() =>
      request(app)
        .get('/api/predictive-analytics/health')
        .expect(200)
    );

    const responses = await Promise.all(promises);
    responses.forEach(response => {
      expect(response.body.success).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('should integrate with existing analytics engine', async () => {
    // Test that new predictive analytics works with existing analytics
    const [analytics, predictive] = await Promise.all([
      request(app).get('/api/analytics/dashboard'),
      request(app).get('/api/predictive-analytics/health')
    ]);

    expect(analytics.status).toBe(200);
    expect(predictive.status).toBe(200);
  });

  it('should work with performance monitoring', async () => {
    const [performance, predictive] = await Promise.all([
      request(app).get('/api/performance/summary'),
      request(app).get('/api/predictive-analytics/capacity/dashboard')
    ]);

    expect(performance.status).toBe(200);
    expect(predictive.status).toBe(200);
  });
});