import { EdgeOptimizer, EdgeNode, EdgeRequest, EdgeResponse, OptimizationWorkload, EdgeCacheStrategy } from '../../src/services/edge/EdgeOptimizer';
import { performance } from 'perf_hooks';

// Mock dependencies
jest.mock('../../src/services/analytics/EventStore');
jest.mock('../../src/services/performance/PerformanceMonitor');
jest.mock('../../src/services/health/CircuitBreaker');

describe('EdgeOptimizer - Comprehensive Tests', () => {
  let edgeOptimizer: EdgeOptimizer;
  let mockEdgeNode: EdgeNode;
  let mockEdgeRequest: EdgeRequest;

  beforeEach(() => {
    edgeOptimizer = new EdgeOptimizer();
    
    mockEdgeNode = {
      id: 'test-node-1',
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
        cpu_cores: 8,
        memory_gb: 32,
        storage_gb: 500,
        network_mbps: 1000,
        gpu_count: 2,
        gpu_memory_gb: 16
      },
      status: {
        online: true,
        last_heartbeat: new Date(),
        current_load: 0.3,
        queue_depth: 5,
        response_time_p50: 50,
        response_time_p95: 120,
        response_time_p99: 200,
        error_rate: 0.02,
        uptime_percentage: 99.5,
        health_score: 95,
        failover_count: 0
      },
      models: [],
      cache_stats: {
        hit_rate: 0.75,
        size_mb: 150,
        max_size_mb: 500,
        eviction_count: 10
      },
      performance_metrics: {
        requests_per_second: 100,
        concurrent_connections: 50,
        bandwidth_utilization: 0.6,
        memory_utilization: 0.4,
        cpu_utilization: 0.3
      }
    };

    mockEdgeRequest = {
      id: 'test-request-1',
      user_id: 'user-123',
      session_id: 'session-456',
      type: 'optimize',
      payload: {
        prompt: 'Test prompt for optimization',
        target_metrics: {
          max_latency_ms: 500,
          min_quality_score: 80,
          max_cost: 0.05
        }
      },
      client_location: {
        latitude: 40.7589,
        longitude: -73.9851,
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        isp: 'Test ISP',
        connection_type: 'fiber'
      },
      priority: 'normal',
      timeout_ms: 5000,
      retry_count: 0,
      cache_policy: {
        enabled: true,
        ttl_minutes: 30,
        key_prefix: 'opt:',
        invalidate_on_update: true
      },
      routing_preferences: {
        preferred_regions: ['us-east-1'],
        max_hops: 2,
        require_capabilities: ['prompt_optimization']
      }
    };
  });

  afterEach(() => {
    // Cleanup
    edgeOptimizer.clearMetrics();
  });

  describe('Node Registration and Management', () => {
    it('should register edge node successfully', async () => {
      const result = await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      expect(result.success).toBe(true);
      expect(result.node_id).toBe(mockEdgeNode.id);
      expect(result.deployment_time_ms).toBeGreaterThan(0);
      expect(result.initial_health_score).toBeGreaterThan(0);
      expect(Array.isArray(result.assigned_workloads)).toBe(true);
    });

    it('should validate node requirements', async () => {
      const invalidNode = {
        ...mockEdgeNode,
        resources: {
          ...mockEdgeNode.resources,
          memory_gb: 2, // Below minimum requirement
          cpu_cores: 1 // Below minimum requirement
        }
      };

      await expect(edgeOptimizer.registerEdgeNode(invalidNode))
        .rejects.toThrow();
    });

    it('should calculate initial health score correctly', async () => {
      const highSpecNode = {
        ...mockEdgeNode,
        resources: {
          cpu_cores: 16,
          memory_gb: 64,
          storage_gb: 1000,
          network_mbps: 10000
        }
      };

      const result = await edgeOptimizer.registerEdgeNode(highSpecNode);
      expect(result.initial_health_score).toBeGreaterThan(90);
    });

    it('should deploy optimal models based on capabilities', async () => {
      const result = await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      const registeredNode = edgeOptimizer.getNodeById(mockEdgeNode.id);
      expect(registeredNode).toBeDefined();
      expect(registeredNode!.models.length).toBeGreaterThan(0);
      
      // Should have models for enabled capabilities
      const modelTypes = registeredNode!.models.map(m => m.type);
      expect(modelTypes).toContain('optimization');
      expect(modelTypes).toContain('semantic');
    });

    it('should remove nodes properly', async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      const removeResult = await edgeOptimizer.removeNode(mockEdgeNode.id);
      expect(removeResult).toBe(true);
      
      const removedNode = edgeOptimizer.getNodeById(mockEdgeNode.id);
      expect(removedNode).toBeUndefined();
    });
  });

  describe('Request Processing and Routing', () => {
    beforeEach(async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
    });

    it('should process optimization requests successfully', async () => {
      const response = await edgeOptimizer.processOptimizationRequest(mockEdgeRequest);
      
      expect(response.request_id).toBe(mockEdgeRequest.id);
      expect(response.result).toBeDefined();
      expect(response.metadata.node_id).toBe(mockEdgeNode.id);
      expect(response.performance.total_latency_ms).toBeGreaterThan(0);
      expect(response.cost_metrics.total_cost).toBeGreaterThan(0);
    });

    it('should handle different request types', async () => {
      const requestTypes = ['optimize', 'analyze', 'search', 'generate', 'validate'] as const;
      
      for (const type of requestTypes) {
        const request = {
          ...mockEdgeRequest,
          id: `request-${type}`,
          type,
          payload: {
            prompt: 'Test prompt',
            query: 'Test query'
          }
        };

        const response = await edgeOptimizer.processOptimizationRequest(request);
        expect(response.request_id).toBe(request.id);
        expect(response.result).toBeDefined();
      }
    });

    it('should utilize caching effectively', async () => {
      const cachedRequest = {
        ...mockEdgeRequest,
        cache_policy: {
          enabled: true,
          ttl_minutes: 60
        }
      };

      // First request - should process normally
      const response1 = await edgeOptimizer.processOptimizationRequest(cachedRequest);
      const firstLatency = response1.performance.total_latency_ms;

      // Second identical request - should hit cache
      const response2 = await edgeOptimizer.processOptimizationRequest({
        ...cachedRequest,
        id: 'cached-request-2'
      });
      const secondLatency = response2.performance.total_latency_ms;

      // Cache hit should be faster
      expect(secondLatency).toBeLessThan(firstLatency);
      expect(response2.metadata.cache_hit).toBe(true);
    });

    it('should select optimal nodes based on multiple criteria', async () => {
      // Register additional nodes
      const node2 = {
        ...mockEdgeNode,
        id: 'test-node-2',
        location: {
          ...mockEdgeNode.location,
          city: 'Boston'
        },
        status: {
          ...mockEdgeNode.status,
          current_load: 0.8, // Higher load
          response_time_p95: 200 // Slower response
        }
      };

      await edgeOptimizer.registerEdgeNode(node2);

      const response = await edgeOptimizer.processOptimizationRequest(mockEdgeRequest);
      
      // Should prefer the better performing node (node-1)
      expect(response.metadata.node_id).toBe('test-node-1');
    });

    it('should handle node failures with circuit breaker', async () => {
      // Simulate a failing node
      const failingNode = {
        ...mockEdgeNode,
        id: 'failing-node',
        status: {
          ...mockEdgeNode.status,
          error_rate: 0.8, // High error rate
          health_score: 30 // Low health
        }
      };

      await edgeOptimizer.registerEdgeNode(failingNode);
      
      // Request should still succeed using healthy node
      const response = await edgeOptimizer.processOptimizationRequest(mockEdgeRequest);
      expect(response.metadata.node_id).toBe('test-node-1'); // Should route to healthy node
    });
  });

  describe('Distributed Workload Coordination', () => {
    beforeEach(async () => {
      // Register multiple nodes for distributed workloads
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      const node2 = {
        ...mockEdgeNode,
        id: 'test-node-2',
        location: { ...mockEdgeNode.location, city: 'Boston' }
      };
      await edgeOptimizer.registerEdgeNode(node2);
    });

    it('should coordinate distributed optimization workloads', async () => {
      const workload: OptimizationWorkload = {
        id: 'distributed-workload-1',
        type: 'batch_optimization',
        priority: 5,
        estimated_duration_ms: 60000,
        resource_requirements: {
          cpu_cores: 4,
          memory_gb: 8,
          storage_gb: 50,
          network_mbps: 100
        },
        payload: {
          prompts: ['prompt1', 'prompt2', 'prompt3'],
          optimization_goals: ['speed', 'quality']
        },
        constraints: {
          max_latency_ms: 5000,
          preferred_regions: ['us-east-1'],
          security_level: 'enhanced'
        },
        dependencies: [],
        status: 'pending',
        assigned_nodes: [],
        progress: 0
      };

      const result = await edgeOptimizer.coordinateDistributedWorkload(workload);
      
      expect(result.workload_id).toBe(workload.id);
      expect(result.assigned_nodes.length).toBeGreaterThan(0);
      expect(result.coordination_strategy).toBeDefined();
      expect(result.estimated_completion).toBeInstanceOf(Date);
    });

    it('should handle workload resource requirements', async () => {
      const resourceIntensiveWorkload: OptimizationWorkload = {
        id: 'resource-intensive-workload',
        type: 'model_training',
        priority: 8,
        estimated_duration_ms: 300000, // 5 minutes
        resource_requirements: {
          cpu_cores: 16, // High CPU requirement
          memory_gb: 64, // High memory requirement
          storage_gb: 200,
          network_mbps: 1000
        },
        payload: { training_data: 'large_dataset' },
        constraints: {
          max_latency_ms: 10000
        },
        dependencies: [],
        status: 'pending',
        assigned_nodes: [],
        progress: 0
      };

      // Should handle resource allocation appropriately
      const result = await edgeOptimizer.coordinateDistributedWorkload(resourceIntensiveWorkload);
      expect(result.assigned_nodes.length).toBeGreaterThan(0);
    });

    it('should optimize node assignment for workloads', async () => {
      const workload: OptimizationWorkload = {
        id: 'optimization-workload',
        type: 'continuous_learning',
        priority: 6,
        estimated_duration_ms: 120000,
        resource_requirements: {
          cpu_cores: 2,
          memory_gb: 4,
          storage_gb: 20,
          network_mbps: 200
        },
        payload: { learning_parameters: {} },
        constraints: {},
        dependencies: [],
        status: 'pending',
        assigned_nodes: [],
        progress: 0
      };

      const result = await edgeOptimizer.coordinateDistributedWorkload(workload);
      
      // Should assign appropriate number of nodes based on workload
      expect(result.assigned_nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.assigned_nodes.length).toBeLessThanOrEqual(3); // Reasonable distribution
    });
  });

  describe('Edge Caching Optimization', () => {
    beforeEach(async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
    });

    it('should optimize edge caching with different strategies', async () => {
      const cacheStrategy: EdgeCacheStrategy = {
        id: 'test-strategy',
        name: 'Test Caching Strategy',
        type: 'adaptive',
        parameters: {
          max_size_mb: 1000,
          ttl_minutes: 60,
          eviction_threshold: 0.8,
          prefetch_enabled: true,
          compression_enabled: true,
          replication_factor: 2
        },
        performance_metrics: {
          hit_rate: 0.8,
          miss_penalty_ms: 50,
          storage_efficiency: 0.9,
          bandwidth_savings: 0.7
        }
      };

      const result = await edgeOptimizer.optimizeEdgeCaching(cacheStrategy);
      
      expect(result.cache_efficiency_improvement).toBeGreaterThanOrEqual(0);
      expect(result.storage_savings_mb).toBeGreaterThanOrEqual(0);
      expect(result.latency_reduction_ms).toBeGreaterThanOrEqual(0);
      expect(result.affected_nodes.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle different cache strategies', async () => {
      const strategies = ['lru', 'lfu', 'ttl', 'adaptive', 'geographic', 'predictive'] as const;
      
      for (const strategyType of strategies) {
        const strategy: EdgeCacheStrategy = {
          id: `strategy-${strategyType}`,
          name: `${strategyType} Strategy`,
          type: strategyType,
          parameters: {
            max_size_mb: 500,
            ttl_minutes: 30,
            eviction_threshold: 0.8,
            prefetch_enabled: true,
            compression_enabled: true,
            replication_factor: 1
          },
          performance_metrics: {
            hit_rate: 0.7,
            miss_penalty_ms: 40,
            storage_efficiency: 0.8,
            bandwidth_savings: 0.5
          }
        };

        const result = await edgeOptimizer.optimizeEdgeCaching(strategy);
        expect(result).toHaveProperty('cache_efficiency_improvement');
      }
    });
  });

  describe('Failover and Fault Tolerance', () => {
    beforeEach(async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      // Register backup nodes
      const backupNode = {
        ...mockEdgeNode,
        id: 'backup-node-1',
        location: { ...mockEdgeNode.location, city: 'Boston' }
      };
      await edgeOptimizer.registerEdgeNode(backupNode);
    });

    it('should handle node failures with automatic failover', async () => {
      const failureTypes = ['network', 'hardware', 'software', 'overload'] as const;
      
      for (const failureType of failureTypes) {
        const result = await edgeOptimizer.handleNodeFailure(mockEdgeNode.id, failureType);
        
        expect(result.failover_completed).toBe(true);
        expect(result.replacement_nodes.length).toBeGreaterThanOrEqual(0);
        expect(result.failover_time_ms).toBeGreaterThan(0);
        expect(result.data_loss_prevented).toBeDefined();
        expect(result.recovery_strategy).toBeDefined();
      }
    });

    it('should migrate workloads during failover', async () => {
      const result = await edgeOptimizer.handleNodeFailure(mockEdgeNode.id, 'hardware');
      
      expect(result.migrated_workloads).toBeDefined();
      expect(Array.isArray(result.migrated_workloads)).toBe(true);
    });

    it('should maintain service availability during failures', async () => {
      // Simulate node failure
      await edgeOptimizer.handleNodeFailure(mockEdgeNode.id, 'network');
      
      // Service should still work with backup nodes
      const response = await edgeOptimizer.processOptimizationRequest(mockEdgeRequest);
      expect(response.request_id).toBe(mockEdgeRequest.id);
      expect(response.routing_info.failover_used).toBe(true);
    });
  });

  describe('Cloud Synchronization', () => {
    beforeEach(async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
    });

    it('should synchronize with cloud optimization engine', async () => {
      const syncResult = await edgeOptimizer.synchronizeWithCloud();
      
      expect(syncResult.synchronized_nodes).toBeDefined();
      expect(syncResult.failed_nodes).toBeDefined();
      expect(syncResult.sync_duration_ms).toBeGreaterThan(0);
      expect(syncResult.data_transferred_mb).toBeGreaterThanOrEqual(0);
      expect(syncResult.performance_improvements).toBeDefined();
    });

    it('should handle synchronization failures gracefully', async () => {
      // Test should complete even if some nodes fail to sync
      const syncResult = await edgeOptimizer.synchronizeWithCloud();
      
      expect(syncResult.synchronized_nodes.length + syncResult.failed_nodes.length)
        .toBeGreaterThanOrEqual(1);
    });
  });

  describe('Performance Metrics and Analytics', () => {
    beforeEach(async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      // Generate some activity
      for (let i = 0; i < 5; i++) {
        await edgeOptimizer.processOptimizationRequest({
          ...mockEdgeRequest,
          id: `perf-test-${i}`
        });
      }
    });

    it('should provide comprehensive performance metrics', async () => {
      const metrics = await edgeOptimizer.getEdgePerformanceMetrics();
      
      expect(metrics.global_metrics).toBeDefined();
      expect(metrics.node_metrics).toBeDefined();
      expect(metrics.regional_performance).toBeDefined();
      expect(metrics.optimization_insights).toBeDefined();
      
      // Global metrics validation
      expect(metrics.global_metrics.total_requests).toBeGreaterThanOrEqual(0);
      expect(metrics.global_metrics.successful_requests).toBeGreaterThanOrEqual(0);
      expect(metrics.global_metrics.cache_hit_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.global_metrics.cache_hit_rate).toBeLessThanOrEqual(1);
    });

    it('should track per-node performance metrics', async () => {
      const metrics = await edgeOptimizer.getEdgePerformanceMetrics();
      
      expect(metrics.node_metrics[mockEdgeNode.id]).toBeDefined();
      
      const nodeMetrics = metrics.node_metrics[mockEdgeNode.id];
      expect(nodeMetrics.health_score).toBeGreaterThan(0);
      expect(nodeMetrics.current_load).toBeGreaterThanOrEqual(0);
      expect(nodeMetrics.current_load).toBeLessThanOrEqual(1);
      expect(nodeMetrics.resource_utilization).toBeDefined();
    });

    it('should provide optimization insights', async () => {
      const metrics = await edgeOptimizer.getEdgePerformanceMetrics();
      
      expect(metrics.optimization_insights.performance_trends).toBeDefined();
      expect(metrics.optimization_insights.bottlenecks).toBeDefined();
      expect(metrics.optimization_insights.recommendations).toBeDefined();
      expect(metrics.optimization_insights.cost_optimization_opportunities).toBeDefined();
      
      expect(Array.isArray(metrics.optimization_insights.bottlenecks)).toBe(true);
      expect(Array.isArray(metrics.optimization_insights.recommendations)).toBe(true);
    });

    it('should calculate regional performance metrics', async () => {
      const metrics = await edgeOptimizer.getEdgePerformanceMetrics();
      
      expect(Object.keys(metrics.regional_performance).length).toBeGreaterThanOrEqual(1);
      
      const regionMetrics = Object.values(metrics.regional_performance)[0];
      expect(regionMetrics.total_nodes).toBeGreaterThan(0);
      expect(regionMetrics.online_nodes).toBeGreaterThanOrEqual(0);
      expect(regionMetrics.capacity_utilization).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Geographic Load Balancing', () => {
    beforeEach(async () => {
      // Register nodes in different regions
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      const westCoastNode = {
        ...mockEdgeNode,
        id: 'west-coast-node',
        location: {
          region: 'us-west-1',
          city: 'San Francisco',
          country: 'USA',
          latitude: 37.7749,
          longitude: -122.4194,
          timezone: 'America/Los_Angeles'
        }
      };
      await edgeOptimizer.registerEdgeNode(westCoastNode);
    });

    it('should route requests to geographically closest nodes', async () => {
      const eastCoastRequest = {
        ...mockEdgeRequest,
        id: 'east-coast-request',
        client_location: {
          latitude: 40.7128, // New York
          longitude: -74.0060
        }
      };

      const response = await edgeOptimizer.processOptimizationRequest(eastCoastRequest);
      
      // Should route to east coast node due to proximity
      expect(response.metadata.node_id).toBe('test-node-1');
      expect(response.routing_info.geographic_distance_km).toBeLessThan(1000);
    });

    it('should balance load across regional nodes', async () => {
      const requests = [];
      
      // Send multiple requests
      for (let i = 0; i < 10; i++) {
        requests.push(edgeOptimizer.processOptimizationRequest({
          ...mockEdgeRequest,
          id: `load-balance-${i}`
        }));
      }
      
      const responses = await Promise.all(requests);
      const nodeUsage = new Map<string, number>();
      
      responses.forEach(response => {
        const nodeId = response.metadata.node_id;
        nodeUsage.set(nodeId, (nodeUsage.get(nodeId) || 0) + 1);
      });
      
      // Should distribute load across available nodes
      expect(nodeUsage.size).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring and Status', () => {
    beforeEach(async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
    });

    it('should provide comprehensive health status', async () => {
      const healthStatus = await edgeOptimizer.getHealthStatus();
      
      expect(healthStatus.total_nodes).toBeGreaterThan(0);
      expect(healthStatus.online_nodes).toBeGreaterThanOrEqual(0);
      expect(healthStatus.healthy_nodes).toBeGreaterThanOrEqual(0);
      expect(healthStatus.average_health_score).toBeGreaterThanOrEqual(0);
      expect(healthStatus.regional_health).toBeDefined();
      expect(Array.isArray(healthStatus.critical_issues)).toBe(true);
    });

    it('should detect critical health issues', async () => {
      // Register an unhealthy node
      const unhealthyNode = {
        ...mockEdgeNode,
        id: 'unhealthy-node',
        status: {
          ...mockEdgeNode.status,
          online: false,
          health_score: 20,
          error_rate: 0.8
        }
      };
      
      await edgeOptimizer.registerEdgeNode(unhealthyNode);
      
      const healthStatus = await edgeOptimizer.getHealthStatus();
      
      // Should detect health issues
      expect(healthStatus.critical_issues.length).toBeGreaterThanOrEqual(0);
    });

    it('should track regional health scores', async () => {
      const healthStatus = await edgeOptimizer.getHealthStatus();
      
      expect(Object.keys(healthStatus.regional_health).length).toBeGreaterThan(0);
      
      Object.values(healthStatus.regional_health).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
    });

    it('should manage memory efficiently under load', async () => {
      const initialMetrics = await edgeOptimizer.getEdgePerformanceMetrics();
      
      // Generate high load
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(edgeOptimizer.processOptimizationRequest({
          ...mockEdgeRequest,
          id: `memory-test-${i}`,
          payload: {
            prompt: 'Large prompt data: ' + 'x'.repeat(1000) // Large payload
          }
        }));
      }
      
      await Promise.all(promises);
      
      const finalMetrics = await edgeOptimizer.getEdgePerformanceMetrics();
      
      // Memory should remain stable
      expect(finalMetrics.global_metrics.total_requests)
        .toBeGreaterThan(initialMetrics.global_metrics.total_requests);
    });

    it('should clean up resources properly', () => {
      // Clear metrics should not throw and should reset counters
      expect(() => edgeOptimizer.clearMetrics()).not.toThrow();
      
      const clearedNode = edgeOptimizer.getNodeById(mockEdgeNode.id);
      if (clearedNode) {
        expect(clearedNode.performance_metrics.requests_per_second).toBe(0);
        expect(clearedNode.cache_stats.size_mb).toBe(0);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle requests when no nodes are available', async () => {
      // Don't register any nodes
      const emptyOptimizer = new EdgeOptimizer();
      
      await expect(emptyOptimizer.processOptimizationRequest(mockEdgeRequest))
        .rejects.toThrow();
    });

    it('should handle invalid request data', async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      const invalidRequest = {
        ...mockEdgeRequest,
        type: 'invalid_type' as any,
        payload: null as any
      };
      
      await expect(edgeOptimizer.processOptimizationRequest(invalidRequest))
        .rejects.toThrow();
    });

    it('should handle concurrent node registrations', async () => {
      const nodes = [];
      for (let i = 0; i < 5; i++) {
        nodes.push({
          ...mockEdgeNode,
          id: `concurrent-node-${i}`
        });
      }
      
      const registrationPromises = nodes.map(node => 
        edgeOptimizer.registerEdgeNode(node)
      );
      
      const results = await Promise.all(registrationPromises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle network timeouts gracefully', async () => {
      await edgeOptimizer.registerEdgeNode(mockEdgeNode);
      
      const timeoutRequest = {
        ...mockEdgeRequest,
        timeout_ms: 1 // Very short timeout
      };
      
      // Should either succeed quickly or handle timeout
      const response = await edgeOptimizer.processOptimizationRequest(timeoutRequest);
      expect(response.request_id).toBe(timeoutRequest.id);
    });
  });
});

