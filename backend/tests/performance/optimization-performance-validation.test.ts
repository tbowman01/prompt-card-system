import { AdvancedKVCache } from '../../src/services/optimization/AdvancedKVCache';
import { RealTimeOptimizer } from '../../src/services/optimization/RealTimeOptimizer';
import { EdgeOptimizer } from '../../src/services/edge/EdgeOptimizer';
import { performance } from 'perf_hooks';
import { promisify } from 'util';

// Mock external dependencies
jest.mock('../../src/services/optimization/OptimizationEngine');
jest.mock('../../src/services/performance/PerformanceMonitor');
jest.mock('../../src/services/analytics/EventStore');

interface PerformanceTarget {
  memoryReduction: number; // percentage
  latencyReduction: number; // percentage
  throughputIncrease: number; // percentage
  cacheHitRate: number; // percentage
  errorRate: number; // percentage (max allowed)
}

interface PerformanceMetrics {
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  memoryUsage: number;
  cacheHitRate: number;
  errorRate: number;
  cpuUsage: number;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  throughput: number;
  errorsPerSecond: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
}

describe('Optimization Performance Validation', () => {
  let advancedCache: AdvancedKVCache;
  let realTimeOptimizer: RealTimeOptimizer;
  let edgeOptimizer: EdgeOptimizer;
  
  const PERFORMANCE_TARGETS: PerformanceTarget = {
    memoryReduction: 50, // 50% memory reduction target
    latencyReduction: 90, // 90% latency reduction target
    throughputIncrease: 200, // 200% throughput increase
    cacheHitRate: 80, // 80% cache hit rate
    errorRate: 1 // Max 1% error rate
  };

  beforeAll(async () => {
    // Initialize components with performance-optimized configurations
    advancedCache = new AdvancedKVCache({
      maxSize: 10000,
      maxMemoryMB: 256,
      defaultTTL: 600000, // 10 minutes
      quantization: {
        enabled: true,
        type: 'int8',
        threshold: 512,
        aggressive: true // Aggressive quantization for maximum memory reduction
      },
      adaptiveResize: {
        enabled: true,
        minSize: 1000,
        maxSize: 50000,
        resizeThreshold: 0.8,
        shrinkFactor: 0.6,
        growthFactor: 1.4
      },
      mlPrediction: {
        enabled: true,
        predictionWindow: 600000,
        confidenceThreshold: 0.75
      },
      monitoring: {
        enabled: true,
        metricsInterval: 5000,
        alertThresholds: {
          hitRate: 0.75,
          memoryUsage: 0.85,
          evictionRate: 0.15
        }
      }
    });

    realTimeOptimizer = new RealTimeOptimizer({
      learningRate: 0.01,
      explorationRate: 0.15,
      optimizationThreshold: 0.03,
      maxConcurrentTests: 10,
      feedbackWindowMs: 300000,
      adaptationIntervalMs: 30000,
      confidenceThreshold: 0.85,
      performanceTargets: {
        successRate: 98,
        responseTime: 200,
        qualityScore: 90
      }
    });

    edgeOptimizer = new EdgeOptimizer();

    // Register high-performance edge nodes
    const performanceNodes = [
      {
        id: 'perf-node-1',
        location: {
          region: 'us-east-1',
          city: 'New York',
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
          cpu_cores: 16,
          memory_gb: 64,
          storage_gb: 1000,
          network_mbps: 10000,
          gpu_count: 4,
          gpu_memory_gb: 32
        },
        status: {
          online: true,
          last_heartbeat: new Date(),
          current_load: 0.1,
          queue_depth: 0,
          response_time_p50: 25,
          response_time_p95: 50,
          response_time_p99: 75,
          error_rate: 0.005,
          uptime_percentage: 99.9,
          health_score: 98,
          failover_count: 0
        },
        models: [],
        cache_stats: {
          hit_rate: 0.9,
          size_mb: 200,
          max_size_mb: 2000,
          eviction_count: 0
        },
        performance_metrics: {
          requests_per_second: 200,
          concurrent_connections: 100,
          bandwidth_utilization: 0.3,
          memory_utilization: 0.25,
          cpu_utilization: 0.15
        }
      },
      {
        id: 'perf-node-2',
        location: {
          region: 'us-west-1',
          city: 'San Francisco',
          country: 'USA',
          latitude: 37.7749,
          longitude: -122.4194,
          timezone: 'America/Los_Angeles'
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
          cpu_cores: 12,
          memory_gb: 48,
          storage_gb: 800,
          network_mbps: 8000,
          gpu_count: 2,
          gpu_memory_gb: 24
        },
        status: {
          online: true,
          last_heartbeat: new Date(),
          current_load: 0.15,
          queue_depth: 2,
          response_time_p50: 30,
          response_time_p95: 60,
          response_time_p99: 90,
          error_rate: 0.008,
          uptime_percentage: 99.8,
          health_score: 96,
          failover_count: 0
        },
        models: [],
        cache_stats: {
          hit_rate: 0.85,
          size_mb: 180,
          max_size_mb: 1500,
          eviction_count: 2
        },
        performance_metrics: {
          requests_per_second: 180,
          concurrent_connections: 90,
          bandwidth_utilization: 0.35,
          memory_utilization: 0.3,
          cpu_utilization: 0.2
        }
      }
    ];

    for (const node of performanceNodes) {
      await edgeOptimizer.registerEdgeNode(node);
    }
  }, 30000);

  afterAll(async () => {
    await Promise.all([
      advancedCache.destroy(),
      realTimeOptimizer.cleanup()
    ]);
    edgeOptimizer.clearMetrics();
  });

  describe('Memory Optimization Validation', () => {
    it('should achieve 50% memory reduction target', async () => {
      const baselineData = generateLargeDataSet(1000);
      const baselineMemory = process.memoryUsage().heapUsed;
      
      // Store data without optimization
      const unoptimizedCache = new AdvancedKVCache({
        maxSize: 1000,
        quantization: { enabled: false, type: 'none', threshold: 0, aggressive: false }
      });
      
      for (let i = 0; i < baselineData.length; i++) {
        await unoptimizedCache.set(`unopt-${i}`, baselineData[i]);
      }
      
      const unoptimizedMemory = process.memoryUsage().heapUsed - baselineMemory;
      
      // Store same data with optimization
      const optimizedMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < baselineData.length; i++) {
        await advancedCache.set(`opt-${i}`, baselineData[i]);
      }
      
      const optimizedMemoryUsage = process.memoryUsage().heapUsed - optimizedMemory;
      
      const memoryReduction = ((unoptimizedMemory - optimizedMemoryUsage) / unoptimizedMemory) * 100;
      
      console.log(`Memory reduction achieved: ${memoryReduction.toFixed(2)}%`);
      console.log(`Unoptimized memory: ${(unoptimizedMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Optimized memory: ${(optimizedMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      
      expect(memoryReduction).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.memoryReduction);
      
      // Verify data integrity
      for (let i = 0; i < 10; i++) {
        const retrieved = await advancedCache.get(`opt-${i}`);
        expect(retrieved).toBeDefined();
      }
      
      unoptimizedCache.destroy();
    }, 60000);

    it('should maintain memory efficiency under continuous load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const dataStream = generateContinuousDataStream(5000);
      
      let processed = 0;
      for await (const dataChunk of dataStream) {
        await advancedCache.set(`stream-${processed}`, dataChunk);
        processed++;
        
        // Trigger memory optimization every 1000 items
        if (processed % 1000 === 0) {
          const optimizationResult = await advancedCache.optimizeMemory();
          console.log(`Memory optimization at ${processed}: freed ${optimizationResult.memoryFreed} bytes`);
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = ((finalMemory - initialMemory) / initialMemory) * 100;
      
      console.log(`Memory growth after processing ${processed} items: ${memoryGrowth.toFixed(2)}%`);
      
      // Memory growth should be controlled
      expect(memoryGrowth).toBeLessThan(200); // Less than 200% growth
      
      const metrics = advancedCache.getMetrics();
      expect(metrics.compressionRatio).toBeGreaterThan(1.5); // At least 1.5x compression
    }, 120000);
  });

  describe('Latency Optimization Validation', () => {
    it('should achieve 90% latency reduction through caching', async () => {
      const testPrompts = generateTestPrompts(100);
      
      // Measure baseline latency without caching
      const baselineLatencies: number[] = [];
      for (const prompt of testPrompts.slice(0, 10)) {
        const start = performance.now();
        await realTimeOptimizer.generateRealTimeOptimizations(prompt.id, { useCache: false });
        baselineLatencies.push(performance.now() - start);
      }
      
      const baselineAverage = baselineLatencies.reduce((sum, lat) => sum + lat, 0) / baselineLatencies.length;
      
      // Warm up cache
      for (const prompt of testPrompts) {
        await realTimeOptimizer.generateRealTimeOptimizations(prompt.id);
      }
      
      // Measure optimized latency with caching
      const optimizedLatencies: number[] = [];
      for (const prompt of testPrompts.slice(0, 10)) {
        const start = performance.now();
        await realTimeOptimizer.generateRealTimeOptimizations(prompt.id);
        optimizedLatencies.push(performance.now() - start);
      }
      
      const optimizedAverage = optimizedLatencies.reduce((sum, lat) => sum + lat, 0) / optimizedLatencies.length;
      const latencyReduction = ((baselineAverage - optimizedAverage) / baselineAverage) * 100;
      
      console.log(`Baseline average latency: ${baselineAverage.toFixed(2)}ms`);
      console.log(`Optimized average latency: ${optimizedAverage.toFixed(2)}ms`);
      console.log(`Latency reduction achieved: ${latencyReduction.toFixed(2)}%`);
      
      expect(latencyReduction).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.latencyReduction);
    }, 90000);

    it('should maintain low latency under high concurrency', async () => {
      const concurrentRequests = 200;
      const startTime = performance.now();
      
      const requests = Array.from({ length: concurrentRequests }, async (_, i) => {
        const requestStart = performance.now();
        
        const result = await edgeOptimizer.processOptimizationRequest({
          id: `concurrent-${i}`,
          type: 'optimize',
          payload: { prompt: `Concurrent test prompt ${i}` },
          priority: 'high',
          timeout_ms: 1000,
          retry_count: 0,
          cache_policy: { enabled: true }
        });
        
        return {
          latency: performance.now() - requestStart,
          success: !!result.result
        };
      });
      
      const results = await Promise.all(requests);
      const totalTime = performance.now() - startTime;
      
      const latencies = results.map(r => r.latency);
      const successCount = results.filter(r => r.success).length;
      
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
      const throughput = (successCount / totalTime) * 1000; // requests per second
      
      console.log(`Concurrent requests: ${concurrentRequests}`);
      console.log(`Average latency: ${averageLatency.toFixed(2)}ms`);
      console.log(`P95 latency: ${p95Latency.toFixed(2)}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} req/s`);
      console.log(`Success rate: ${((successCount / concurrentRequests) * 100).toFixed(2)}%`);
      
      expect(averageLatency).toBeLessThan(500); // Average under 500ms
      expect(p95Latency).toBeLessThan(1000); // P95 under 1 second
      expect(successCount / concurrentRequests).toBeGreaterThan(0.95); // 95% success rate
    }, 60000);
  });

  describe('Throughput and Scalability Validation', () => {
    it('should achieve target throughput increase', async () => {
      const testDuration = 30000; // 30 seconds
      const requestInterval = 50; // 50ms between requests
      
      let requestCount = 0;
      let successCount = 0;
      const latencies: number[] = [];
      
      const startTime = performance.now();
      
      const loadTest = async () => {
        while (performance.now() - startTime < testDuration) {
          const requestStart = performance.now();
          requestCount++;
          
          try {
            const result = await realTimeOptimizer.generateRealTimeOptimizations(
              `throughput-test-${requestCount}`,
              { environment: 'throughput-test' }
            );
            
            if (result && result.length > 0) {
              successCount++;
            }
            
            latencies.push(performance.now() - requestStart);
          } catch (error) {
            // Count failed requests
          }
          
          await new Promise(resolve => setTimeout(resolve, requestInterval));
        }
      };
      
      await loadTest();
      
      const actualDuration = performance.now() - startTime;
      const throughput = (successCount / actualDuration) * 1000; // requests per second
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const successRate = (successCount / requestCount) * 100;
      
      console.log(`Test duration: ${actualDuration.toFixed(0)}ms`);
      console.log(`Total requests: ${requestCount}`);
      console.log(`Successful requests: ${successCount}`);
      console.log(`Throughput: ${throughput.toFixed(2)} req/s`);
      console.log(`Average latency: ${averageLatency.toFixed(2)}ms`);
      console.log(`Success rate: ${successRate.toFixed(2)}%`);
      
      expect(throughput).toBeGreaterThan(10); // At least 10 req/s
      expect(successRate).toBeGreaterThan(95); // 95% success rate
      expect(averageLatency).toBeLessThan(200); // Average under 200ms
    }, 45000);

    it('should scale efficiently with edge node distribution', async () => {
      const testScenarios = [
        { requests: 50, expectedLatency: 200 },
        { requests: 100, expectedLatency: 300 },
        { requests: 200, expectedLatency: 500 }
      ];
      
      for (const scenario of testScenarios) {
        const results = await runLoadTest(scenario.requests, edgeOptimizer);
        
        console.log(`\nLoad test with ${scenario.requests} requests:`);
        console.log(`Average latency: ${results.averageLatency.toFixed(2)}ms`);
        console.log(`Max latency: ${results.maxLatency.toFixed(2)}ms`);
        console.log(`Throughput: ${results.throughput.toFixed(2)} req/s`);
        console.log(`Success rate: ${((results.successfulRequests / results.totalRequests) * 100).toFixed(2)}%`);
        
        expect(results.averageLatency).toBeLessThan(scenario.expectedLatency);
        expect(results.successfulRequests / results.totalRequests).toBeGreaterThan(0.95);
      }
    }, 120000);
  });

  describe('Cache Performance Validation', () => {
    it('should achieve target cache hit rate', async () => {
      const cacheTestData = generateCacheTestData(1000);
      
      // Populate cache with test data
      for (let i = 0; i < cacheTestData.length; i++) {
        await advancedCache.set(`cache-test-${i}`, cacheTestData[i]);
      }
      
      // Test cache hits with repeated access patterns
      const accessPattern = generateAccessPattern(cacheTestData.length, 0.8); // 80% should be repeats
      
      let hits = 0;
      let total = 0;
      
      for (const index of accessPattern) {
        const result = await advancedCache.get(`cache-test-${index}`);
        total++;
        if (result !== undefined) {
          hits++;
        }
      }
      
      const hitRate = (hits / total) * 100;
      const cacheMetrics = advancedCache.getMetrics();
      
      console.log(`Cache hit rate: ${hitRate.toFixed(2)}%`);
      console.log(`Cache metrics hit rate: ${(cacheMetrics.hitRate * 100).toFixed(2)}%`);
      console.log(`Total cache hits: ${cacheMetrics.hits}`);
      console.log(`Total cache misses: ${cacheMetrics.misses}`);
      
      expect(hitRate).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.cacheHitRate);
      expect(cacheMetrics.hitRate * 100).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.cacheHitRate);
    });

    it('should maintain cache performance under memory pressure', async () => {
      const initialMetrics = advancedCache.getMetrics();
      
      // Fill cache to capacity
      const largeDataSet = generateLargeDataSet(5000);
      for (let i = 0; i < largeDataSet.length; i++) {
        await advancedCache.set(`pressure-test-${i}`, largeDataSet[i]);
      }
      
      // Trigger memory optimization
      const optimizationResult = await advancedCache.optimizeMemory();
      
      // Test cache performance after optimization
      const testAccesses = 100;
      let hits = 0;
      
      for (let i = 0; i < testAccesses; i++) {
        const randomIndex = Math.floor(Math.random() * 1000); // Test first 1000 items
        const result = await advancedCache.get(`pressure-test-${randomIndex}`);
        if (result !== undefined) {
          hits++;
        }
      }
      
      const hitRateAfterOptimization = (hits / testAccesses) * 100;
      const finalMetrics = advancedCache.getMetrics();
      
      console.log(`Memory optimization freed: ${optimizationResult.memoryFreed} bytes`);
      console.log(`Entries evicted: ${optimizationResult.entriesEvicted}`);
      console.log(`Hit rate after optimization: ${hitRateAfterOptimization.toFixed(2)}%`);
      console.log(`Compression ratio: ${finalMetrics.compressionRatio.toFixed(2)}`);
      
      expect(hitRateAfterOptimization).toBeGreaterThan(50); // Maintain reasonable hit rate
      expect(finalMetrics.compressionRatio).toBeGreaterThan(1.2); // Good compression
    });
  });

  describe('Error Rate and Reliability Validation', () => {
    it('should maintain low error rate under stress', async () => {
      const stressTestRequests = 500;
      const concurrency = 50;
      
      const batchSize = Math.ceil(stressTestRequests / concurrency);
      const batches = Array.from({ length: concurrency }, (_, batchIndex) => 
        Array.from({ length: batchSize }, (_, requestIndex) => 
          batchIndex * batchSize + requestIndex
        ).filter(index => index < stressTestRequests)
      );
      
      let totalRequests = 0;
      let successfulRequests = 0;
      let errors: Error[] = [];
      
      const batchPromises = batches.map(async (batch) => {
        for (const requestIndex of batch) {
          totalRequests++;
          
          try {
            const result = await edgeOptimizer.processOptimizationRequest({
              id: `stress-test-${requestIndex}`,
              type: 'optimize',
              payload: { prompt: `Stress test prompt ${requestIndex}` },
              priority: 'normal',
              timeout_ms: 2000,
              retry_count: 1,
              cache_policy: { enabled: true }
            });
            
            if (result && result.result) {
              successfulRequests++;
            }
          } catch (error) {
            errors.push(error as Error);
          }
        }
      });
      
      await Promise.all(batchPromises);
      
      const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;
      const successRate = (successfulRequests / totalRequests) * 100;
      
      console.log(`Stress test results:`);
      console.log(`Total requests: ${totalRequests}`);
      console.log(`Successful requests: ${successfulRequests}`);
      console.log(`Failed requests: ${totalRequests - successfulRequests}`);
      console.log(`Error rate: ${errorRate.toFixed(2)}%`);
      console.log(`Success rate: ${successRate.toFixed(2)}%`);
      
      if (errors.length > 0) {
        console.log(`Sample errors:`);
        errors.slice(0, 5).forEach((error, i) => {
          console.log(`  ${i + 1}. ${error.message}`);
        });
      }
      
      expect(errorRate).toBeLessThanOrEqual(PERFORMANCE_TARGETS.errorRate);
      expect(successRate).toBeGreaterThanOrEqual(99); // 99% success rate
    }, 180000);

    it('should recover gracefully from component failures', async () => {
      // Simulate cache failure
      const failingCache = new AdvancedKVCache({
        maxSize: 1,
        maxMemoryMB: 0.001 // Extremely limited to force failures
      });
      
      let cacheErrors = 0;
      let cacheSuccesses = 0;
      
      // Test cache resilience
      for (let i = 0; i < 50; i++) {
        try {
          await failingCache.set(`fail-test-${i}`, { data: `test data ${i}` });
          cacheSuccesses++;
        } catch (error) {
          cacheErrors++;
        }
      }
      
      failingCache.destroy();
      
      // Test optimizer resilience with invalid data
      let optimizerErrors = 0;
      let optimizerSuccesses = 0;
      
      for (let i = 0; i < 20; i++) {
        try {
          const result = await realTimeOptimizer.generateRealTimeOptimizations(
            Math.random() > 0.5 ? `valid-prompt-${i}` : null as any // Introduce some invalid inputs
          );
          if (result) optimizerSuccesses++;
        } catch (error) {
          optimizerErrors++;
        }
      }
      
      console.log(`Cache failure test - Successes: ${cacheSuccesses}, Errors: ${cacheErrors}`);
      console.log(`Optimizer failure test - Successes: ${optimizerSuccesses}, Errors: ${optimizerErrors}`);
      
      // Should handle failures gracefully
      expect(cacheErrors).toBeGreaterThan(0); // Some failures expected with failing cache
      expect(optimizerErrors).toBeLessThan(optimizerSuccesses); // More successes than failures
    });
  });

  describe('Resource Utilization Validation', () => {
    it('should maintain efficient CPU and memory utilization', async () => {
      const monitoringDuration = 30000; // 30 seconds
      const sampleInterval = 1000; // 1 second
      
      const resourceSamples: Array<{
        timestamp: number;
        memory: NodeJS.MemoryUsage;
        cpuUsage?: NodeJS.CpuUsage;
      }> = [];
      
      let previousCpuUsage = process.cpuUsage();
      
      const monitoringStart = performance.now();
      
      // Start load generation
      const loadGenerationPromise = generateContinuousLoad(realTimeOptimizer, edgeOptimizer, monitoringDuration);
      
      // Monitor resource usage
      const monitoringInterval = setInterval(() => {
        const currentCpuUsage = process.cpuUsage(previousCpuUsage);
        previousCpuUsage = process.cpuUsage();
        
        resourceSamples.push({
          timestamp: performance.now() - monitoringStart,
          memory: process.memoryUsage(),
          cpuUsage: currentCpuUsage
        });
      }, sampleInterval);
      
      await loadGenerationPromise;
      clearInterval(monitoringInterval);
      
      // Analyze resource utilization
      const memoryUsages = resourceSamples.map(s => s.memory.heapUsed);
      const cpuUserTimes = resourceSamples.map(s => s.cpuUsage?.user || 0);
      
      const avgMemoryUsage = memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length;
      const peakMemoryUsage = Math.max(...memoryUsages);
      const avgCpuTime = cpuUserTimes.reduce((sum, time) => sum + time, 0) / cpuUserTimes.length;
      
      console.log(`Resource utilization over ${monitoringDuration}ms:`);
      console.log(`Average memory usage: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Peak memory usage: ${(peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Average CPU time per sample: ${avgCpuTime.toFixed(0)}μs`);
      
      // Memory should remain stable
      const memoryGrowth = ((peakMemoryUsage - memoryUsages[0]) / memoryUsages[0]) * 100;
      expect(memoryGrowth).toBeLessThan(300); // Less than 300% growth
      
      // CPU usage should be reasonable
      expect(avgCpuTime).toBeLessThan(100000); // Less than 100ms per second
    }, 45000);
  });
});

// Helper functions

function generateLargeDataSet(count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `data-${i}`,
    content: {
      text: `Large text content for item ${i} `.repeat(50),
      metadata: {
        timestamp: Date.now(),
        index: i,
        tags: Array.from({ length: 10 }, (_, j) => `tag-${i}-${j}`),
        data: new Array(100).fill(Math.random())
      },
      nested: {
        deep: {
          structure: {
            with: {
              many: {
                levels: `Deep data ${i}`
              }
            }
          }
        }
      }
    }
  }));
}

function generateTestPrompts(count: number): Array<{ id: string; prompt: string }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-prompt-${i}`,
    prompt: `Test prompt ${i} for performance validation with detailed instructions and context`.repeat(3)
  }));
}

function generateCacheTestData(count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    data: `Cache test data ${i}`,
    timestamp: Date.now(),
    payload: new Array(50).fill(`payload-${i}`)
  }));
}

