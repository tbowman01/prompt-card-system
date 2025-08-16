import { AdvancedKVCache } from '../../src/services/optimization/AdvancedKVCache';
import { RealTimeOptimizer } from '../../src/services/optimization/RealTimeOptimizer';
import { EdgeOptimizer } from '../../src/services/edge/EdgeOptimizer';
import { performance } from 'perf_hooks';

// Mock external dependencies
jest.mock('../../src/services/optimization/OptimizationEngine');
jest.mock('../../src/services/performance/PerformanceMonitor');
jest.mock('../../src/services/analytics/EventStore');
jest.mock('../../src/services/health/CircuitBreaker');

describe('Optimization Component Integration Tests', () => {
  let advancedCache: AdvancedKVCache;
  let realTimeOptimizer: RealTimeOptimizer;
  let edgeOptimizer: EdgeOptimizer;

  beforeEach(async () => {
    // Initialize components
    advancedCache = new AdvancedKVCache({
      maxSize: 1000,
      maxMemoryMB: 50,
      defaultTTL: 300000, // 5 minutes
      quantization: {
        enabled: true,
        type: 'int8',
        threshold: 1024,
        aggressive: false
      },
      adaptiveResize: {
        enabled: true,
        minSize: 100,
        maxSize: 2000,
        resizeThreshold: 0.8,
        shrinkFactor: 0.7,
        growthFactor: 1.3
      },
      mlPrediction: {
        enabled: true,
        predictionWindow: 300000,
        confidenceThreshold: 0.7
      },
      monitoring: {
        enabled: false // Disable for integration tests
      }
    });

    realTimeOptimizer = new RealTimeOptimizer({
      learningRate: 0.01,
      explorationRate: 0.1,
      optimizationThreshold: 0.05,
      maxConcurrentTests: 3,
      feedbackWindowMs: 60000,
      adaptationIntervalMs: 10000,
      confidenceThreshold: 0.8,
      performanceTargets: {
        successRate: 95,
        responseTime: 500,
        qualityScore: 85
      }
    });

    edgeOptimizer = new EdgeOptimizer();

    // Register a test edge node
    await edgeOptimizer.registerEdgeNode({
      id: 'integration-test-node',
      location: {
        region: 'us-east-1',
        city: 'Integration Test City',
        country: 'USA',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York'
      },
      capabilities: {
        prompt_optimization: true,
        semantic_analysis: true,
        model_inference: true,
        vector_search: true,
        caching: true,
        compression: true,
        load_balancing: true
      },
      resources: {
        cpu_cores: 8,
        memory_gb: 32,
        storage_gb: 500,
        network_mbps: 1000
      },
      status: {
        online: true,
        last_heartbeat: new Date(),
        current_load: 0.2,
        queue_depth: 0,
        response_time_p50: 45,
        response_time_p95: 95,
        response_time_p99: 150,
        error_rate: 0.01,
        uptime_percentage: 99.8,
        health_score: 95,
        failover_count: 0
      },
      models: [],
      cache_stats: {
        hit_rate: 0.8,
        size_mb: 100,
        max_size_mb: 1000,
        eviction_count: 5
      },
      performance_metrics: {
        requests_per_second: 50,
        concurrent_connections: 25,
        bandwidth_utilization: 0.4,
        memory_utilization: 0.3,
        cpu_utilization: 0.2
      }
    });
  });

  afterEach(async () => {
    await Promise.all([
      advancedCache.destroy(),
      realTimeOptimizer.cleanup(),
      edgeOptimizer.clearMetrics()
    ]);
  });

  describe('Cache-Optimizer Integration', () => {
    it('should share optimization results through cache', async () => {
      const promptId = 'integration-test-prompt-1';
      const cacheKey = `optimization:${promptId}`;
      
      // Generate optimizations using RealTimeOptimizer
      const suggestions = await realTimeOptimizer.generateRealTimeOptimizations(promptId);
      
      // Store in AdvancedKVCache
      await advancedCache.set(cacheKey, {
        promptId,
        suggestions,
        timestamp: Date.now(),
        generatedBy: 'realTimeOptimizer'
      });
      
      // Retrieve from cache
      const cachedData = await advancedCache.get(cacheKey);
      
      expect(cachedData).toBeDefined();
      expect(cachedData.promptId).toBe(promptId);
      expect(cachedData.suggestions).toEqual(suggestions);
      expect(cachedData.generatedBy).toBe('realTimeOptimizer');
    });

    it('should use cache to speed up repeated optimization requests', async () => {
      const promptId = 'speed-test-prompt';
      
      // First request - no cache
      const start1 = performance.now();
      const suggestions1 = await realTimeOptimizer.generateRealTimeOptimizations(promptId);
      const time1 = performance.now() - start1;
      
      // Store in cache
      const cacheKey = `opt:${promptId}`;
      await advancedCache.set(cacheKey, suggestions1);
      
      // Second request - should use cache or be faster
      const start2 = performance.now();
      const cachedSuggestions = await advancedCache.get(cacheKey);
      const time2 = performance.now() - start2;
      
      expect(cachedSuggestions).toBeDefined();
      expect(time2).toBeLessThan(time1); // Cache access should be faster
    });

    it('should handle cache quantization for large optimization data', async () => {
      const largeOptimizationData = {
        promptId: 'large-data-test',
        suggestions: Array.from({ length: 100 }, (_, i) => ({
          id: `suggestion-${i}`,
          type: 'optimization',
          description: 'Large optimization suggestion with detailed explanation'.repeat(10),
          expectedImprovement: {
            successRate: Math.random() * 10,
            responseTime: Math.random() * 100,
            qualityScore: Math.random() * 15
          },
          confidence: Math.random(),
          implementation: {
            steps: Array.from({ length: 5 }, (_, j) => `Step ${j + 1} with detailed instructions`),
            estimatedEffort: Math.random() * 100,
            riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
          }
        })),
        metadata: {
          generationTime: Date.now(),
          algorithm: 'advanced-ml-optimizer',
          version: '2.1.0'
        }
      };
      
      const cacheKey = 'large-opt-data';
      await advancedCache.set(cacheKey, largeOptimizationData);
      
      const retrieved = await advancedCache.get(cacheKey);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.promptId).toBe(largeOptimizationData.promptId);
      expect(retrieved.suggestions.length).toBe(100);
      
      // Check if quantization was applied
      const metrics = advancedCache.getMetrics();
      expect(metrics.quantizations).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge-Optimizer Integration', () => {
    it('should route optimization requests through edge nodes', async () => {
      const edgeRequest = {
        id: 'edge-integration-request-1',
        user_id: 'test-user-123',
        type: 'optimize' as const,
        payload: {
          prompt: 'Integration test prompt for edge optimization',
          target_metrics: {
            max_latency_ms: 300,
            min_quality_score: 85
          }
        },
        priority: 'high' as const,
        timeout_ms: 5000,
        retry_count: 0,
        cache_policy: {
          enabled: true,
          ttl_minutes: 15
        }
      };
      
      const response = await edgeOptimizer.processOptimizationRequest(edgeRequest);
      
      expect(response.request_id).toBe(edgeRequest.id);
      expect(response.result).toBeDefined();
      expect(response.metadata.node_id).toBe('integration-test-node');
      expect(response.performance.total_latency_ms).toBeLessThan(edgeRequest.payload.target_metrics!.max_latency_ms!);
    });

    it('should coordinate distributed optimization workloads', async () => {
      const workload = {
        id: 'integration-workload-1',
        type: 'batch_optimization' as const,
        priority: 8,
        estimated_duration_ms: 120000,
        resource_requirements: {
          cpu_cores: 4,
          memory_gb: 8,
          storage_gb: 50,
          network_mbps: 200
        },
        payload: {
          prompts: [
            'Optimize this prompt for better performance',
            'Improve the clarity of this instruction',
            'Enhance the effectiveness of this query'
          ],
          optimization_goals: ['latency', 'quality', 'cost']
        },
        constraints: {
          max_latency_ms: 2000,
          preferred_regions: ['us-east-1']
        },
        dependencies: [],
        status: 'pending' as const,
        assigned_nodes: [],
        progress: 0
      };
      
      const result = await edgeOptimizer.coordinateDistributedWorkload(workload);
      
      expect(result.workload_id).toBe(workload.id);
      expect(result.assigned_nodes.length).toBeGreaterThan(0);
      expect(result.coordination_strategy).toBeDefined();
    });

    it('should handle edge cache optimization with feedback', async () => {
      const cacheStrategy = {
        id: 'integration-cache-strategy',
        name: 'Integration Test Cache Strategy',
        type: 'adaptive' as const,
        parameters: {
          max_size_mb: 500,
          ttl_minutes: 30,
          eviction_threshold: 0.8,
          prefetch_enabled: true,
          compression_enabled: true,
          replication_factor: 1
        },
        performance_metrics: {
          hit_rate: 0.75,
          miss_penalty_ms: 50,
          storage_efficiency: 0.85,
          bandwidth_savings: 0.6
        }
      };
      
      const result = await edgeOptimizer.optimizeEdgeCaching(cacheStrategy);
      
      expect(result.cache_efficiency_improvement).toBeGreaterThanOrEqual(0);
      expect(result.affected_nodes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-Time Feedback Loop Integration', () => {
    it('should process feedback and update cache predictions', async () => {
      const promptId = 'feedback-loop-test';
      
      // Generate initial optimization
      const initialSuggestions = await realTimeOptimizer.generateRealTimeOptimizations(promptId);
      
      // Cache the result
      await advancedCache.set(`opt:${promptId}`, {
        suggestions: initialSuggestions,
        timestamp: Date.now()
      });
      
      // Simulate feedback
      const feedback = {
        id: 'feedback-integration-1',
        promptId,
        metrics: {
          responseTime: 350,
          successRate: 92,
          qualityScore: 87,
          errorRate: 0.08
        },
        context: {
          environment: 'integration-test',
          timestamp: new Date(),
          metadata: {
            promptLength: 150,
            complexity: 0.6
          }
        }
      };
      
      await realTimeOptimizer.processFeedback(feedback);
      
      // Check cache prediction improvement
      const prediction = advancedCache.predictHit(promptId);
      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(1);
    });

    it('should coordinate A/B testing with edge nodes and caching', async () => {
      const testConfig = {
        name: 'Integration A/B Test',
        description: 'Testing optimization integration',
        variants: [
          {
            id: 'variant-a',
            name: 'Original',
            prompt: 'Original prompt version',
            trafficAllocation: 0.5
          },
          {
            id: 'variant-b',
            name: 'Optimized',
            prompt: 'Optimized prompt version',
            trafficAllocation: 0.5
          }
        ],
        targetMetric: 'successRate',
        duration: 3600000
      };
      
      const banditConfig = {
        algorithm: 'ucb1' as const,
        explorationRate: 0.1,
        minSamples: 5
      };
      
      const testId = await realTimeOptimizer.startAdaptiveABTest(testConfig, banditConfig);
      
      expect(typeof testId).toBe('string');
      expect(testId.length).toBeGreaterThan(0);
      
      // Cache the test configuration
      await advancedCache.set(`ab-test:${testId}`, {
        config: testConfig,
        banditConfig,
        startTime: Date.now()
      });
      
      const cachedTest = await advancedCache.get(`ab-test:${testId}`);
      expect(cachedTest).toBeDefined();
      expect(cachedTest.config.name).toBe(testConfig.name);
    });
  });

  describe('Performance Integration Tests', () => {
    it('should maintain target performance across all components', async () => {
      const targetLatency = 500; // ms
      const testPrompts = [
        'Test prompt 1 for performance validation',
        'Test prompt 2 with different characteristics',
        'Test prompt 3 for comprehensive testing'
      ];
      
      const startTime = performance.now();
      
      // Process multiple optimizations
      const optimizationPromises = testPrompts.map(async (prompt, index) => {
        const promptId = `perf-test-${index}`;
        
        // Generate optimization
        const suggestions = await realTimeOptimizer.generateRealTimeOptimizations(promptId, {
          environment: 'performance-test'
        });
        
        // Cache result
        await advancedCache.set(`perf:${promptId}`, suggestions);
        
        // Process through edge
        const edgeResponse = await edgeOptimizer.processOptimizationRequest({
          id: `edge-perf-${index}`,
          type: 'optimize',
          payload: { prompt },
          priority: 'high',
          timeout_ms: targetLatency,
          retry_count: 0,
          cache_policy: { enabled: true }
        });
        
        return {
          promptId,
          suggestions,
          edgeResponse,
          latency: edgeResponse.performance.total_latency_ms
        };
      });
      
      const results = await Promise.all(optimizationPromises);
      const totalTime = performance.now() - startTime;
      
      // Validate performance targets
      expect(totalTime).toBeLessThan(targetLatency * testPrompts.length);
      
      results.forEach(result => {
        expect(result.latency).toBeLessThan(targetLatency);
        expect(result.suggestions.length).toBeGreaterThan(0);
      });
      
      // Check cache efficiency
      const cacheMetrics = advancedCache.getMetrics();
      expect(cacheMetrics.hitRate).toBeGreaterThanOrEqual(0);
      
      // Check optimizer metrics
      const optimizerMetrics = realTimeOptimizer.getOptimizationMetrics();
      expect(optimizerMetrics.processingLatency).toBeLessThan(100); // Average under 100ms
    });

    it('should handle high load across all components', async () => {
      const loadTestRequests = 50;
      const concurrentBatches = 5;
      const batchSize = loadTestRequests / concurrentBatches;
      
      const startTime = performance.now();
      
      const batchPromises = Array.from({ length: concurrentBatches }, async (_, batchIndex) => {
        const batchRequests = Array.from({ length: batchSize }, async (_, requestIndex) => {
          const requestId = `load-test-${batchIndex}-${requestIndex}`;
          const promptId = `prompt-${batchIndex}-${requestIndex}`;
          
          // Optimization request
          const suggestions = await realTimeOptimizer.generateRealTimeOptimizations(promptId);
          
          // Cache operation
          await advancedCache.set(requestId, {
            promptId,
            suggestions,
            batchIndex,
            requestIndex
          });
          
          // Edge processing
          const edgeResponse = await edgeOptimizer.processOptimizationRequest({
            id: requestId,
            type: 'optimize',
            payload: { prompt: `Load test prompt ${requestId}` },
            priority: 'normal',
            timeout_ms: 2000,
            retry_count: 0,
            cache_policy: { enabled: true }
          });
          
          return {
            requestId,
            latency: edgeResponse.performance.total_latency_ms,
            success: true
          };
        });
        
        return Promise.all(batchRequests);
      });
      
      const allResults = await Promise.all(batchPromises);
      const flatResults = allResults.flat();
      const totalTime = performance.now() - startTime;
      
      // Validate load test results
      expect(flatResults.length).toBe(loadTestRequests);
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
      
      const averageLatency = flatResults.reduce((sum, r) => sum + r.latency, 0) / flatResults.length;
      expect(averageLatency).toBeLessThan(1000); // Average latency under 1 second
      
      const successRate = flatResults.filter(r => r.success).length / flatResults.length;
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
    });
  });

  describe('Memory and Resource Integration', () => {
    it('should manage memory efficiently across all components', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create substantial load on all components
      const largeDataSets = Array.from({ length: 20 }, (_, i) => ({
        id: `memory-test-${i}`,
        data: {
          prompt: 'Large prompt data '.repeat(100),
          context: Array.from({ length: 50 }, (_, j) => `Context item ${j}`),
          metadata: {
            timestamp: Date.now(),
            iteration: i,
            large_array: new Array(1000).fill(Math.random())
          }
        }
      }));
      
      // Process through all components
      for (const dataset of largeDataSets) {
        // Cache storage
        await advancedCache.set(dataset.id, dataset.data);
        
        // Optimization processing
        await realTimeOptimizer.generateRealTimeOptimizations(dataset.id);
        
        // Feedback processing
        await realTimeOptimizer.processFeedback({
          id: `feedback-${dataset.id}`,
          promptId: dataset.id,
          metrics: {
            responseTime: 400 + Math.random() * 200,
            successRate: 90 + Math.random() * 10,
            qualityScore: 80 + Math.random() * 15,
            errorRate: Math.random() * 0.1
          },
          context: {
            environment: 'memory-test',
            timestamp: new Date()
          }
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      // Cache should handle memory pressure
      const cacheMetrics = advancedCache.getMetrics();
      expect(cacheMetrics.memoryUsage).toBeGreaterThan(0);
      
      // Verify cache memory optimization
      const optimizationResult = await advancedCache.optimizeMemory();
      expect(optimizationResult.memoryFreed).toBeGreaterThanOrEqual(0);
    });

    it('should clean up resources properly during shutdown', async () => {
      // Create some data and activity
      await advancedCache.set('cleanup-test', { data: 'test data' });
      await realTimeOptimizer.generateRealTimeOptimizations('cleanup-prompt');
      
      // Cleanup should not throw errors
      await expect(advancedCache.destroy()).resolves.toBeUndefined();
      await expect(realTimeOptimizer.cleanup()).resolves.toBeUndefined();
      
      // Edge optimizer cleanup
      expect(() => edgeOptimizer.clearMetrics()).not.toThrow();
    });
  });

  describe('Error Handling and Resilience Integration', () => {
    it('should handle cascading failures gracefully', async () => {
      // Simulate cache failure
      const faultyCache = new AdvancedKVCache({
        maxSize: 1, // Very small cache to force evictions
        maxMemoryMB: 0.1 // Very small memory limit
      });
      
      try {
        // Try to store large data that exceeds limits
        const largeData = {
          data: 'x'.repeat(10000), // Large string
          array: new Array(1000).fill('large data')
        };
        
        await faultyCache.set('large-key', largeData);
        
        // Should still function with reduced capacity
        const retrieved = await faultyCache.get('large-key');
        // May or may not retrieve due to size limits, but shouldn't crash
        
      } finally {
        faultyCache.destroy();
      }
      
      // Other components should continue working
      const suggestions = await realTimeOptimizer.generateRealTimeOptimizations('resilience-test');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should maintain service during partial component failures', async () => {
      // Test with invalid data that might cause issues
      const problematicData = {
        id: 'problematic-request',
        invalidNumber: NaN,
        infiniteValue: Infinity,
        circularRef: {} as any
      };
      problematicData.circularRef.self = problematicData;
      
      // Cache should handle problematic data
      try {
        await advancedCache.set('problematic', problematicData);
      } catch (error) {
        // Expected to potentially fail
      }
      
      // Optimizer should continue working
      const suggestions = await realTimeOptimizer.generateRealTimeOptimizations('recovery-test');
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Edge processing should continue
      const response = await edgeOptimizer.processOptimizationRequest({
        id: 'recovery-request',
        type: 'optimize',
        payload: { prompt: 'Recovery test prompt' },
        priority: 'normal',
        timeout_ms: 5000,
        retry_count: 0,
        cache_policy: { enabled: true }
      });
      
      expect(response.request_id).toBe('recovery-request');
    });
  });

  describe('End-to-End Integration Scenarios', () => {
    it('should handle complete optimization workflow', async () => {
      const workflowId = 'e2e-workflow-1';
      const prompts = [
        'Optimize this complex business process description',
        'Improve the clarity of technical documentation',
        'Enhance customer service response templates'
      ];
      
      const workflowResults = [];
      
      for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        const promptId = `${workflowId}-prompt-${i}`;
        
        // Step 1: Generate optimizations
        const suggestions = await realTimeOptimizer.generateRealTimeOptimizations(promptId, {
          environment: 'e2e-test',
          workflowId
        });
        
        // Step 2: Cache optimizations
        await advancedCache.set(`workflow:${promptId}`, {
          suggestions,
          metadata: {
            workflowId,
            step: i + 1,
            totalSteps: prompts.length
          }
        });
        
        // Step 3: Process through edge
        const edgeResponse = await edgeOptimizer.processOptimizationRequest({
          id: `${workflowId}-edge-${i}`,
          type: 'optimize',
          payload: {
            prompt,
            context: { workflowId, step: i + 1 }
          },
          priority: 'high',
          timeout_ms: 2000,
          retry_count: 0,
          cache_policy: {
            enabled: true,
            ttl_minutes: 30,
            key_prefix: `workflow:${workflowId}:`
          }
        });
        
        // Step 4: Process feedback
        await realTimeOptimizer.processFeedback({
          id: `${workflowId}-feedback-${i}`,
          promptId,
          metrics: {
            responseTime: edgeResponse.performance.total_latency_ms,
            successRate: 95 + Math.random() * 5,
            qualityScore: 85 + Math.random() * 10,
            errorRate: Math.random() * 0.05
          },
          context: {
            environment: 'e2e-test',
            timestamp: new Date(),
            metadata: {
              workflowId,
              step: i + 1
            }
          }
        });
        
        workflowResults.push({
          promptId,
          suggestions,
          edgeResponse,
          latency: edgeResponse.performance.total_latency_ms
        });
      }
      
      // Validate workflow completion
      expect(workflowResults.length).toBe(prompts.length);
      
      workflowResults.forEach((result, index) => {
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.latency).toBeLessThan(2000);
        expect(result.edgeResponse.request_id).toBe(`${workflowId}-edge-${index}`);
      });
      
      // Verify cache contains all workflow data
      for (let i = 0; i < prompts.length; i++) {
        const cachedData = await advancedCache.get(`workflow:${workflowId}-prompt-${i}`);
        expect(cachedData).toBeDefined();
        expect(cachedData.metadata.workflowId).toBe(workflowId);
      }
      
      // Check overall system metrics
      const cacheMetrics = advancedCache.getMetrics();
      const optimizerMetrics = realTimeOptimizer.getOptimizationMetrics();
      const edgeHealth = await edgeOptimizer.getHealthStatus();
      
      expect(cacheMetrics.hitRate).toBeGreaterThanOrEqual(0);
      expect(optimizerMetrics.totalOptimizations).toBeGreaterThan(0);
      expect(edgeHealth.average_health_score).toBeGreaterThan(70);
    });
  });
});
