import express from 'express';
import { AnalyticsEngine } from '../services/analytics/AnalyticsEngine';

const router = express.Router();
const analyticsEngine = AnalyticsEngine.getInstance();

// Get dashboard metrics
router.get('/dashboard', async (req, res) => {
  try {
    const metrics = await analyticsEngine.getDashboardMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard metrics' 
    });
  }
});

// Get real-time metrics
router.get('/realtime', async (req, res) => {
  try {
    const metrics = await analyticsEngine.calculateRealtimeMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error fetching real-time metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch real-time metrics' 
    });
  }
});

// Get historical metrics
router.get('/historical', async (req, res) => {
  try {
    const metrics = await analyticsEngine.calculateHistoricalMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error fetching historical metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch historical metrics' 
    });
  }
});

// Get trends with optional parameters
router.get('/trends', async (req, res) => {
  try {
    const { period = 'day', limit = 30 } = req.query;
    const trends = await analyticsEngine.calculateTrends(
      period as 'hour' | 'day' | 'week' | 'month',
      parseInt(limit as string, 10)
    );
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch trends' 
    });
  }
});

// Get insights
router.get('/insights', async (req, res) => {
  try {
    const insights = await analyticsEngine.generateInsights();
    res.json({ success: true, data: insights });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch insights' 
    });
  }
});

// Record test execution event
router.post('/events/test-execution', async (req, res) => {
  try {
    const { testCaseId, executionId, model, passed, executionTime, metadata } = req.body;
    
    await analyticsEngine.recordTestExecution(
      testCaseId,
      executionId,
      model,
      passed,
      executionTime,
      metadata
    );
    
    res.json({ success: true, message: 'Test execution recorded' });
  } catch (error) {
    console.error('Error recording test execution:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record test execution' 
    });
  }
});

// Record batch execution event
router.post('/events/batch-execution', async (req, res) => {
  try {
    const { promptCardId, executionId, model, totalTests, passedTests, executionTime, metadata } = req.body;
    
    await analyticsEngine.recordBatchExecution(
      promptCardId,
      executionId,
      model,
      totalTests,
      passedTests,
      executionTime,
      metadata
    );
    
    res.json({ success: true, message: 'Batch execution recorded' });
  } catch (error) {
    console.error('Error recording batch execution:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record batch execution' 
    });
  }
});

// Record model usage event
router.post('/events/model-usage', async (req, res) => {
  try {
    const { model, usage } = req.body;
    
    await analyticsEngine.recordModelUsage(model, usage);
    
    res.json({ success: true, message: 'Model usage recorded' });
  } catch (error) {
    console.error('Error recording model usage:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record model usage' 
    });
  }
});

// Record system metrics
router.post('/events/system-metrics', async (req, res) => {
  try {
    const { metrics } = req.body;
    
    await analyticsEngine.recordSystemMetrics(metrics);
    
    res.json({ success: true, message: 'System metrics recorded' });
  } catch (error) {
    console.error('Error recording system metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record system metrics' 
    });
  }
});

export { router as analyticsRoutes };