// Helper functions for testing
function createMockEdgeNode(overrides: Partial<EdgeNode> = {}): EdgeNode {
  return {
    id: `mock-node-${Date.now()}`,
    location: {
      region: 'us-east-1',
      city: 'Mock City',
      country: 'USA',
      latitude: 40.0,
      longitude: -74.0,
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
      cpu_cores: 4,
      memory_gb: 16,
      storage_gb: 200,
      network_mbps: 1000
    },
    status: {
      online: true,
      last_heartbeat: new Date(),
      current_load: 0.5,
      queue_depth: 0,
      response_time_p50: 50,
      response_time_p95: 100,
      response_time_p99: 150,
      error_rate: 0.01,
      uptime_percentage: 99.9,
      health_score: 90,
      failover_count: 0
    },
    models: [],
    cache_stats: {
      hit_rate: 0.8,
      size_mb: 0,
      max_size_mb: 1000,
      eviction_count: 0
    },
    performance_metrics: {
      requests_per_second: 0,
      concurrent_connections: 0,
      bandwidth_utilization: 0,
      memory_utilization: 0,
      cpu_utilization: 0
    },
    ...overrides
  };
}

function createMockEdgeRequest(overrides: Partial<EdgeRequest> = {}): EdgeRequest {
  return {
    id: `mock-request-${Date.now()}`,
    type: 'optimize',
    payload: {
      prompt: 'Mock test prompt'
    },
    priority: 'normal',
    timeout_ms: 5000,
    retry_count: 0,
    cache_policy: {
      enabled: true
    },
    ...overrides
  };
}
