import express from 'express';
import { Request, Response } from 'express';
import { promptAnalyzer } from '../services/optimization/PromptAnalyzer';
import { optimizationEngine } from '../services/optimization/OptimizationEngine';
import { securityAnalyzer } from '../services/optimization/SecurityAnalyzer';
import { advancedKVCache } from '../services/optimization/AdvancedKVCache';

const router = express.Router();

/**
 * POST /api/optimization/analyze
 * Analyze prompt effectiveness and generate insights
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { promptId, promptText, timeRange } = req.body;
    
    if (!promptId || !promptText) {
      return res.status(400).json({
        error: 'Missing required fields: promptId, promptText'
      });
    }
    
    const analysis = await promptAnalyzer.analyzePrompt(
      promptId,
      promptText,
      timeRange
    );
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Prompt analysis error:', error);
    res.status(500).json({
      error: 'Prompt analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/compare
 * Compare two prompts and determine which performs better
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { promptA, promptB, testCases, model } = req.body;
    
    if (!promptA || !promptB) {
      return res.status(400).json({
        error: 'Missing required fields: promptA, promptB'
      });
    }
    
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({
        error: 'testCases must be a non-empty array'
      });
    }
    
    const comparison = await promptAnalyzer.comparePrompts(
      promptA,
      promptB,
      testCases,
      model
    );
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Prompt comparison error:', error);
    res.status(500).json({
      error: 'Prompt comparison failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/suggestions/:promptId
 * Get AI-powered optimization suggestions for a prompt
 */
