import { Router } from 'express';
import { loadTestingFramework, LoadTestScenario } from '../services/performance/LoadTestingFramework';
import { performanceRegressionDetector } from '../services/performance/PerformanceRegressionDetector';
import { performanceBenchmark } from '../services/performance/PerformanceBenchmark';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';

const router = Router();

// Validation schemas
const scenarioSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().required(),
  config: Joi.object({
    baseUrl: Joi.string().uri().required(),
    endpoints: Joi.array().items(
      Joi.object({
        path: Joi.string().required(),
        method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').required(),
        weight: Joi.number().min(0).max(100).required(),
        headers: Joi.object().optional(),
        body: Joi.any().optional(),
        timeout: Joi.number().min(1000).optional(),
        params: Joi.object().optional(),
        validation: Joi.object({
          statusCode: Joi.array().items(Joi.number()).optional(),
          responseTime: Joi.number().optional(),
          bodyContains: Joi.array().items(Joi.string()).optional(),
          headerExists: Joi.array().items(Joi.string()).optional()
        }).optional()
      })
    ).min(1).required(),
    users: Joi.object({
      concurrent: Joi.number().min(1).max(1000).required(),
      rampUp: Joi.object({
        duration: Joi.number().min(1).required(),
        strategy: Joi.string().valid('linear', 'exponential', 'step').required()
      }).required(),
      rampDown: Joi.object({
        duration: Joi.number().min(1).required(),
        strategy: Joi.string().valid('linear', 'exponential', 'immediate').required()
      }).required(),
      thinkTime: Joi.object({
        min: Joi.number().min(0).required(),
        max: Joi.number().min(0).required(),
        distribution: Joi.string().valid('uniform', 'normal', 'exponential').required()
      }).required()
    }).required(),
    duration: Joi.object({
      total: Joi.number().min(10).max(3600).required(),
      warmup: Joi.number().min(0).optional(),
      cooldown: Joi.number().min(0).optional()
    }).required(),
    thresholds: Joi.object({
      responseTime: Joi.object({
        p95: Joi.number().min(1).required(),
        p99: Joi.number().min(1).required(),
        max: Joi.number().min(1).required()
      }).required(),
      errorRate: Joi.object({
        max: Joi.number().min(0).max(100).required()
      }).required(),
      throughput: Joi.object({
        min: Joi.number().min(0).required()
      }).required()
    }).required(),
    environment: Joi.object({
      variables: Joi.object().optional(),
      dataFiles: Joi.array().items(Joi.string()).optional(),
      concurrent: Joi.boolean().optional(),
      keepAlive: Joi.boolean().optional(),
      compression: Joi.boolean().optional()
    }).optional()
  }).required()
});

const runTestSchema = Joi.object({
  scenarioId: Joi.string().required(),
  options: Joi.object({
    dryRun: Joi.boolean().optional(),
    saveBaseline: Joi.boolean().optional(),
    compareBaseline: Joi.boolean().optional()
  }).optional()
});

const regressionTestSchema = Joi.object({
  scenarioIds: Joi.array().items(Joi.string()).min(1).required()
});

const baselineSchema = Joi.object({
  scenarioId: Joi.string().required(),
  version: Joi.string().optional(),
  environment: Joi.string().optional(),
  confidence: Joi.number().min(0).max(1).optional()
});

const thresholdSchema = Joi.object({
  metric: Joi.string().required(),
  warning: Joi.number().min(0).required(),
  critical: Joi.number().min(0).required(),
  method: Joi.string().valid('absolute', 'statistical', 'adaptive').required(),
  confidence: Joi.number().min(0).max(1).required(),
  minSampleSize: Joi.number().min(1).required()
});

/**
 * GET /load-testing/scenarios
 * Get all registered load test scenarios
 */
