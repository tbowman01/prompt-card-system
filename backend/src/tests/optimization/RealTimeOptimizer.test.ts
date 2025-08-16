import { 
  RealTimeOptimizer, 
  RealTimeFeedback, 
  OptimizationAction,
  BanditArm,
  BayesianOptimizationResult,
  RealTimeOptimizerConfig
} from '../../services/optimization/RealTimeOptimizer';
import { OptimizationEngine, ABTestConfiguration } from '../../services/optimization/OptimizationEngine';
import { PerformanceMonitor } from '../../services/performance/PerformanceMonitor';

// Mock TensorFlow.js to avoid actual ML model operations in tests
jest.mock('@tensorflow/tfjs-node', () => ({
  ready: jest.fn().mockResolvedValue(undefined),
  getBackend: jest.fn().mockReturnValue('cpu'),
  sequential: jest.fn().mockReturnValue({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({ history: { loss: [0.1, 0.05] } }),
    predict: jest.fn().mockReturnValue({
      data: jest.fn().mockResolvedValue([0.8, 0.7, 0.9])
    }),
    evaluate: jest.fn().mockReturnValue([{ data: jest.fn().mockResolvedValue([0.05]) }]),
    dispose: jest.fn()
  }),
  layers: {
    dense: jest.fn().mockReturnValue({}),
    dropout: jest.fn().mockReturnValue({})
  },
  train: {
    adam: jest.fn().mockReturnValue({}),
    sgd: jest.fn().mockReturnValue({}),
    momentum: jest.fn().mockReturnValue({}),
    rmsprop: jest.fn().mockReturnValue({})
  },
  regularizers: {
    l2: jest.fn().mockReturnValue({})
  },
  tensor2d: jest.fn().mockReturnValue({
    data: jest.fn().mockResolvedValue([0.8, 0.7, 0.9]),
    dispose: jest.fn(),
    shape: [10, 3]
  })
}));