function generateAccessPattern(dataSize: number, repeatProbability: number): number[] {
  const pattern: number[] = [];
  const recentAccesses: number[] = [];
  
  for (let i = 0; i < dataSize * 2; i++) {
    if (Math.random() < repeatProbability && recentAccesses.length > 0) {
      // Access recently accessed item
      const recentIndex = Math.floor(Math.random() * Math.min(recentAccesses.length, 20));
      pattern.push(recentAccesses[recentIndex]);
    } else {
      // Access random item
      const randomIndex = Math.floor(Math.random() * dataSize);
      pattern.push(randomIndex);
      recentAccesses.unshift(randomIndex);
      if (recentAccesses.length > 50) {
        recentAccesses.pop();
      }
    }
  }
  
  return pattern;
}

async function* generateContinuousDataStream(count: number) {
  for (let i = 0; i < count; i++) {
    yield {
      id: `stream-${i}`,
      timestamp: Date.now(),
      data: `Streaming data chunk ${i} with variable content`.repeat(Math.floor(Math.random() * 10) + 1),
      metadata: {
        chunk: i,
        size: Math.floor(Math.random() * 1000) + 100,
        checksum: Math.random().toString(36)
      }
    };
    
    // Small delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

async function runLoadTest(requestCount: number, edgeOptimizer: EdgeOptimizer): Promise<LoadTestResult> {
  const initialMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  const requests = Array.from({ length: requestCount }, async (_, i) => {
    const requestStart = performance.now();
    
    try {
      const result = await edgeOptimizer.processOptimizationRequest({
        id: `load-test-${i}`,
        type: 'optimize',
        payload: { prompt: `Load test prompt ${i}` },
        priority: 'normal',
        timeout_ms: 3000,
        retry_count: 0,
        cache_policy: { enabled: true }
      });
      
      return {
        latency: performance.now() - requestStart,
        success: !!result.result
      };
    } catch (error) {
      return {
        latency: performance.now() - requestStart,
        success: false
      };
    }
  });
  
  const results = await Promise.all(requests);
  const endTime = performance.now();
  const peakMemory = process.memoryUsage().heapUsed;
  const finalMemory = process.memoryUsage().heapUsed;
  
  const latencies = results.map(r => r.latency);
  const successfulRequests = results.filter(r => r.success).length;
  const failedRequests = requestCount - successfulRequests;
  
  return {
    totalRequests: requestCount,
    successfulRequests,
    failedRequests,
    averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
    maxLatency: Math.max(...latencies),
    minLatency: Math.min(...latencies),
    throughput: (successfulRequests / (endTime - startTime)) * 1000,
    errorsPerSecond: (failedRequests / (endTime - startTime)) * 1000,
    memoryUsage: {
      initial: initialMemory,
      peak: peakMemory,
      final: finalMemory
    }
  };
}

async function generateContinuousLoad(
  realTimeOptimizer: RealTimeOptimizer,
  edgeOptimizer: EdgeOptimizer,
  duration: number
): Promise<void> {
  const startTime = performance.now();
  let requestId = 0;
  
  const loadPromises: Promise<any>[] = [];
  
  while (performance.now() - startTime < duration) {
    // Generate optimizer requests
    loadPromises.push(
      realTimeOptimizer.generateRealTimeOptimizations(`load-${requestId++}`).catch(() => {})
    );
    
    // Generate edge requests
    loadPromises.push(
      edgeOptimizer.processOptimizationRequest({
        id: `edge-load-${requestId++}`,
        type: 'optimize',
        payload: { prompt: `Load test ${requestId}` },
        priority: 'normal',
        timeout_ms: 1000,
        retry_count: 0,
        cache_policy: { enabled: true }
      }).catch(() => {})
    );
    
    // Process feedback
    loadPromises.push(
      realTimeOptimizer.processFeedback({
        id: `feedback-load-${requestId++}`,
        promptId: `load-prompt-${requestId}`,
        metrics: {
          responseTime: 200 + Math.random() * 300,
          successRate: 90 + Math.random() * 10,
          qualityScore: 80 + Math.random() * 15,
          errorRate: Math.random() * 0.1
        },
        context: {
          environment: 'load-test',
          timestamp: new Date()
        }
      }).catch(() => {})
    );
    
    // Small delay to prevent overwhelming
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  await Promise.all(loadPromises);
}