router.get('/scenarios', (req, res) => {
  try {
    const scenarios = loadTestingFramework.getScenarios();
    
    res.json({
      success: true,
      data: {
        scenarios,
        count: scenarios.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/scenarios
 * Register a new load test scenario
 */
router.post('/scenarios', validateRequest(scenarioSchema), (req, res) => {
  try {
    const scenario: LoadTestScenario = req.body;
    
    loadTestingFramework.registerScenario(scenario);
    
    res.status(201).json({
      success: true,
      data: {
        message: 'Scenario registered successfully',
        scenarioId: scenario.id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/run
 * Run a load test scenario
 */
router.post('/run', validateRequest(runTestSchema), async (req, res) => {
  try {
    const { scenarioId, options } = req.body;
    
    // Check if test is already running
    const status = loadTestingFramework.getStatus();
    if (status.isRunning) {
      return res.status(409).json({
        success: false,
        error: 'Load test is already running',
        currentTest: status.currentTest
      });
    }
    
    // Start test asynchronously
    const testPromise = loadTestingFramework.runLoadTest(scenarioId, options);
    
    // Return immediately with test started status
    res.status(202).json({
      success: true,
      data: {
        message: 'Load test started',
        scenarioId,
        status: 'running'
      }
    });
    
    // Handle test completion
    testPromise.then(results => {
      console.log(`Load test completed for scenario: ${scenarioId}`);
    }).catch(error => {
      console.error(`Load test failed for scenario: ${scenarioId}`, error);
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /load-testing/status
 * Get current load test status
 */
router.get('/status', (req, res) => {
  try {
    const status = loadTestingFramework.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/stop
 * Stop current load test
 */
router.post('/stop', async (req, res) => {
  try {
    await loadTestingFramework.stopTest();
    
    res.json({
      success: true,
      data: {
        message: 'Load test stopped successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/regression-test
 * Run regression test on multiple scenarios
 */
router.post('/regression-test', validateRequest(regressionTestSchema), async (req, res) => {
  try {
    const { scenarioIds } = req.body;
    
    // Start regression test asynchronously
    const regressionPromise = loadTestingFramework.runRegressionTest(scenarioIds);
    
    res.status(202).json({
      success: true,
      data: {
        message: 'Regression test started',
        scenarioIds,
        status: 'running'
      }
    });
    
    // Handle completion
    regressionPromise.then(results => {
      console.log('Regression test completed:', results);
    }).catch(error => {
      console.error('Regression test failed:', error);
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /load-testing/results/:scenarioId?
 * Get load test results
 */
router.get('/results/:scenarioId?', async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    let query = `
      SELECT * FROM load_test_results 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    let params: any[] = [limit, offset];
    
    if (scenarioId) {
      query = `
        SELECT * FROM load_test_results 
        WHERE scenario_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      params = [scenarioId, limit, offset];
    }
    
    const stmt = loadTestingFramework['db']?.prepare?.(query) || require('../../database/connection').db.prepare(query);
    const results = stmt.all(...params);
    
    const formattedResults = results.map((row: any) => ({
      id: row.id,
      scenarioId: row.scenario_id,
      scenarioName: row.scenario_name,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      totalRequests: row.total_requests,
      successfulRequests: row.successful_requests,
      failedRequests: row.failed_requests,
      requestsPerSecond: row.requests_per_second,
      avgResponseTime: row.avg_response_time,
      p95ResponseTime: row.p95_response_time,
      p99ResponseTime: row.p99_response_time,
      errorRate: row.error_rate,
      createdAt: row.created_at,
      // Include full results if requested
      ...(req.query.detailed === 'true' && { fullResults: JSON.parse(row.results_json || '{}') })
    }));
    
    res.json({
      success: true,
      data: {
        results: formattedResults,
        pagination: {
          limit,
          offset,
          count: formattedResults.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/baselines
 * Set performance baseline for a scenario
 */
router.post('/baselines', validateRequest(baselineSchema), async (req, res) => {
  try {
    const { scenarioId, version, environment, confidence } = req.body;
    
    // Get the latest test results for the scenario
    const stmt = require('../../database/connection').db.prepare(`
      SELECT results_json FROM load_test_results 
      WHERE scenario_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    const row = stmt.get(scenarioId);
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'No test results found for scenario'
      });
    }
    
    const results = JSON.parse(row.results_json);
    await performanceRegressionDetector.setBaseline(scenarioId, results, {
      version,
      environment,
      confidence
    });
    
    res.json({
      success: true,
      data: {
        message: 'Baseline set successfully',
        scenarioId,
        version,
        environment
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /load-testing/baselines
 * Get all performance baselines
 */
router.get('/baselines', (req, res) => {
  try {
    const baselines = performanceRegressionDetector.getBaselines();
    
    res.json({
      success: true,
      data: {
        baselines,
        count: baselines.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /load-testing/regression-alerts
 * Get regression alerts
 */
router.get('/regression-alerts', async (req, res) => {
  try {
    const { start, end, severity, scenarioId } = req.query;
    
    let period;
    if (start && end) {
      period = {
        start: new Date(start as string),
        end: new Date(end as string)
      };
    }
    
    let alerts = await performanceRegressionDetector.getRegressionAlerts(period);
    
    // Filter by severity if provided
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Filter by scenario if provided
    if (scenarioId) {
      alerts = alerts.filter(alert => alert.scenarioId === scenarioId);
    }
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        severityBreakdown: {
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/regression-thresholds
 * Set regression detection thresholds
 */
router.post('/regression-thresholds', validateRequest(thresholdSchema), (req, res) => {
  try {
    const threshold = req.body;
    
    performanceRegressionDetector.setThreshold(threshold.metric, threshold);
    
    res.json({
      success: true,
      data: {
        message: 'Threshold updated successfully',
        metric: threshold.metric
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /load-testing/regression-report/:scenarioId
 * Generate regression report for a scenario
 */
router.get('/regression-report/:scenarioId', async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Start and end dates are required'
      });
    }
    
    const period = {
      start: new Date(start as string),
      end: new Date(end as string)
    };
    
    const report = await performanceRegressionDetector.generateRegressionReport(scenarioId, period);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/regression-monitoring/start
 * Start automated regression monitoring
 */
router.post('/regression-monitoring/start', (req, res) => {
  try {
    const interval = parseInt(req.body.intervalMinutes) || 15;
    
    performanceRegressionDetector.startMonitoring(interval);
    
    res.json({
      success: true,
      data: {
        message: 'Regression monitoring started',
        intervalMinutes: interval
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/regression-monitoring/stop
 * Stop automated regression monitoring
 */
router.post('/regression-monitoring/stop', (req, res) => {
  try {
    performanceRegressionDetector.stopMonitoring();
    
    res.json({
      success: true,
      data: {
        message: 'Regression monitoring stopped'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /load-testing/benchmarks
 * Get available performance benchmarks
 */
router.get('/benchmarks', (req, res) => {
  try {
    const status = performanceBenchmark.getStatus();
    
    res.json({
      success: true,
      data: {
        status,
        availableBenchmarks: [
          'Analytics Engine',
          'Report Generation',
          'Optimization Engine',
          'Database Queries',
          'Cache Performance',
          'Memory Usage',
          'Concurrent Operations'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/benchmarks/run
 * Run performance benchmark suite
 */
router.post('/benchmarks/run', async (req, res) => {
  try {
    const suiteName = req.body.suiteName || 'Performance Benchmark Suite';
    
    // Check if already running
    const status = performanceBenchmark.getStatus();
    if (status.isRunning) {
      return res.status(409).json({
        success: false,
        error: 'Benchmark suite is already running',
        currentSuite: status.currentSuite,
        progress: status.progress
      });
    }
    
    // Start benchmark asynchronously
    const benchmarkPromise = performanceBenchmark.runBenchmarkSuite(suiteName);
    
    res.status(202).json({
      success: true,
      data: {
        message: 'Benchmark suite started',
        suiteName,
        status: 'running'
      }
    });
    
    // Handle completion
    benchmarkPromise.then(results => {
      console.log('Benchmark suite completed:', results.name);
    }).catch(error => {
      console.error('Benchmark suite failed:', error);
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /load-testing/benchmarks/status
 * Get benchmark execution status
 */
router.get('/benchmarks/status', (req, res) => {
  try {
    const status = performanceBenchmark.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /load-testing/neural-training
 * Train neural model for anomaly detection
 */
router.post('/neural-training', async (req, res) => {
  try {
    await performanceRegressionDetector.trainNeuralModel();
    
    res.json({
      success: true,
      data: {
        message: 'Neural model training completed'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /load-testing/health
 * Health check for load testing services
 */
router.get('/health', (req, res) => {
  try {
    const loadTestStatus = loadTestingFramework.getStatus();
    const benchmarkStatus = performanceBenchmark.getStatus();
    
    const health = {
      loadTesting: {
        available: true,
        running: loadTestStatus.isRunning,
        currentTest: loadTestStatus.currentTest
      },
      benchmarks: {
        available: true,
        running: benchmarkStatus.isRunning,
        currentSuite: benchmarkStatus.currentSuite
      },
      regressionDetection: {
        available: true,
        monitoring: performanceRegressionDetector['isMonitoring'] || false
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;