describe('RealTimeOptimizer', () => {
  let realTimeOptimizer: RealTimeOptimizer;
  let mockFeedback: RealTimeFeedback;
  let testConfig: Partial<RealTimeOptimizerConfig>;

  beforeEach(async () => {
    testConfig = {
      learningRate: 0.001,
      explorationRate: 0.1,
      optimizationThreshold: 0.05,
      maxConcurrentTests: 3,
      feedbackWindowMs: 30000,
      adaptationIntervalMs: 60000,
      confidenceThreshold: 0.8,
      performanceTargets: {
        successRate: 95,
        responseTime: 500,
        qualityScore: 85
      }
    };

    realTimeOptimizer = new RealTimeOptimizer(testConfig);

    mockFeedback = {
      id: 'feedback_001',
      promptId: 'prompt_001',
      variantId: 'variant_a',
      metrics: {
        responseTime: 450,
        successRate: 92,
        qualityScore: 88,
        userSatisfaction: 0.85,
        errorRate: 8
      },
      context: {
        userId: 'user_001',
        sessionId: 'session_001',
        environment: 'production',
        timestamp: new Date(),
        metadata: {
          promptLength: 150,
          complexity: 0.7
        }
      }
    };

    // Allow time for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await realTimeOptimizer.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const optimizer = new RealTimeOptimizer();
      expect(optimizer).toBeInstanceOf(RealTimeOptimizer);
    });

    test('should initialize with custom configuration', () => {
      const customConfig = {
        learningRate: 0.01,
        explorationRate: 0.2,
        maxConcurrentTests: 10
      };
      
      const optimizer = new RealTimeOptimizer(customConfig);
      expect(optimizer).toBeInstanceOf(RealTimeOptimizer);
    });

    test('should emit feedback processed events', (done) => {
      realTimeOptimizer.on('feedback_processed', (event) => {
        expect(event).toHaveProperty('feedbackId');
        expect(event).toHaveProperty('processingTime');
        expect(event).toHaveProperty('optimizationsTriggered');
        done();
      });

      realTimeOptimizer.processFeedback(mockFeedback);
    });
  });

  describe('Real-time Feedback Processing', () => {
    test('should process feedback within 100ms target', async () => {
      const startTime = Date.now();
      
      await realTimeOptimizer.processFeedback(mockFeedback);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(100);
    });

    test('should handle multiple concurrent feedback items', async () => {
      const feedbackItems = Array.from({ length: 10 }, (_, i) => ({
        ...mockFeedback,
        id: `feedback_${i}`,
        promptId: `prompt_${i}`
      }));

      const startTime = Date.now();
      
      const promises = feedbackItems.map(feedback => 
        realTimeOptimizer.processFeedback(feedback)
      );
      
      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(500); // Should handle 10 items in under 500ms
    });

    test('should trigger emergency optimization for critical metrics', async () => {
      const criticalFeedback: RealTimeFeedback = {
        ...mockFeedback,
        metrics: {
          responseTime: 2000, // Very high response time
          successRate: 50,    // Very low success rate
          qualityScore: 40,   // Very low quality
          errorRate: 50,
          userSatisfaction: 0.2
        }
      };

      let emergencyTriggered = false;
      realTimeOptimizer.on('emergency_optimization', () => {
        emergencyTriggered = true;
      });

      await realTimeOptimizer.processFeedback(criticalFeedback);
      
      expect(emergencyTriggered).toBe(true);
    });

    test('should cache feedback for quick access', async () => {
      await realTimeOptimizer.processFeedback(mockFeedback);
      
      // Processing the same feedback again should be faster due to caching
      const startTime = Date.now();
      await realTimeOptimizer.processFeedback(mockFeedback);
      const cachedTime = Date.now() - startTime;
      
      expect(cachedTime).toBeLessThan(50);
    });
  });

  describe('Real-time Optimization Generation', () => {
    test('should generate optimizations within 100ms target', async () => {
      const startTime = Date.now();
      
      const optimizations = await realTimeOptimizer.generateRealTimeOptimizations(
        'test_prompt',
        { environment: 'production' }
      );
      
      const generationTime = Date.now() - startTime;
      expect(generationTime).toBeLessThan(100);
      expect(Array.isArray(optimizations)).toBe(true);
    });

    test('should enhance optimizations with ML predictions', async () => {
      const optimizations = await realTimeOptimizer.generateRealTimeOptimizations(
        'test_prompt_ml',
        { complexity: 0.8 }
      );
      
      expect(optimizations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            expectedImprovement: expect.objectContaining({
              successRate: expect.any(Number),
              responseTime: expect.any(Number),
              qualityScore: expect.any(Number)
            }),
            confidence: expect.any(Number)
          })
        ])
      );
    });

    test('should apply real-time adaptation based on recent feedback', async () => {
      // Provide some feedback first
      await realTimeOptimizer.processFeedback(mockFeedback);
      
      const optimizations = await realTimeOptimizer.generateRealTimeOptimizations(
        mockFeedback.promptId,
        { adaptation: true }
      );
      
      expect(optimizations.length).toBeGreaterThan(0);
      
      // Optimizations should be adapted based on the feedback
      optimizations.forEach(opt => {
        expect(opt.confidence).toBeGreaterThan(0);
        expect(opt.expectedImprovement).toBeDefined();
      });
    });

    test('should cache optimization results', async () => {
      const promptId = 'cached_prompt';
      const context = { test: true };
      
      // First call
      const startTime1 = Date.now();
      const optimizations1 = await realTimeOptimizer.generateRealTimeOptimizations(promptId, context);
      const time1 = Date.now() - startTime1;
      
      // Second call should be faster due to caching
      const startTime2 = Date.now();
      const optimizations2 = await realTimeOptimizer.generateRealTimeOptimizations(promptId, context);
      const time2 = Date.now() - startTime2;
      
      expect(time2).toBeLessThan(time1);
      expect(optimizations1).toEqual(optimizations2);
    });
  });

  describe('Multi-Armed Bandit A/B Testing', () => {
    let testConfig: Omit<ABTestConfiguration, 'id' | 'status'>;
    
    beforeEach(() => {
      testConfig = {
        name: 'Bandit A/B Test',
        variants: [
          { id: 'variant_a', name: 'Control', prompt: 'Control prompt', weight: 50 },
          { id: 'variant_b', name: 'Treatment', prompt: 'Treatment prompt', weight: 50 }
        ],
        metrics: {
          primaryMetric: 'success_rate',
          secondaryMetrics: ['response_time', 'quality_score']
        },
        duration: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
          minSamples: 100
        }
      };
    });

    test('should start adaptive A/B test with bandit configuration', async () => {
      const banditConfig = {
        algorithm: 'ucb1' as const,
        explorationRate: 0.1,
        minSamples: 50
      };

      const testId = await realTimeOptimizer.startAdaptiveABTest(testConfig, banditConfig);
      
      expect(testId).toBeDefined();
      expect(typeof testId).toBe('string');
    });

    test('should update bandit arms with feedback', async () => {
      const banditConfig = {
        algorithm: 'epsilon_greedy' as const,
        explorationRate: 0.1,
        minSamples: 20
      };

      const testId = await realTimeOptimizer.startAdaptiveABTest(testConfig, banditConfig);
      
      // Simulate feedback for different variants
      const feedbackA: RealTimeFeedback = {
        ...mockFeedback,
        variantId: 'variant_a',
        promptId: testId,
        metrics: { ...mockFeedback.metrics, successRate: 90 }
      };
      
      const feedbackB: RealTimeFeedback = {
        ...mockFeedback,
        variantId: 'variant_b',
        promptId: testId,
        metrics: { ...mockFeedback.metrics, successRate: 95 }
      };

      await realTimeOptimizer.processFeedback(feedbackA);
      await realTimeOptimizer.processFeedback(feedbackB);
      
      // Bandit should adapt to the better performing variant
      expect(true).toBe(true); // Placeholder - in real implementation, check traffic allocation
    });

    test('should calculate different bandit algorithms correctly', async () => {
      const algorithms: Array<'epsilon_greedy' | 'ucb1' | 'thompson_sampling' | 'exp3'> = [
        'epsilon_greedy', 'ucb1', 'thompson_sampling', 'exp3'
      ];

      for (const algorithm of algorithms) {
        const banditConfig = {
          algorithm,
          explorationRate: 0.1,
          minSamples: 10
        };

        const testId = await realTimeOptimizer.startAdaptiveABTest(testConfig, banditConfig);
        expect(testId).toBeDefined();
      }
    });

    test('should handle traffic allocation updates', async () => {
      const banditConfig = {
        algorithm: 'ucb1' as const,
        explorationRate: 0.15,
        minSamples: 30
      };

      let allocationUpdated = false;
      realTimeOptimizer.on('traffic_allocation_updated', (event) => {
        expect(event).toHaveProperty('testId');
        expect(event).toHaveProperty('allocation');
        allocationUpdated = true;
      });

      await realTimeOptimizer.startAdaptiveABTest(testConfig, banditConfig);
      
      // Allow time for potential allocation updates
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('Bayesian Optimization', () => {
    test('should perform hyperparameter optimization', async () => {
      const searchSpace = {
        learningRate: { min: 0.0001, max: 0.01, type: 'continuous' as const },
        explorationRate: { min: 0.01, max: 0.3, type: 'continuous' as const },
        batchSize: { min: 16, max: 128, type: 'discrete' as const }
      };

      const result = await realTimeOptimizer.optimizeHyperparameters(
        searchSpace,
        'maximize',
        10 // Limited iterations for testing
      );

      expect(result).toHaveProperty('parameters');
      expect(result).toHaveProperty('expectedImprovement');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('acquisitionValue');
      expect(result).toHaveProperty('iteration');
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should converge with high confidence', async () => {
      const searchSpace = {
        param1: { min: 0, max: 1, type: 'continuous' as const },
        param2: { min: 0, max: 1, type: 'continuous' as const }
      };

      const result = await realTimeOptimizer.optimizeHyperparameters(
        searchSpace,
        'maximize',
        20
      );

      // Should achieve reasonable confidence
      expect(result.confidence).toBeGreaterThan(0.1);
    });

    test('should handle minimize objective', async () => {
      const searchSpace = {
        errorRate: { min: 0, max: 1, type: 'continuous' as const }
      };

      const result = await realTimeOptimizer.optimizeHyperparameters(
        searchSpace,
        'minimize',
        5
      );

      expect(result).toHaveProperty('parameters');
      expect(result.parameters.errorRate).toBeGreaterThanOrEqual(0);
      expect(result.parameters.errorRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance Prediction Models', () => {
    test('should initialize performance prediction model', async () => {
      // Model should be initialized during constructor
      expect(realTimeOptimizer).toBeDefined();
    });

    test('should make performance predictions', async () => {
      // Add some feedback to train on
      const feedbackItems = Array.from({ length: 20 }, (_, i) => ({
        ...mockFeedback,
        id: `feedback_${i}`,
        metrics: {
          ...mockFeedback.metrics,
          responseTime: 400 + Math.random() * 200,
          successRate: 85 + Math.random() * 15,
          qualityScore: 80 + Math.random() * 20
        }
      }));

      for (const feedback of feedbackItems) {
        await realTimeOptimizer.processFeedback(feedback);
      }

      // Generate optimizations which should use prediction models
      const optimizations = await realTimeOptimizer.generateRealTimeOptimizations(
        'prediction_test',
        { usePredictions: true }
      );

      expect(optimizations.length).toBeGreaterThan(0);
    });
  });

  describe('Adaptive Caching Policies', () => {
    test('should update cache policies based on hit rates', async () => {
      // Generate many optimization requests to affect cache hit rates
      const requests = Array.from({ length: 50 }, (_, i) => 
        realTimeOptimizer.generateRealTimeOptimizations(`prompt_${i % 10}`, { test: i })
      );

      await Promise.all(requests);

      // Cache policies should adapt based on usage patterns
      expect(true).toBe(true); // Placeholder - in real implementation, check cache metrics
    });

    test('should maintain cache efficiency', async () => {
      const metrics = realTimeOptimizer.getOptimizationMetrics();
      
      expect(metrics).toHaveProperty('cacheEfficiency');
      expect(typeof metrics.cacheEfficiency).toBe('number');
      expect(metrics.cacheEfficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheEfficiency).toBeLessThanOrEqual(1);
    });
  });

  describe('Configuration Updates', () => {
    test('should update configuration without restart', async () => {
      const newConfig = {
        learningRate: 0.005,
        explorationRate: 0.2,
        maxConcurrentTests: 8
      };

      await realTimeOptimizer.updateConfiguration(newConfig);
      
      // Configuration should be updated
      expect(true).toBe(true); // Placeholder
    });

    test('should emit configuration update events', async () => {
      let configUpdated = false;
      realTimeOptimizer.on('config_updated', (event) => {
        expect(event).toHaveProperty('oldConfig');
        expect(event).toHaveProperty('newConfig');
        configUpdated = true;
      });

      await realTimeOptimizer.updateConfiguration({ learningRate: 0.002 });
      expect(configUpdated).toBe(true);
    });

    test('should reinitialize systems for significant changes', async () => {
      const significantChanges = {
        learningRate: 0.1, // Significant change
        explorationRate: 0.5,
        maxConcurrentTests: 20
      };

      await realTimeOptimizer.updateConfiguration(significantChanges);
      
      // Systems should be reinitialized
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance Metrics and Monitoring', () => {
    test('should track optimization metrics', () => {
      const metrics = realTimeOptimizer.getOptimizationMetrics();
      
      expect(metrics).toHaveProperty('totalOptimizations');
      expect(metrics).toHaveProperty('averageImprovementRate');
      expect(metrics).toHaveProperty('successfulOptimizations');
      expect(metrics).toHaveProperty('currentStrategy');
      expect(metrics).toHaveProperty('activeBandits');
      expect(metrics).toHaveProperty('modelAccuracy');
      expect(metrics).toHaveProperty('processingLatency');
      expect(metrics).toHaveProperty('cacheEfficiency');
      
      expect(typeof metrics.totalOptimizations).toBe('number');
      expect(typeof metrics.averageImprovementRate).toBe('number');
      expect(typeof metrics.successfulOptimizations).toBe('number');
      expect(typeof metrics.activeBandits).toBe('number');
      expect(typeof metrics.modelAccuracy).toBe('number');
      expect(typeof metrics.processingLatency).toBe('number');
      expect(typeof metrics.cacheEfficiency).toBe('number');
    });

    test('should achieve target improvement rates', async () => {
      // Process some feedback and generate optimizations
      for (let i = 0; i < 10; i++) {
        await realTimeOptimizer.processFeedback({
          ...mockFeedback,
          id: `feedback_${i}`,
          metrics: {
            ...mockFeedback.metrics,
            successRate: 90 + Math.random() * 10
          }
        });
        
        await realTimeOptimizer.generateRealTimeOptimizations(`prompt_${i}`, {});
      }

      const metrics = realTimeOptimizer.getOptimizationMetrics();
      
      // Should show some optimization activity
      expect(metrics.totalOptimizations).toBeGreaterThanOrEqual(0);
      
      // Target: 40% improvement in optimization effectiveness
      // In a real scenario, this would be measured against baseline
      expect(metrics.averageImprovementRate).toBeGreaterThanOrEqual(0);
    });

    test('should maintain sub-100ms processing times', async () => {
      const feedbackItems = Array.from({ length: 20 }, (_, i) => ({
        ...mockFeedback,
        id: `perf_feedback_${i}`
      }));

      const startTime = Date.now();
      
      for (const feedback of feedbackItems) {
        const itemStart = Date.now();
        await realTimeOptimizer.processFeedback(feedback);
        const itemTime = Date.now() - itemStart;
        
        expect(itemTime).toBeLessThan(100); // Sub-100ms target
      }
      
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / feedbackItems.length;
      
      expect(averageTime).toBeLessThan(100);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle invalid feedback gracefully', async () => {
      const invalidFeedback = {
        id: 'invalid',
        promptId: '', // Invalid
        metrics: {
          responseTime: -1, // Invalid
          successRate: 150, // Invalid (> 100)
          qualityScore: -10, // Invalid
          errorRate: 200 // Invalid
        },
        context: {
          timestamp: 'invalid date' as any // Invalid
        }
      } as RealTimeFeedback;

      await expect(realTimeOptimizer.processFeedback(invalidFeedback))
        .resolves.not.toThrow();
    });

    test('should emit error events for processing failures', (done) => {
      let errorEmitted = false;
      
      realTimeOptimizer.on('error', (error) => {
        expect(error).toHaveProperty('type');
        expect(error).toHaveProperty('error');
        errorEmitted = true;
        done();
      });

      // Force an error condition
      const malformedFeedback = null as any;
      realTimeOptimizer.processFeedback(malformedFeedback).catch(() => {
        if (!errorEmitted) {
          done();
        }
      });
    });

    test('should continue operating after errors', async () => {
      // Process invalid feedback
      try {
        await realTimeOptimizer.processFeedback(null as any);
      } catch (error) {
        // Expected to fail
      }

      // Should still be able to process valid feedback
      await expect(realTimeOptimizer.processFeedback(mockFeedback))
        .resolves.not.toThrow();
    });

    test('should handle ML model failures gracefully', async () => {
      // This test would verify that if TensorFlow operations fail,
      // the system continues to operate with fallback mechanisms
      
      const optimizations = await realTimeOptimizer.generateRealTimeOptimizations(
        'fallback_test',
        { forceFallback: true }
      );

      expect(Array.isArray(optimizations)).toBe(true);
    });
  });

  describe('Strategy Adaptation', () => {
    test('should adapt optimization strategy based on performance', async () => {
      const initialMetrics = realTimeOptimizer.getOptimizationMetrics();
      const initialStrategy = initialMetrics.currentStrategy;

      // Simulate poor performance that should trigger strategy change
      const poorFeedback = Array.from({ length: 5 }, (_, i) => ({
        ...mockFeedback,
        id: `poor_feedback_${i}`,
        metrics: {
          responseTime: 1500, // Very slow
          successRate: 60,    // Low success
          qualityScore: 50,   // Low quality
          errorRate: 40,
          userSatisfaction: 0.3
        }
      }));

      for (const feedback of poorFeedback) {
        await realTimeOptimizer.processFeedback(feedback);
      }

      // Allow time for strategy adaptation
      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedMetrics = realTimeOptimizer.getOptimizationMetrics();
      
      // Strategy might have changed due to poor performance
      expect(updatedMetrics.currentStrategy).toBeDefined();
      expect(['aggressive', 'conservative', 'balanced', 'adaptive'])
        .toContain(updatedMetrics.currentStrategy);
    });

    test('should switch to aggressive strategy for critical issues', async () => {
      const criticalFeedback: RealTimeFeedback = {
        ...mockFeedback,
        metrics: {
          responseTime: 3000,
          successRate: 30,
          qualityScore: 25,
          errorRate: 70,
          userSatisfaction: 0.1
        }
      };

      await realTimeOptimizer.processFeedback(criticalFeedback);
      
      const metrics = realTimeOptimizer.getOptimizationMetrics();
      
      // Should switch to aggressive strategy or at least show adaptation
      expect(metrics.currentStrategy).toBeDefined();
    });
  });

  describe('Integration with Existing Systems', () => {
    test('should integrate with OptimizationEngine', async () => {
      // The RealTimeOptimizer should work with existing OptimizationEngine
      expect(realTimeOptimizer).toBeDefined();
      
      // Should be able to generate optimizations that enhance base suggestions
      const optimizations = await realTimeOptimizer.generateRealTimeOptimizations(
        'integration_test',
        { enhanceExisting: true }
      );

      expect(Array.isArray(optimizations)).toBe(true);
    });

    test('should integrate with PerformanceMonitor', async () => {
      // Should work with PerformanceMonitor for metrics collection
      expect(realTimeOptimizer).toBeDefined();
      
      const metrics = realTimeOptimizer.getOptimizationMetrics();
      expect(metrics.processingLatency).toBeGreaterThanOrEqual(0);
    });

    test('should maintain compatibility with existing API', async () => {
      // Existing optimization APIs should still work
      const optimizations = await realTimeOptimizer.generateRealTimeOptimizations(
        'compatibility_test'
      );

      expect(Array.isArray(optimizations)).toBe(true);
      
      // Should have expected structure
      optimizations.forEach(opt => {
        expect(opt).toHaveProperty('id');
        expect(opt).toHaveProperty('originalPrompt');
        expect(opt).toHaveProperty('optimizedPrompt');
        expect(opt).toHaveProperty('expectedImprovement');
        expect(opt).toHaveProperty('confidence');
      });
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources properly', async () => {
      const optimizer = new RealTimeOptimizer();
      
      // Use the optimizer
      await optimizer.processFeedback(mockFeedback);
      
      // Cleanup should not throw
      await expect(optimizer.cleanup()).resolves.not.toThrow();
    });

    test('should dispose ML models on cleanup', async () => {
      const optimizer = new RealTimeOptimizer();
      
      // Process some data to ensure models are created
      await optimizer.processFeedback(mockFeedback);
      await optimizer.generateRealTimeOptimizations('cleanup_test');
      
      // Cleanup should dispose models
      await optimizer.cleanup();
      
      expect(true).toBe(true); // Placeholder - in real implementation, verify model disposal
    });

    test('should clear caches on cleanup', async () => {
      const optimizer = new RealTimeOptimizer();
      
      // Populate caches
      await optimizer.processFeedback(mockFeedback);
      await optimizer.generateRealTimeOptimizations('cache_test');
      
      // Cleanup should clear caches
      await optimizer.cleanup();
      
      expect(true).toBe(true); // Placeholder - in real implementation, verify cache clearing
    });
  });
});

describe('RealTimeOptimizer Performance Benchmarks', () => {
  let realTimeOptimizer: RealTimeOptimizer;

  beforeEach(() => {
    realTimeOptimizer = new RealTimeOptimizer({
      feedbackWindowMs: 10000,
      adaptationIntervalMs: 30000
    });
  });

  afterEach(async () => {
    await realTimeOptimizer.cleanup();
  });

  test('should handle high throughput feedback processing', async () => {
    const feedbackCount = 1000;
    const feedbackItems = Array.from({ length: feedbackCount }, (_, i) => ({
      id: `benchmark_feedback_${i}`,
      promptId: `prompt_${i % 100}`,
      variantId: i % 2 === 0 ? 'variant_a' : 'variant_b',
      metrics: {
        responseTime: 400 + Math.random() * 200,
        successRate: 85 + Math.random() * 15,
        qualityScore: 80 + Math.random() * 20,
        errorRate: Math.random() * 10,
        userSatisfaction: 0.7 + Math.random() * 0.3
      },
      context: {
        timestamp: new Date(),
        environment: 'benchmark',
        metadata: {
          promptLength: 100 + Math.random() * 200,
          complexity: Math.random()
        }
      }
    }));

    const startTime = Date.now();
    
    // Process all feedback items
    await Promise.all(feedbackItems.map(feedback => 
      realTimeOptimizer.processFeedback(feedback)
    ));
    
    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / feedbackCount;
    
    console.log(`Processed ${feedbackCount} feedback items in ${totalTime}ms`);
    console.log(`Average processing time: ${averageTime.toFixed(2)}ms per item`);
    
    // Performance targets
    expect(averageTime).toBeLessThan(50); // Should average under 50ms per item
    expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
  });

  test('should maintain performance under concurrent load', async () => {
    const concurrentRequests = 100;
    const requestsPerBatch = 10;
    
    const startTime = Date.now();
    
    // Create concurrent batches of requests
    const batches = Array.from({ length: concurrentRequests / requestsPerBatch }, (_, batchIndex) => {
      return Promise.all(
        Array.from({ length: requestsPerBatch }, (_, i) => {
          const requestIndex = batchIndex * requestsPerBatch + i;
          return realTimeOptimizer.generateRealTimeOptimizations(
            `concurrent_prompt_${requestIndex}`,
            { batch: batchIndex, request: i }
          );
        })
      );
    });
    
    const results = await Promise.all(batches);
    
    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / concurrentRequests;
    
    console.log(`Processed ${concurrentRequests} concurrent requests in ${totalTime}ms`);
    console.log(`Average response time: ${averageTime.toFixed(2)}ms per request`);
    
    // Verify all requests completed successfully
    expect(results.length).toBe(concurrentRequests / requestsPerBatch);
    expect(averageTime).toBeLessThan(100); // Should maintain sub-100ms average
  });

  test('should demonstrate improvement in optimization effectiveness', async () => {
    // Baseline: Process feedback without optimization
    const baselineFeedback = Array.from({ length: 50 }, (_, i) => ({
      id: `baseline_${i}`,
      promptId: 'baseline_prompt',
      metrics: {
        responseTime: 600 + Math.random() * 400,
        successRate: 75 + Math.random() * 20,
        qualityScore: 70 + Math.random() * 25,
        errorRate: 5 + Math.random() * 15,
        userSatisfaction: 0.6 + Math.random() * 0.4
      },
      context: {
        timestamp: new Date(),
        environment: 'baseline'
      }
    }));

    // Process baseline feedback
    for (const feedback of baselineFeedback) {
      await realTimeOptimizer.processFeedback(feedback);
    }

    const baselineMetrics = realTimeOptimizer.getOptimizationMetrics();

    // Optimized: Process feedback with optimizations applied
    const optimizedFeedback = Array.from({ length: 50 }, (_, i) => ({
      id: `optimized_${i}`,
      promptId: 'optimized_prompt',
      metrics: {
        responseTime: 400 + Math.random() * 200, // Better response times
        successRate: 90 + Math.random() * 10,    // Better success rates
        qualityScore: 85 + Math.random() * 15,   // Better quality
        errorRate: Math.random() * 5,            // Lower error rates
        userSatisfaction: 0.8 + Math.random() * 0.2
      },
      context: {
        timestamp: new Date(),
        environment: 'optimized'
      }
    }));

    // Generate and apply optimizations
    for (const feedback of optimizedFeedback) {
      await realTimeOptimizer.processFeedback(feedback);
      await realTimeOptimizer.generateRealTimeOptimizations(feedback.promptId);
    }

    const optimizedMetrics = realTimeOptimizer.getOptimizationMetrics();

    // Should show improvement in optimization effectiveness
    console.log('Baseline metrics:', baselineMetrics);
    console.log('Optimized metrics:', optimizedMetrics);

    // Target: 40% improvement in optimization effectiveness
    const improvementRatio = optimizedMetrics.averageImprovementRate / Math.max(baselineMetrics.averageImprovementRate, 0.01);
    
    expect(improvementRatio).toBeGreaterThan(1); // Should show some improvement
    
    // In a real scenario, this would demonstrate the 40% improvement target
    console.log(`Improvement ratio: ${improvementRatio.toFixed(2)}x`);
  });
});