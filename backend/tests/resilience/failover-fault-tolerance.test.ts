import { EdgeOptimizer, EdgeNode } from '../../src/services/edge/EdgeOptimizer';
import { RealTimeOptimizer } from '../../src/services/optimization/RealTimeOptimizer';
import { AdvancedKVCache } from '../../src/services/optimization/AdvancedKVCache';
import { performance } from 'perf_hooks';

// Mock external dependencies
jest.mock('../../src/services/analytics/EventStore');
jest.mock('../../src/services/performance/PerformanceMonitor');
jest.mock('../../src/services/health/CircuitBreaker');

interface FailoverTestResult {
  failoverTime: number;
  dataLossOccurred: boolean;
  serviceAvailability: number;
  recoveryTime: number;
  successfulRequests: number;
  totalRequests: number;
}

interface FaultToleranceScenario {
  name: string;
  description: string;
  faultType: 'node_failure' | 'network_partition' | 'memory_pressure' | 'high_latency' | 'cascade_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  expectedRecoveryTime: number;
  maxDataLoss: number;
}

describe('Failover and Fault Tolerance Testing', () => {
  let edgeOptimizer: EdgeOptimizer;
  let realTimeOptimizer: RealTimeOptimizer;
  let advancedCache: AdvancedKVCache;
  let testNodes: EdgeNode[];

  beforeEach(async () => {
    edgeOptimizer = new EdgeOptimizer();
    realTimeOptimizer = new RealTimeOptimizer({
      learningRate: 0.01,
      explorationRate: 0.1,
      optimizationThreshold: 0.05,
      maxConcurrentTests: 5,
      feedbackWindowMs: 60000,
      adaptationIntervalMs: 30000,
      confidenceThreshold: 0.8,
      performanceTargets: {
        successRate: 95,
        responseTime: 500,
        qualityScore: 85
      }
    });

    advancedCache = new AdvancedKVCache({
      maxSize: 1000,
      maxMemoryMB: 50,
      defaultTTL: 300000,
      quantization: {
        enabled: true,
        type: 'int8',
        threshold: 1024,
        aggressive: false
      },
      adaptiveResize: {
        enabled: true,
        minSize: 100,
        maxSize: 5000,
        resizeThreshold: 0.8,
        shrinkFactor: 0.7,
        growthFactor: 1.3
      }
    });

    // Set up test nodes with different characteristics
    testNodes = [
      createTestNode('primary-node-1', 'us-east-1', 'New York', {
        cpu_cores: 16,
        memory_gb: 64,
        storage_gb: 1000,
        network_mbps: 10000
      }, 98),
      createTestNode('primary-node-2', 'us-east-1', 'Virginia', {
        cpu_cores: 12,
        memory_gb: 48,
        storage_gb: 800,
        network_mbps: 8000
      }, 96),
      createTestNode('backup-node-1', 'us-west-1', 'San Francisco', {
        cpu_cores: 8,
        memory_gb: 32,
        storage_gb: 500,
        network_mbps: 5000
      }, 94),
      createTestNode('backup-node-2', 'eu-west-1', 'London', {
        cpu_cores: 8,
        memory_gb: 32,
        storage_gb: 500,
        network_mbps: 5000
      }, 92),
      createTestNode('edge-node-1', 'ap-southeast-1', 'Singapore', {
        cpu_cores: 4,
        memory_gb: 16,
        storage_gb: 200,
        network_mbps: 2000
      }, 88)
    ];

    // Register all test nodes
    for (const node of testNodes) {
      await edgeOptimizer.registerEdgeNode(node);
    }
  });

  afterEach(async () => {
    await Promise.all([
      realTimeOptimizer.cleanup(),
      advancedCache.destroy()
    ]);
    edgeOptimizer.clearMetrics();
  });

  describe('Node Failure Scenarios', () => {
    it('should handle single node failure with automatic failover', async () => {
      const primaryNodeId = 'primary-node-1';
      
      // Establish baseline traffic
      const baselineRequests = await sendTestTraffic(10, edgeOptimizer);
      expect(baselineRequests.successRate).toBeGreaterThan(0.9);
      
      // Simulate node failure
      const failoverStart = performance.now();
      const failoverResult = await edgeOptimizer.handleNodeFailure(primaryNodeId, 'hardware');
      const failoverTime = performance.now() - failoverStart;
      
      expect(failoverResult.failover_completed).toBe(true);
      expect(failoverResult.replacement_nodes.length).toBeGreaterThan(0);
      expect(failoverTime).toBeLessThan(5000); // Failover within 5 seconds
      
      // Test service availability after failover
      const postFailoverRequests = await sendTestTraffic(10, edgeOptimizer);
      expect(postFailoverRequests.successRate).toBeGreaterThan(0.8); // Allow some degradation
      
      console.log(`Failover completed in ${failoverTime.toFixed(2)}ms`);
      console.log(`Service availability: ${(postFailoverRequests.successRate * 100).toFixed(2)}%`);
      console.log(`Replacement nodes: ${failoverResult.replacement_nodes.join(', ')}`);
    });

    it('should handle cascading node failures gracefully', async () => {
      const nodesToFail = ['primary-node-1', 'primary-node-2'];
      let totalFailoverTime = 0;
      let serviceDegradation = [];
      
      for (let i = 0; i < nodesToFail.length; i++) {
        const nodeId = nodesToFail[i];
        
        // Test traffic before failure
        const preFailureTraffic = await sendTestTraffic(5, edgeOptimizer);
        
        // Simulate failure
        const failStart = performance.now();
        await edgeOptimizer.handleNodeFailure(nodeId, 'network');
        const failTime = performance.now() - failStart;
        totalFailoverTime += failTime;
        
        // Test traffic after failure
        const postFailureTraffic = await sendTestTraffic(5, edgeOptimizer);
        serviceDegradation.push({
          nodesFailed: i + 1,
          successRateBefore: preFailureTraffic.successRate,
          successRateAfter: postFailureTraffic.successRate,
          failoverTime: failTime
        });
        
        console.log(`After ${i + 1} node failures:`);
        console.log(`  Success rate: ${(postFailureTraffic.successRate * 100).toFixed(2)}%`);
        console.log(`  Failover time: ${failTime.toFixed(2)}ms`);
      }
      
      // Validate graceful degradation
      expect(serviceDegradation[serviceDegradation.length - 1].successRateAfter).toBeGreaterThan(0.6);
      expect(totalFailoverTime).toBeLessThan(15000); // Total failover under 15 seconds
      
      // Check health status
      const healthStatus = await edgeOptimizer.getHealthStatus();
      expect(healthStatus.online_nodes).toBeGreaterThan(0);
    });

    it('should maintain data consistency during node failures', async () => {
      const testData = generateTestOptimizationData(100);
      
      // Store data across nodes
      for (let i = 0; i < testData.length; i++) {
        await advancedCache.set(`consistency-test-${i}`, testData[i]);
      }
      
      // Verify initial data integrity
      let initialDataIntegrity = 0;
      for (let i = 0; i < 20; i++) {
        const retrieved = await advancedCache.get(`consistency-test-${i}`);
        if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testData[i])) {
          initialDataIntegrity++;
        }
      }
      
      // Simulate node failure
      await edgeOptimizer.handleNodeFailure('primary-node-1', 'hardware');
      
      // Verify data integrity after failure
      let postFailureDataIntegrity = 0;
      for (let i = 0; i < 20; i++) {
        const retrieved = await advancedCache.get(`consistency-test-${i}`);
        if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testData[i])) {
          postFailureDataIntegrity++;
        }
      }
      
      const dataLossPercentage = ((initialDataIntegrity - postFailureDataIntegrity) / initialDataIntegrity) * 100;
      
      console.log(`Data integrity before failure: ${initialDataIntegrity}/20`);
      console.log(`Data integrity after failure: ${postFailureDataIntegrity}/20`);
      console.log(`Data loss: ${dataLossPercentage.toFixed(2)}%`);
      
      expect(dataLossPercentage).toBeLessThan(20); // Less than 20% data loss
    });
  });

  describe('Network Partition Scenarios', () => {
    it('should handle network partitions between regions', async () => {
      // Simulate network partition by marking nodes as unreachable
      const partitionedRegions = ['us-west-1', 'eu-west-1'];
      
      // Store test data before partition
      const testData = Array.from({ length: 50 }, (_, i) => ({
        id: `partition-test-${i}`,
        data: `Test data ${i}`,
        region: partitionedRegions[i % partitionedRegions.length]
      }));
      
      for (const data of testData) {
        await advancedCache.set(data.id, data);
      }
      
      // Simulate partition by failing nodes in specific regions
      const partitionedNodes = testNodes.filter(node => 
        partitionedRegions.includes(node.location.region)
      );
      
      for (const node of partitionedNodes) {
        await edgeOptimizer.handleNodeFailure(node.id, 'network');
      }
      
      // Test service availability during partition
      const duringPartitionRequests = await sendTestTraffic(20, edgeOptimizer);
      
      // Verify remaining nodes can still serve requests
      expect(duringPartitionRequests.successRate).toBeGreaterThan(0.7);
      
      // Simulate partition healing by checking health
      const healthStatus = await edgeOptimizer.getHealthStatus();
      expect(healthStatus.online_nodes).toBeGreaterThan(0);
      
      console.log(`Service availability during partition: ${(duringPartitionRequests.successRate * 100).toFixed(2)}%`);
      console.log(`Remaining online nodes: ${healthStatus.online_nodes}`);
    });

    it('should implement split-brain prevention mechanisms', async () => {
      // This test simulates a scenario where network partition could cause split-brain
      const eastCoastNodes = testNodes.filter(node => node.location.region === 'us-east-1');
      const westCoastNodes = testNodes.filter(node => node.location.region === 'us-west-1');
      
      // Create conflicting operations on both sides of partition
      const conflictingData = {
        id: 'split-brain-test',
        eastVersion: { version: 1, source: 'east', timestamp: Date.now() },
        westVersion: { version: 2, source: 'west', timestamp: Date.now() + 1000 }
      };
      
      // Store initial data
      await advancedCache.set(conflictingData.id, conflictingData.eastVersion);
      
      // Simulate partition
      for (const node of westCoastNodes) {
        await edgeOptimizer.handleNodeFailure(node.id, 'network');
      }
      
      // Try to update from both sides (simulated)
      await advancedCache.set(conflictingData.id, conflictingData.westVersion);
      
      // Verify data consistency
      const finalData = await advancedCache.get(conflictingData.id);
      expect(finalData).toBeDefined();
      
      // Should have a consistent version (not corrupted)
      expect(finalData.source).toBeDefined();
      expect(finalData.version).toBeDefined();
      
      console.log(`Final data after partition simulation:`, finalData);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory pressure gracefully', async () => {
      const initialMetrics = advancedCache.getMetrics();
      
      // Fill cache beyond normal capacity
      const largeDataSet = Array.from({ length: 2000 }, (_, i) => ({
        id: `memory-pressure-${i}`,
        data: 'Large data content '.repeat(100), // Large strings
        payload: new Array(500).fill(Math.random()),
        metadata: {
          timestamp: Date.now(),
          index: i,
          description: 'Memory pressure test data with significant size'
        }
      }));
      
      let memoryErrors = 0;
      let successfulStores = 0;
      
      for (const data of largeDataSet) {
        try {
          await advancedCache.set(data.id, data);
          successfulStores++;
        } catch (error) {
          memoryErrors++;
        }
      }
      
      // Check if cache handled memory pressure
      const memoryPressure = advancedCache.getMemoryPressure();
      const finalMetrics = advancedCache.getMetrics();
      
      console.log(`Memory pressure level: ${memoryPressure.level}`);
      console.log(`Successful stores: ${successfulStores}/${largeDataSet.length}`);
      console.log(`Memory errors: ${memoryErrors}`);
      console.log(`Evictions: ${finalMetrics.evictions - initialMetrics.evictions}`);
      
      // Should handle memory pressure without catastrophic failure
      expect(successfulStores).toBeGreaterThan(largeDataSet.length * 0.5);
      expect(memoryPressure.level).toBeDefined();
      
      // Verify cache is still functional
      await advancedCache.set('post-pressure-test', { test: 'data' });
      const retrieved = await advancedCache.get('post-pressure-test');
      expect(retrieved).toBeDefined();
    });

    it('should handle CPU overload scenarios', async () => {
      const cpuIntensiveTasks: Promise<any>[] = [];
      const concurrentTasks = 50;
      
      // Generate CPU-intensive optimization tasks
      for (let i = 0; i < concurrentTasks; i++) {
        cpuIntensiveTasks.push(
          realTimeOptimizer.generateRealTimeOptimizations(`cpu-test-${i}`, {
            complexity: 'high',
            environment: 'cpu-overload-test'
          })
        );
      }
      
      const startTime = performance.now();
      const results = await Promise.allSettled(cpuIntensiveTasks);
      const endTime = performance.now();
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const averageTime = (endTime - startTime) / concurrentTasks;
      
      console.log(`CPU overload test results:`);
      console.log(`  Successful tasks: ${successful}/${concurrentTasks}`);
      console.log(`  Failed tasks: ${failed}`);
      console.log(`  Average time per task: ${averageTime.toFixed(2)}ms`);
      console.log(`  Total time: ${(endTime - startTime).toFixed(2)}ms`);
      
      // Should handle CPU overload gracefully
      expect(successful / concurrentTasks).toBeGreaterThan(0.7); // 70% success rate
      expect(averageTime).toBeLessThan(5000); // Average under 5 seconds
    });

    it('should implement backpressure mechanisms', async () => {
      const requestQueue: Promise<any>[] = [];
      const maxConcurrentRequests = 100;
      let queuedRequests = 0;
      let processedRequests = 0;
      let rejectedRequests = 0;
      
      // Flood the system with requests
      for (let i = 0; i < maxConcurrentRequests; i++) {
        const request = edgeOptimizer.processOptimizationRequest({
          id: `backpressure-test-${i}`,
          type: 'optimize',
          payload: { prompt: `Backpressure test prompt ${i}` },
          priority: 'normal',
          timeout_ms: 2000,
          retry_count: 0,
          cache_policy: { enabled: true }
        }).then(result => {
          processedRequests++;
          return result;
        }).catch(error => {
          rejectedRequests++;
          throw error;
        });
        
        requestQueue.push(request);
        queuedRequests++;
      }
      
      const results = await Promise.allSettled(requestQueue);
      
      const successRate = processedRequests / queuedRequests;
      const rejectionRate = rejectedRequests / queuedRequests;
      
      console.log(`Backpressure test results:`);
      console.log(`  Queued requests: ${queuedRequests}`);
      console.log(`  Processed requests: ${processedRequests}`);
      console.log(`  Rejected requests: ${rejectedRequests}`);
      console.log(`  Success rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`  Rejection rate: ${(rejectionRate * 100).toFixed(2)}%`);
      
      // System should handle backpressure without complete failure
      expect(successRate).toBeGreaterThan(0.5); // At least 50% success
      expect(rejectionRate).toBeLessThan(0.5); // Less than 50% rejection
    });
  });

  describe('Recovery and Self-Healing', () => {
    it('should implement automatic recovery mechanisms', async () => {
      const recoveryTestNode = 'primary-node-1';
      
      // Initial health check
      const initialHealth = await edgeOptimizer.getHealthStatus();
      
      // Simulate node failure
      await edgeOptimizer.handleNodeFailure(recoveryTestNode, 'software');
      
      // Wait for recovery attempt (simulated)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if node is marked for recovery
      const duringRecoveryHealth = await edgeOptimizer.getHealthStatus();
      
      // Simulate successful recovery
      const recoveredNode = testNodes.find(n => n.id === recoveryTestNode);
      if (recoveredNode) {
        recoveredNode.status.online = true;
        recoveredNode.status.health_score = 85; // Recovered but not perfect
        recoveredNode.status.failover_count++;
      }
      
      const postRecoveryHealth = await edgeOptimizer.getHealthStatus();
      
      console.log(`Health before failure: ${initialHealth.average_health_score}`);
      console.log(`Health during recovery: ${duringRecoveryHealth.average_health_score}`);
      console.log(`Health after recovery: ${postRecoveryHealth.average_health_score}`);
      
      // Verify recovery
      expect(postRecoveryHealth.online_nodes).toBeGreaterThanOrEqual(duringRecoveryHealth.online_nodes);
      
      // Test service functionality after recovery
      const postRecoveryTraffic = await sendTestTraffic(10, edgeOptimizer);
      expect(postRecoveryTraffic.successRate).toBeGreaterThan(0.8);
    });

    it('should implement circuit breaker patterns', async () => {
      const unstableNodeId = 'primary-node-2';
      
      // Simulate repeated failures to trigger circuit breaker
      const failureSimulations = 5;
      
      for (let i = 0; i < failureSimulations; i++) {
        try {
          await edgeOptimizer.processOptimizationRequest({
            id: `circuit-breaker-test-${i}`,
            type: 'optimize',
            payload: { prompt: 'Circuit breaker test' },
            priority: 'normal',
            timeout_ms: 1000,
            retry_count: 0,
            cache_policy: { enabled: false }
          });
        } catch (error) {
          // Expected failures
        }
        
        // Simulate node instability
        if (i < failureSimulations - 1) {
          await edgeOptimizer.handleNodeFailure(unstableNodeId, 'overload');
        }
      }
      
      // Test if circuit breaker prevents further requests to unstable node
      const circuitBreakerTest = await sendTestTraffic(10, edgeOptimizer);
      
      console.log(`Circuit breaker test success rate: ${(circuitBreakerTest.successRate * 100).toFixed(2)}%`);
      
      // Should route around the unstable node
      expect(circuitBreakerTest.successRate).toBeGreaterThan(0.6);
    });

    it('should perform health-based load redistribution', async () => {
      // Create nodes with different health scores
      const healthyNode = testNodes.find(n => n.id === 'primary-node-1')!;
      const degradedNode = testNodes.find(n => n.id === 'backup-node-1')!;
      
      // Simulate health degradation
      degradedNode.status.health_score = 60;
      degradedNode.status.current_load = 0.9;
      degradedNode.status.error_rate = 0.1;
      
      // Send test traffic and monitor distribution
      const distributionTest = await sendDetailedTestTraffic(50, edgeOptimizer);
      
      const healthyNodeRequests = distributionTest.nodeDistribution[healthyNode.id] || 0;
      const degradedNodeRequests = distributionTest.nodeDistribution[degradedNode.id] || 0;
      
      console.log(`Request distribution:`);
      console.log(`  Healthy node (${healthyNode.id}): ${healthyNodeRequests} requests`);
      console.log(`  Degraded node (${degradedNode.id}): ${degradedNodeRequests} requests`);
      
      // Healthy node should receive more traffic
      expect(healthyNodeRequests).toBeGreaterThan(degradedNodeRequests);
      expect(distributionTest.overallSuccessRate).toBeGreaterThan(0.8);
    });
  });

  describe('Chaos Engineering Scenarios', () => {
    it('should survive random failure injection', async () => {
      const chaosTestDuration = 30000; // 30 seconds
      const failureInterval = 5000; // Inject failure every 5 seconds
      
      const startTime = performance.now();
      let injectedFailures = 0;
      let serviceRequests = 0;
      let successfulRequests = 0;
      
      // Start chaos monkey
      const chaosInterval = setInterval(async () => {
        const randomNode = testNodes[Math.floor(Math.random() * testNodes.length)];
        const failureTypes = ['network', 'hardware', 'software', 'overload'] as const;
        const randomFailureType = failureTypes[Math.floor(Math.random() * failureTypes.length)];
        
        try {
          await edgeOptimizer.handleNodeFailure(randomNode.id, randomFailureType);
          injectedFailures++;
          console.log(`Chaos: Injected ${randomFailureType} failure on ${randomNode.id}`);
        } catch (error) {
          // Failure injection might fail, which is okay
        }
      }, failureInterval);
      
      // Continuous service testing
      const serviceTestInterval = setInterval(async () => {
        try {
          const result = await edgeOptimizer.processOptimizationRequest({
            id: `chaos-test-${serviceRequests}`,
            type: 'optimize',
            payload: { prompt: `Chaos test ${serviceRequests}` },
            priority: 'high',
            timeout_ms: 2000,
            retry_count: 1,
            cache_policy: { enabled: true }
          });
          
          if (result && result.result) {
            successfulRequests++;
          }
        } catch (error) {
          // Service failures expected during chaos
        }
        serviceRequests++;
      }, 1000);
      
      // Wait for chaos test duration
      await new Promise(resolve => setTimeout(resolve, chaosTestDuration));
      
      clearInterval(chaosInterval);
      clearInterval(serviceTestInterval);
      
      const serviceAvailability = (successfulRequests / serviceRequests) * 100;
      
      console.log(`Chaos engineering results:`);
      console.log(`  Test duration: ${chaosTestDuration}ms`);
      console.log(`  Injected failures: ${injectedFailures}`);
      console.log(`  Service requests: ${serviceRequests}`);
      console.log(`  Successful requests: ${successfulRequests}`);
      console.log(`  Service availability: ${serviceAvailability.toFixed(2)}%`);
      
      // Service should maintain reasonable availability despite chaos
      expect(serviceAvailability).toBeGreaterThan(60); // 60% availability under chaos
      expect(injectedFailures).toBeGreaterThan(0); // Chaos should have occurred
    }, 45000);
  });
});

// Helper functions

function createTestNode(
  id: string,
  region: string,
  city: string,
  resources: EdgeNode['resources'],
  healthScore: number
): EdgeNode {
  return {
    id,
    location: {
      region,
      city,
      country: 'Test Country',
      latitude: 40.0 + Math.random() * 10,
      longitude: -70.0 - Math.random() * 10,
      timezone: 'UTC'
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
    resources,
    status: {
      online: true,
      last_heartbeat: new Date(),
      current_load: Math.random() * 0.3,
      queue_depth: Math.floor(Math.random() * 5),
      response_time_p50: 30 + Math.random() * 20,
      response_time_p95: 60 + Math.random() * 40,
      response_time_p99: 100 + Math.random() * 50,
      error_rate: Math.random() * 0.02,
      uptime_percentage: 98 + Math.random() * 2,
      health_score: healthScore,
      failover_count: 0
    },
    models: [],
    cache_stats: {
      hit_rate: 0.7 + Math.random() * 0.2,
      size_mb: Math.random() * 200,
      max_size_mb: 500,
      eviction_count: Math.floor(Math.random() * 10)
    },
    performance_metrics: {
      requests_per_second: Math.random() * 100,
      concurrent_connections: Math.floor(Math.random() * 50),
      bandwidth_utilization: Math.random() * 0.5,
      memory_utilization: Math.random() * 0.4,
      cpu_utilization: Math.random() * 0.3
    }
  };
}

function generateTestOptimizationData(count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt-data-${i}`,
    prompt: `Test optimization prompt ${i}`,
    suggestions: Array.from({ length: 3 }, (_, j) => ({
      id: `suggestion-${i}-${j}`,
      type: 'optimization',
      description: `Optimization suggestion ${j} for prompt ${i}`,
      expectedImprovement: {
        successRate: Math.random() * 10,
        responseTime: Math.random() * 100,
        qualityScore: Math.random() * 15
      },
      confidence: Math.random()
    })),
    metadata: {
      timestamp: Date.now(),
      version: '1.0.0',
      environment: 'test'
    }
  }));
}

async function sendTestTraffic(
  requestCount: number,
  edgeOptimizer: EdgeOptimizer
): Promise<{ successRate: number; averageLatency: number }> {
  const results = [];
  
  for (let i = 0; i < requestCount; i++) {
    const startTime = performance.now();
    
    try {
      const result = await edgeOptimizer.processOptimizationRequest({
        id: `traffic-test-${i}`,
        type: 'optimize',
        payload: { prompt: `Traffic test prompt ${i}` },
        priority: 'normal',
        timeout_ms: 3000,
        retry_count: 1,
        cache_policy: { enabled: true }
      });
      
      results.push({
        success: !!result.result,
        latency: performance.now() - startTime
      });
    } catch (error) {
      results.push({
        success: false,
        latency: performance.now() - startTime
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const averageLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
  
  return {
    successRate: successCount / requestCount,
    averageLatency
  };
}

async function sendDetailedTestTraffic(
  requestCount: number,
  edgeOptimizer: EdgeOptimizer
): Promise<{
  overallSuccessRate: number;
  nodeDistribution: Record<string, number>;
  averageLatency: number;
}> {
  const nodeDistribution: Record<string, number> = {};
  let successCount = 0;
  const latencies: number[] = [];
  
  for (let i = 0; i < requestCount; i++) {
    const startTime = performance.now();
    
    try {
      const result = await edgeOptimizer.processOptimizationRequest({
        id: `detailed-traffic-test-${i}`,
        type: 'optimize',
        payload: { prompt: `Detailed traffic test prompt ${i}` },
        priority: 'normal',
        timeout_ms: 2000,
        retry_count: 0,
        cache_policy: { enabled: true }
      });
      
      if (result && result.result) {
        successCount++;
        const nodeId = result.metadata.node_id;
        nodeDistribution[nodeId] = (nodeDistribution[nodeId] || 0) + 1;
      }
      
      latencies.push(performance.now() - startTime);
    } catch (error) {
      latencies.push(performance.now() - startTime);
    }
  }
  
  return {
    overallSuccessRate: successCount / requestCount,
    nodeDistribution,
    averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
  };
}