router.get('/suggestions/:promptId', async (req: Request, res: Response) => {
  try {
    const { promptId } = req.params;
    const { originalPrompt, targetMetrics, constraints } = req.query;
    
    if (!originalPrompt) {
      return res.status(400).json({
        error: 'Missing required query parameter: originalPrompt'
      });
    }
    
    const parsedTargetMetrics = targetMetrics ? JSON.parse(targetMetrics as string) : {};
    const parsedConstraints = constraints ? JSON.parse(constraints as string) : {};
    
    const suggestions = await optimizationEngine.generateOptimizationSuggestions(
      originalPrompt as string,
      parsedTargetMetrics,
      parsedConstraints
    );
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Optimization suggestions error:', error);
    res.status(500).json({
      error: 'Failed to generate optimization suggestions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/suggestions
 * Generate optimization suggestions with POST data
 */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const { originalPrompt, targetMetrics, constraints } = req.body;
    
    if (!originalPrompt) {
      return res.status(400).json({
        error: 'Missing required field: originalPrompt'
      });
    }
    
    const suggestions = await optimizationEngine.generateOptimizationSuggestions(
      originalPrompt,
      targetMetrics || {},
      constraints || {}
    );
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Optimization suggestions error:', error);
    res.status(500).json({
      error: 'Failed to generate optimization suggestions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/ab-test
 * Create and start an A/B test for prompt variations
 */
router.post('/ab-test', async (req: Request, res: Response) => {
  try {
    const testConfig = req.body;
    
    if (!testConfig.name || !testConfig.variants || !Array.isArray(testConfig.variants)) {
      return res.status(400).json({
        error: 'Missing required fields: name, variants (array)'
      });
    }
    
    if (testConfig.variants.length < 2) {
      return res.status(400).json({
        error: 'At least 2 variants are required for A/B testing'
      });
    }
    
    const abTest = await optimizationEngine.createABTest(testConfig);
    
    res.json({
      success: true,
      data: abTest
    });
  } catch (error) {
    console.error('A/B test creation error:', error);
    res.status(500).json({
      error: 'Failed to create A/B test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/ab-test/:testId/start
 * Start an A/B test
 */
router.post('/ab-test/:testId/start', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    
    await optimizationEngine.startABTest(testId);
    
    res.json({
      success: true,
      message: `A/B test ${testId} started successfully`
    });
  } catch (error) {
    console.error('A/B test start error:', error);
    res.status(500).json({
      error: 'Failed to start A/B test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/ab-test/:testId/result
 * Record A/B test execution result
 */
router.post('/ab-test/:testId/result', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { variantId, result } = req.body;
    
    if (!variantId || !result) {
      return res.status(400).json({
        error: 'Missing required fields: variantId, result'
      });
    }
    
    await optimizationEngine.recordABTestResult(testId, variantId, result);
    
    res.json({
      success: true,
      message: 'A/B test result recorded successfully'
    });
  } catch (error) {
    console.error('A/B test result recording error:', error);
    res.status(500).json({
      error: 'Failed to record A/B test result',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/ab-test/:testId/results
 * Get A/B test results and analysis
 */
router.get('/ab-test/:testId/results', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    
    const results = await optimizationEngine.analyzeABTestResults(testId);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('A/B test results error:', error);
    res.status(500).json({
      error: 'Failed to analyze A/B test results',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/tune
 * Start automated prompt tuning
 */
router.post('/tune', async (req: Request, res: Response) => {
  try {
    const tuningConfig = req.body;
    
    if (!tuningConfig.originalPrompt || !tuningConfig.objectives) {
      return res.status(400).json({
        error: 'Missing required fields: originalPrompt, objectives'
      });
    }
    
    const tuningProcess = await optimizationEngine.startPromptTuning(tuningConfig);
    
    res.json({
      success: true,
      data: tuningProcess
    });
  } catch (error) {
    console.error('Prompt tuning error:', error);
    res.status(500).json({
      error: 'Failed to start prompt tuning',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/tune/:tuningId/progress
 * Get prompt tuning progress
 */
router.get('/tune/:tuningId/progress', async (req: Request, res: Response) => {
  try {
    const { tuningId } = req.params;
    
    const progress = await optimizationEngine.getTuningProgress(tuningId);
    
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Tuning progress error:', error);
    res.status(500).json({
      error: 'Failed to get tuning progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/validate-security
 * Validate prompt security and detect threats
 */
router.post('/validate-security', async (req: Request, res: Response) => {
  try {
    const { promptId, prompt, context } = req.body;
    
    if (!promptId || !prompt) {
      return res.status(400).json({
        error: 'Missing required fields: promptId, prompt'
      });
    }
    
    const securityAnalysis = await securityAnalyzer.analyzePromptSecurity(
      promptId,
      prompt,
      context || {}
    );
    
    res.json({
      success: true,
      data: securityAnalysis
    });
  } catch (error) {
    console.error('Security validation error:', error);
    res.status(500).json({
      error: 'Security validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/detect-injection
 * Detect prompt injection attempts
 */
router.post('/detect-injection', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: 'Missing required field: prompt'
      });
    }
    
    const injectionResult = await securityAnalyzer.detectPromptInjection(prompt);
    
    res.json({
      success: true,
      data: injectionResult
    });
  } catch (error) {
    console.error('Injection detection error:', error);
    res.status(500).json({
      error: 'Injection detection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/test-jailbreak
 * Test prompt resistance to jailbreak attempts
 */
router.post('/test-jailbreak', async (req: Request, res: Response) => {
  try {
    const { prompt, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: 'Missing required field: prompt'
      });
    }
    
    const jailbreakTests = await securityAnalyzer.testJailbreakResistance(
      prompt,
      model || 'llama3'
    );
    
    res.json({
      success: true,
      data: jailbreakTests
    });
  } catch (error) {
    console.error('Jailbreak testing error:', error);
    res.status(500).json({
      error: 'Jailbreak testing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/analyze-safety
 * Analyze content safety
 */
router.post('/analyze-safety', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        error: 'Missing required field: content'
      });
    }
    
    const safetyAnalysis = await securityAnalyzer.analyzeContentSafety(content);
    
    res.json({
      success: true,
      data: safetyAnalysis
    });
  } catch (error) {
    console.error('Safety analysis error:', error);
    res.status(500).json({
      error: 'Safety analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/validate-compliance
 * Validate prompt compliance with regulations
 */
router.post('/validate-compliance', async (req: Request, res: Response) => {
  try {
    const { prompt, regulations } = req.body;
    
    if (!prompt || !regulations || !Array.isArray(regulations)) {
      return res.status(400).json({
        error: 'Missing required fields: prompt, regulations (array)'
      });
    }
    
    const complianceResults = await securityAnalyzer.validateCompliance(
      prompt,
      regulations
    );
    
    res.json({
      success: true,
      data: complianceResults
    });
  } catch (error) {
    console.error('Compliance validation error:', error);
    res.status(500).json({
      error: 'Compliance validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/generate-secure
 * Generate security-hardened prompt
 */
router.post('/generate-secure', async (req: Request, res: Response) => {
  try {
    const { originalPrompt, securityLevel } = req.body;
    
    if (!originalPrompt) {
      return res.status(400).json({
        error: 'Missing required field: originalPrompt'
      });
    }
    
    const securePrompt = await securityAnalyzer.generateSecurePrompt(
      originalPrompt,
      securityLevel || 'enhanced'
    );
    
    res.json({
      success: true,
      data: securePrompt
    });
  } catch (error) {
    console.error('Secure prompt generation error:', error);
    res.status(500).json({
      error: 'Secure prompt generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/evolution/:promptId
 * Get prompt evolution history
 */
router.get('/evolution/:promptId', async (req: Request, res: Response) => {
  try {
    const { promptId } = req.params;
    
    const evolution = await promptAnalyzer.getPromptEvolution(promptId);
    
    res.json({
      success: true,
      data: evolution
    });
  } catch (error) {
    console.error('Prompt evolution error:', error);
    res.status(500).json({
      error: 'Failed to get prompt evolution',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/cache/stats
 * Get comprehensive cache statistics and performance metrics
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const engineStats = optimizationEngine.getCacheStats();
    const advancedStats = optimizationEngine.getAdvancedCacheStats();
    const standaloneCacheStats = advancedKVCache.getMetrics();

    res.json({
      success: true,
      data: {
        optimizationEngine: engineStats,
        advancedMetrics: advancedStats,
        standaloneCacheMetrics: standaloneCacheStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve cache statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/cache/memory-pressure
 * Get current memory pressure status and recommendations
 */
router.get('/cache/memory-pressure', async (req: Request, res: Response) => {
  try {
    const enginePressure = optimizationEngine.getAdvancedCacheStats();
    const standalonePressure = advancedKVCache.getMemoryPressure();

    res.json({
      success: true,
      data: {
        optimizationEngine: {
          analysis: enginePressure.analysis.memoryPressure,
          suggestions: enginePressure.suggestions.memoryPressure
        },
        standalone: standalonePressure,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Memory pressure check error:', error);
    res.status(500).json({
      error: 'Failed to check memory pressure',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/cache/optimize
 * Force cache memory optimization
 */
router.post('/cache/optimize', async (req: Request, res: Response) => {
  try {
    const engineOptimization = await optimizationEngine.optimizeCacheMemory();
    const standaloneOptimization = await advancedKVCache.optimizeMemory();

    res.json({
      success: true,
      data: {
        optimizationEngine: engineOptimization,
        standalone: standaloneOptimization,
        message: 'Cache memory optimization completed successfully',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Cache optimization error:', error);
    res.status(500).json({
      error: 'Cache optimization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/cache/alerts
 * Get active cache performance alerts
 */
router.get('/cache/alerts', async (req: Request, res: Response) => {
  try {
    const engineAlerts = optimizationEngine.getAdvancedCacheStats();
    const standaloneAlerts = advancedKVCache.getAlerts();

    res.json({
      success: true,
      data: {
        optimizationEngine: {
          analysis: engineAlerts.analysis.alerts,
          suggestions: engineAlerts.suggestions.alerts
        },
        standalone: standaloneAlerts,
        totalActiveAlerts: 
          engineAlerts.analysis.alerts.length + 
          engineAlerts.suggestions.alerts.length + 
          standaloneAlerts.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Cache alerts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve cache alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/cache/export
 * Export comprehensive cache statistics for monitoring and analysis
 */
router.get('/cache/export', async (req: Request, res: Response) => {
  try {
    const engineExport = optimizationEngine.exportCacheStatistics();
    const standaloneExport = advancedKVCache.exportStatistics();

    const comprehensiveReport = {
      exportTimestamp: new Date().toISOString(),
      optimizationEngine: JSON.parse(engineExport),
      standaloneCache: JSON.parse(standaloneExport),
      summary: {
        totalCaches: 3, // analysis, suggestions, standalone
        totalMemoryUsage: 0, // Will be calculated
        totalHitRate: 0, // Will be calculated
        totalCompressionRatio: 0, // Will be calculated
        recommendedActions: []
      }
    };

    // Calculate summary metrics
    const engineStats = optimizationEngine.getCacheStats();
    const standaloneStats = advancedKVCache.getMetrics();

    comprehensiveReport.summary.totalMemoryUsage = 
      engineStats.analysis.memoryUsage + 
      engineStats.suggestions.memoryUsage + 
      standaloneStats.memoryUsage;

    comprehensiveReport.summary.totalHitRate = 
      (engineStats.analysis.hitRate + 
       engineStats.suggestions.hitRate + 
       standaloneStats.hitRate) / 3;

    comprehensiveReport.summary.totalCompressionRatio = 
      (engineStats.analysis.compressionRatio + 
       engineStats.suggestions.compressionRatio + 
       standaloneStats.compressionRatio) / 3;

    // Add recommendations based on metrics
    if (comprehensiveReport.summary.totalHitRate < 0.8) {
      comprehensiveReport.summary.recommendedActions.push('Consider increasing cache size or TTL');
    }
    if (comprehensiveReport.summary.totalMemoryUsage > 500 * 1024 * 1024) { // 500MB
      comprehensiveReport.summary.recommendedActions.push('Consider enabling more aggressive quantization');
    }
    if (comprehensiveReport.summary.totalCompressionRatio < 1.5) {
      comprehensiveReport.summary.recommendedActions.push('Enable quantization for better memory efficiency');
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cache-report-${Date.now()}.json"`);
    res.json({
      success: true,
      data: comprehensiveReport
    });
  } catch (error) {
    console.error('Cache export error:', error);
    res.status(500).json({
      error: 'Failed to export cache statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/cache/config
 * Update cache configuration
 */
router.post('/cache/config', async (req: Request, res: Response) => {
  try {
    const { cacheType, configuration } = req.body;

    if (!cacheType || !configuration) {
      return res.status(400).json({
        error: 'Missing required fields: cacheType, configuration'
      });
    }

    if (cacheType === 'standalone') {
      advancedKVCache.updateConfiguration(configuration);
    } else {
      return res.status(400).json({
        error: 'Invalid cache type. Supported types: standalone'
      });
    }

    res.json({
      success: true,
      message: `${cacheType} cache configuration updated successfully`,
      newConfiguration: advancedKVCache.getConfiguration(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache configuration error:', error);
    res.status(500).json({
      error: 'Failed to update cache configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/optimization/cache/clear
 * Clear all cache entries
 */
router.delete('/cache/clear', async (req: Request, res: Response) => {
  try {
    const { cacheType } = req.query;

    if (cacheType === 'all' || !cacheType) {
      optimizationEngine.clearCaches();
      advancedKVCache.clear();
    } else if (cacheType === 'optimization') {
      optimizationEngine.clearCaches();
    } else if (cacheType === 'standalone') {
      advancedKVCache.clear();
    } else {
      return res.status(400).json({
        error: 'Invalid cache type. Supported types: all, optimization, standalone'
      });
    }

    res.json({
      success: true,
      message: `${cacheType || 'all'} cache(s) cleared successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/cache/predictions/:key
 * Get ML-based cache hit prediction for a specific key
 */
router.get('/cache/predictions/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({
        error: 'Missing required parameter: key'
      });
    }

    const prediction = advancedKVCache.predictHit(key);
    
    res.json({
      success: true,
      data: {
        key,
        hitProbability: prediction,
        confidence: prediction > 0.7 ? 'high' : prediction > 0.4 ? 'medium' : 'low',
        recommendation: prediction > 0.7 ? 'likely hit' : prediction > 0.4 ? 'uncertain' : 'likely miss',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Cache prediction error:', error);
    res.status(500).json({
      error: 'Failed to get cache prediction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/health
 * Health check for optimization services including advanced cache
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const cacheMetrics = advancedKVCache.getMetrics();
    const cacheMemoryPressure = advancedKVCache.getMemoryPressure();
    
    res.json({
      success: true,
      message: 'AI-powered prompt optimization services are running',
      services: {
        promptAnalyzer: 'active',
        optimizationEngine: 'active',
        securityAnalyzer: 'active',
        advancedKVCache: 'active'
      },
      cacheHealth: {
        hitRate: cacheMetrics.hitRate,
        memoryPressure: cacheMemoryPressure.level,
        compressionRatio: cacheMetrics.compressionRatio,
        alertsActive: advancedKVCache.getAlerts().length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;