import { EdgeOptimizer, EdgeNode, EdgeRequest } from '../../services/edge/EdgeOptimizer';
import { EventStore } from '../../services/analytics/EventStore';

describe('EdgeOptimizer', () => {
  let edgeOptimizer: EdgeOptimizer;
  let mockEventStore: jest.Mocked<EventStore>;

  beforeEach(() => {
    // Mock EventStore
    mockEventStore = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
      getEvents: jest.fn().mockResolvedValue([]),
      getInstance: jest.fn()
    } as any;

    // Mock EventStore.getInstance
    jest.spyOn(EventStore, 'getInstance').mockReturnValue(mockEventStore);

    edgeOptimizer = new EdgeOptimizer();
  });

  afterEach(() => {
    jest.clearAllMocks();
    edgeOptimizer.clearMetrics();
  });

  describe('registerEdgeNode', () => {
    const mockNode: EdgeNode = {
      id: 'test-node-1',
      location: {
        region: 'us-east',
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
        vector_search: false,
        caching: true,
        compression: true,
        load_balancing: true
      },
      resources: {
        cpu_cores: 4,
        memory_gb: 8,
        storage_gb: 100,
        network_mbps: 1000
      },
      status: {
        online: true,
        last_heartbeat: new Date(),
        current_load: 0,
        queue_depth: 0,
        response_time_p50: 0,
        response_time_p95: 0,
        response_time_p99: 0,
        error_rate: 0,
        uptime_percentage: 100,
        health_score: 100,
        failover_count: 0
      },
      models: [],
      cache_stats: {
        hit_rate: 0,
        size_mb: 0,
        max_size_mb: 1024,
        eviction_count: 0
      },
      performance_metrics: {
        requests_per_second: 0,
        concurrent_connections: 0,
        bandwidth_utilization: 0,
        memory_utilization: 0,
        cpu_utilization: 0
      }
    };

    it('should successfully register a valid edge node', async () => {
      const result = await edgeOptimizer.registerEdgeNode(mockNode);

      expect(result.success).toBe(true);
      expect(result.node_id).toBe(mockNode.id);
      expect(result.initial_health_score).toBeGreaterThan(0);
      expect(result.assigned_workloads).toBeInstanceOf(Array);
      expect(mockEventStore.recordEvent).toHaveBeenCalled();
    });

    it('should reject node with insufficient resources', async () => {
      const invalidNode = {
        ...mockNode,
        resources: {
          ...mockNode.resources,
          memory_gb: 1 // Below minimum
        }
      };

      await expect(edgeOptimizer.registerEdgeNode(invalidNode))
        .rejects.toThrow('insufficient memory');
    });

    it('should reject node with missing required capabilities', async () => {
      const invalidNode = {
        ...mockNode,
        capabilities: {
          ...mockNode.capabilities,
          prompt_optimization: false,
          caching: false
        }
      };

      await expect(edgeOptimizer.registerEdgeNode(invalidNode))
        .rejects.toThrow('missing required capabilities');
    });

    it('should assign appropriate workloads based on capabilities', async () => {
      const result = await edgeOptimizer.registerEdgeNode(mockNode);
      
      expect(result.assigned_workloads).toContain('prompt_optimization');
      expect(result.assigned_workloads).toContain('semantic_analysis');
      expect(result.assigned_workloads).not.toContain('vector_search'); // Not enabled
    });
  });

  describe('processOptimizationRequest', () => {
    const mockRequest: EdgeRequest = {
      id: 'req-123',
      type: 'optimize',
      payload: {
        prompt: 'Test prompt for optimization',
        target_metrics: {
          max_latency_ms: 100,
          min_quality_score: 0.8
        }
      },
      priority: 'normal',
      timeout_ms: 30000,
      retry_count: 0,
      cache_policy: {
        enabled: true,
        ttl_minutes: 15
      }
    };

    beforeEach(async () => {
      // Register a test node first
      const testNode: EdgeNode = {
        id: 'test-node-1',
        location: {
          region: 'us-east',
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
          cpu_cores: 4,
          memory_gb: 8,
          storage_gb: 100,
          network_mbps: 1000
        },
        status: {
          online: true,
          last_heartbeat: new Date(),
          current_load: 0.2,
          queue_depth: 0,
          response_time_p50: 50,
          response_time_p95: 80,
          response_time_p99: 120,
          error_rate: 0.01,
          uptime_percentage: 99.5,
          health_score: 95,
          failover_count: 0
        },
        models: [],
        cache_stats: {
          hit_rate: 0.75,
          size_mb: 100,
          max_size_mb: 1024,
          eviction_count: 5
        },
        performance_metrics: {
          requests_per_second: 50,
          concurrent_connections: 10,
          bandwidth_utilization: 0.3,
          memory_utilization: 0.4,
          cpu_utilization: 0.2
        }
      };

      await edgeOptimizer.registerEdgeNode(testNode);
    });

    it('should process optimization request successfully', async () => {
      const response = await edgeOptimizer.processOptimizationRequest(mockRequest);

      expect(response.request_id).toBe(mockRequest.id);
      expect(response.result).toBeDefined();
      expect(response.metadata.node_id).toBeDefined();
      expect(response.metadata.processing_time_ms).toBeGreaterThan(0);
      expect(response.performance.total_latency_ms).toBeGreaterThan(0);
      expect(response.cost_metrics.total_cost).toBeGreaterThan(0);
    });

    it('should return cached result when available', async () => {
      // First request
      const firstResponse = await edgeOptimizer.processOptimizationRequest(mockRequest);
      
      // Second identical request should hit cache
      const secondResponse = await edgeOptimizer.processOptimizationRequest(mockRequest);
      
      expect(secondResponse.metadata.cache_hit).toBe(true);
      expect(secondResponse.performance.total_latency_ms).toBeLessThan(firstResponse.performance.total_latency_ms);
    });

    it('should handle different request types', async () => {
      const analyzeRequest = {
        ...mockRequest,
        type: 'analyze' as const,
        payload: {
          prompt: 'Analyze this prompt for sentiment and complexity'
        }
      };

      const response = await edgeOptimizer.processOptimizationRequest(analyzeRequest);
      
      expect(response.result).toBeDefined();
      expect(response.metadata.node_id).toBeDefined();
    });

    it('should fallback to cloud when no edge nodes available', async () => {
      // Remove all nodes
      edgeOptimizer.clearMetrics();
      
      const response = await edgeOptimizer.processOptimizationRequest(mockRequest);
      
      expect(response.metadata.node_id).toBe('cloud-fallback');
      expect(response.routing_info.failover_used).toBe(true);
      expect(response.performance.total_latency_ms).toBeGreaterThan(100); // Cloud latency
    });

    it('should handle client location for geographic routing', async () => {
      const requestWithLocation = {
        ...mockRequest,
        client_location: {
          latitude: 40.7589,
          longitude: -73.9851,
          ip: '192.168.1.1'
        }
      };

      const response = await edgeOptimizer.processOptimizationRequest(requestWithLocation);
      
      expect(response.routing_info.geographic_distance_km).toBeDefined();
      expect(response.routing_info.geographic_distance_km).toBeGreaterThanOrEqual(0);
    });
  });

  describe('coordinateDistributedWorkload', () => {
    const mockWorkload = {
      id: 'workload-123',
      type: 'batch_optimization' as const,
      priority: 1,
      estimated_duration_ms: 60000,
      resource_requirements: {
        cpu_cores: 2,
        memory_gb: 4,
        storage_gb: 10,
        network_mbps: 100
      },
      payload: {
        prompts: ['prompt1', 'prompt2', 'prompt3']
      },
      constraints: {
        max_latency_ms: 5000,
        preferred_regions: ['us-east'],
        security_level: 'basic' as const
      },
      dependencies: [],
      status: 'pending' as const,
      assigned_nodes: [],
      progress: 0
    };

    beforeEach(async () => {
      // Register multiple test nodes
      const nodes = [
        {
          id: 'node-1',
          location: { region: 'us-east', city: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 4, memory_gb: 8, storage_gb: 100, network_mbps: 1000 },
          status: { online: true, last_heartbeat: new Date(), current_load: 0.1, queue_depth: 0, response_time_p50: 30, response_time_p95: 50, response_time_p99: 80, error_rate: 0.005, uptime_percentage: 99.8, health_score: 98, failover_count: 0 },
          models: [], cache_stats: { hit_rate: 0.8, size_mb: 50, max_size_mb: 1024, eviction_count: 2 },
          performance_metrics: { requests_per_second: 30, concurrent_connections: 5, bandwidth_utilization: 0.2, memory_utilization: 0.3, cpu_utilization: 0.1 }
        },
        {
          id: 'node-2',
          location: { region: 'us-east', city: 'Boston', country: 'USA', latitude: 42.3601, longitude: -71.0589, timezone: 'America/New_York' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 6, memory_gb: 12, storage_gb: 200, network_mbps: 1000 },
          status: { online: true, last_heartbeat: new Date(), current_load: 0.2, queue_depth: 1, response_time_p50: 40, response_time_p95: 60, response_time_p99: 90, error_rate: 0.01, uptime_percentage: 99.5, health_score: 95, failover_count: 0 },
          models: [], cache_stats: { hit_rate: 0.75, size_mb: 80, max_size_mb: 1536, eviction_count: 3 },
          performance_metrics: { requests_per_second: 45, concurrent_connections: 8, bandwidth_utilization: 0.25, memory_utilization: 0.35, cpu_utilization: 0.2 }
        }
      ] as EdgeNode[];

      for (const node of nodes) {
        await edgeOptimizer.registerEdgeNode(node);
      }
    });

    it('should coordinate workload across multiple nodes', async () => {
      const result = await edgeOptimizer.coordinateDistributedWorkload(mockWorkload);

      expect(result.workload_id).toBe(mockWorkload.id);
      expect(result.assigned_nodes.length).toBeGreaterThan(0);
      expect(result.estimated_completion).toBeInstanceOf(Date);
      expect(result.coordination_strategy).toBeDefined();
      expect(result.resource_allocation).toBeDefined();
    });

    it('should prefer nodes in specified regions', async () => {
      const result = await edgeOptimizer.coordinateDistributedWorkload(mockWorkload);

      // Verify nodes are from preferred region
      const assignedNodes = result.assigned_nodes;
      for (const nodeId of assignedNodes) {
        const node = edgeOptimizer.getNodeById(nodeId);
        expect(node?.location.region).toBe('us-east');
      }
    });

    it('should handle workload with no suitable nodes', async () => {
      const impossibleWorkload = {
        ...mockWorkload,
        resource_requirements: {
          cpu_cores: 100, // Impossible requirement
          memory_gb: 1000,
          storage_gb: 10000,
          network_mbps: 100000
        }
      };

      await expect(edgeOptimizer.coordinateDistributedWorkload(impossibleWorkload))
        .rejects.toThrow('No nodes available with required capabilities');
    });
  });

  describe('synchronizeWithCloud', () => {
    beforeEach(async () => {
      // Register test nodes
      const testNode: EdgeNode = {
        id: 'sync-test-node',
        location: { region: 'us-west', city: 'San Francisco', country: 'USA', latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles' },
        capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
        resources: { cpu_cores: 8, memory_gb: 16, storage_gb: 500, network_mbps: 10000 },
        status: { online: true, last_heartbeat: new Date(), current_load: 0.15, queue_depth: 0, response_time_p50: 25, response_time_p95: 45, response_time_p99: 70, error_rate: 0.002, uptime_percentage: 99.9, health_score: 99, failover_count: 0 },
        models: [], cache_stats: { hit_rate: 0.85, size_mb: 200, max_size_mb: 2048, eviction_count: 1 },
        performance_metrics: { requests_per_second: 80, concurrent_connections: 15, bandwidth_utilization: 0.3, memory_utilization: 0.25, cpu_utilization: 0.15 }
      };

      await edgeOptimizer.registerEdgeNode(testNode);
    });

    it('should synchronize with cloud successfully', async () => {
      const result = await edgeOptimizer.synchronizeWithCloud();

      expect(result.synchronized_nodes.length).toBeGreaterThan(0);
      expect(result.failed_nodes.length).toBeDefined();
      expect(result.sync_duration_ms).toBeGreaterThan(0);
      expect(result.data_transferred_mb).toBeGreaterThanOrEqual(0);
      expect(result.performance_improvements).toBeDefined();
    });

    it('should handle partial synchronization failures gracefully', async () => {
      // Mock a scenario where some nodes might fail sync
      const result = await edgeOptimizer.synchronizeWithCloud();

      expect(result.synchronized_nodes.length + result.failed_nodes.length).toBeGreaterThanOrEqual(0);
      expect(result.sync_duration_ms).toBeGreaterThan(0);
    });

    it('should update performance improvements after sync', async () => {
      const result = await edgeOptimizer.synchronizeWithCloud();

      expect(typeof result.performance_improvements).toBe('object');
      // Should have performance improvement data for synchronized nodes
      for (const nodeId of result.synchronized_nodes) {
        expect(result.performance_improvements[nodeId]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getEdgePerformanceMetrics', () => {
    beforeEach(async () => {
      // Register nodes and generate some test events
      const testNode: EdgeNode = {
        id: 'metrics-test-node',
        location: { region: 'eu-west', city: 'London', country: 'UK', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
        capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
        resources: { cpu_cores: 6, memory_gb: 12, storage_gb: 300, network_mbps: 5000 },
        status: { online: true, last_heartbeat: new Date(), current_load: 0.3, queue_depth: 2, response_time_p50: 35, response_time_p95: 65, response_time_p99: 95, error_rate: 0.008, uptime_percentage: 99.2, health_score: 92, failover_count: 1 },
        models: [], cache_stats: { hit_rate: 0.7, size_mb: 150, max_size_mb: 1536, eviction_count: 8 },
        performance_metrics: { requests_per_second: 60, concurrent_connections: 12, bandwidth_utilization: 0.4, memory_utilization: 0.45, cpu_utilization: 0.3 }
      };

      await edgeOptimizer.registerEdgeNode(testNode);

      // Mock some request events
      mockEventStore.getEvents.mockResolvedValue([
        {
          event_type: 'edge_request_successful',
          entity_id: 'req-1',
          data: {
            node_id: 'metrics-test-node',
            total_latency_ms: 45,
            success: true,
            cache_hit: false,
            geographic_info: { node_region: 'eu-west' }
          },
          timestamp: new Date()
        },
        {
          event_type: 'edge_request_successful',
          entity_id: 'req-2',
          data: {
            node_id: 'metrics-test-node',
            total_latency_ms: 38,
            success: true,
            cache_hit: true,
            geographic_info: { node_region: 'eu-west' }
          },
          timestamp: new Date()
        }
      ]);
    });

    it('should return comprehensive performance metrics', async () => {
      const metrics = await edgeOptimizer.getEdgePerformanceMetrics();

      expect(metrics.global_metrics).toBeDefined();
      expect(metrics.global_metrics.total_requests).toBeGreaterThanOrEqual(0);
      expect(metrics.global_metrics.cache_hit_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.global_metrics.average_latency_ms).toBeGreaterThanOrEqual(0);

      expect(metrics.node_metrics).toBeDefined();
      expect(typeof metrics.node_metrics).toBe('object');

      expect(metrics.regional_performance).toBeDefined();
      expect(typeof metrics.regional_performance).toBe('object');

      expect(metrics.optimization_insights).toBeDefined();
      expect(metrics.optimization_insights.recommendations).toBeInstanceOf(Array);
      expect(metrics.optimization_insights.bottlenecks).toBeInstanceOf(Array);
    });

    it('should include node-specific metrics', async () => {
      const metrics = await edgeOptimizer.getEdgePerformanceMetrics();

      expect(metrics.node_metrics['metrics-test-node']).toBeDefined();
      const nodeMetrics = metrics.node_metrics['metrics-test-node'];
      
      expect(nodeMetrics.health_score).toBe(92);
      expect(nodeMetrics.current_load).toBe(0.3);
      expect(nodeMetrics.cache_hit_rate).toBe(0.7);
      expect(nodeMetrics.resource_utilization).toBeDefined();
    });

    it('should provide optimization recommendations', async () => {
      const metrics = await edgeOptimizer.getEdgePerformanceMetrics();

      expect(metrics.optimization_insights.recommendations).toBeInstanceOf(Array);
      expect(metrics.optimization_insights.bottlenecks).toBeInstanceOf(Array);
      expect(metrics.optimization_insights.cost_optimization_opportunities).toBeInstanceOf(Array);
    });
  });

  describe('handleNodeFailure', () => {
    let failingNodeId: string;

    beforeEach(async () => {
      // Register multiple nodes to test failover
      const nodes = [
        {
          id: 'failing-node',
          location: { region: 'ap-southeast', city: 'Singapore', country: 'Singapore', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 4, memory_gb: 8, storage_gb: 200, network_mbps: 2000 },
          status: { online: true, last_heartbeat: new Date(), current_load: 0.6, queue_depth: 5, response_time_p50: 80, response_time_p95: 150, response_time_p99: 200, error_rate: 0.05, uptime_percentage: 95, health_score: 70, failover_count: 2 },
          models: [], cache_stats: { hit_rate: 0.6, size_mb: 120, max_size_mb: 1024, eviction_count: 15 },
          performance_metrics: { requests_per_second: 40, concurrent_connections: 20, bandwidth_utilization: 0.6, memory_utilization: 0.7, cpu_utilization: 0.6 }
        },
        {
          id: 'backup-node',
          location: { region: 'ap-southeast', city: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 6, memory_gb: 12, storage_gb: 300, network_mbps: 3000 },
          status: { online: true, last_heartbeat: new Date(), current_load: 0.2, queue_depth: 1, response_time_p50: 40, response_time_p95: 70, response_time_p99: 100, error_rate: 0.01, uptime_percentage: 99.5, health_score: 95, failover_count: 0 },
          models: [], cache_stats: { hit_rate: 0.8, size_mb: 80, max_size_mb: 1536, eviction_count: 3 },
          performance_metrics: { requests_per_second: 25, concurrent_connections: 8, bandwidth_utilization: 0.25, memory_utilization: 0.3, cpu_utilization: 0.2 }
        }
      ] as EdgeNode[];

      for (const node of nodes) {
        await edgeOptimizer.registerEdgeNode(node);
      }

      failingNodeId = 'failing-node';
    });

    it('should handle network failure gracefully', async () => {
      const result = await edgeOptimizer.handleNodeFailure(failingNodeId, 'network');

      expect(result.failover_completed).toBe(true);
      expect(result.replacement_nodes.length).toBeGreaterThan(0);
      expect(result.migrated_workloads).toBeInstanceOf(Array);
      expect(result.failover_time_ms).toBeGreaterThan(0);
      expect(result.data_loss_prevented).toBe(true);
      expect(result.recovery_strategy).toBe('network_recovery');
    });

    it('should handle hardware failure with replacement', async () => {
      const result = await edgeOptimizer.handleNodeFailure(failingNodeId, 'hardware');

      expect(result.failover_completed).toBe(true);
      expect(result.recovery_strategy).toBe('hardware_replacement');
      expect(result.replacement_nodes.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle software failure with restart strategy', async () => {
      const result = await edgeOptimizer.handleNodeFailure(failingNodeId, 'software');

      expect(result.failover_completed).toBe(true);
      expect(result.recovery_strategy).toBe('software_restart');
    });

    it('should handle overload with load balancing', async () => {
      const result = await edgeOptimizer.handleNodeFailure(failingNodeId, 'overload');

      expect(result.failover_completed).toBe(true);
      expect(result.recovery_strategy).toBe('load_balancing');
      expect(result.replacement_nodes.length).toBeGreaterThan(0);
    });

    it('should update node status after failure', async () => {
      await edgeOptimizer.handleNodeFailure(failingNodeId, 'network');

      const failedNode = edgeOptimizer.getNodeById(failingNodeId);
      expect(failedNode?.status.online).toBe(false);
      expect(failedNode?.status.failover_count).toBeGreaterThan(2);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      const testNode: EdgeNode = {
        id: 'utility-test-node',
        location: { region: 'us-central', city: 'Chicago', country: 'USA', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago' },
        capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: false, vector_search: true, caching: true, compression: false, load_balancing: true },
        resources: { cpu_cores: 2, memory_gb: 4, storage_gb: 50, network_mbps: 500 },
        status: { online: true, last_heartbeat: new Date(), current_load: 0.1, queue_depth: 0, response_time_p50: 60, response_time_p95: 100, response_time_p99: 150, error_rate: 0.02, uptime_percentage: 98, health_score: 85, failover_count: 0 },
        models: [], cache_stats: { hit_rate: 0.65, size_mb: 30, max_size_mb: 512, eviction_count: 10 },
        performance_metrics: { requests_per_second: 20, concurrent_connections: 5, bandwidth_utilization: 0.2, memory_utilization: 0.4, cpu_utilization: 0.1 }
      };

      await edgeOptimizer.registerEdgeNode(testNode);
    });

    it('should list all nodes', () => {
      const nodes = edgeOptimizer.listNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].id).toBe('utility-test-node');
    });

    it('should list only online nodes', () => {
      const onlineNodes = edgeOptimizer.listOnlineNodes();
      expect(onlineNodes.length).toBe(1);
      expect(onlineNodes[0].status.online).toBe(true);
    });

    it('should get node by ID', () => {
      const node = edgeOptimizer.getNodeById('utility-test-node');
      expect(node).toBeDefined();
      expect(node?.id).toBe('utility-test-node');
    });

    it('should return undefined for non-existent node', () => {
      const node = edgeOptimizer.getNodeById('non-existent-node');
      expect(node).toBeUndefined();
    });

    it('should remove node successfully', async () => {
      const removed = await edgeOptimizer.removeNode('utility-test-node');
      expect(removed).toBe(true);
      
      const node = edgeOptimizer.getNodeById('utility-test-node');
      expect(node).toBeUndefined();
    });

    it('should return false when removing non-existent node', async () => {
      const removed = await edgeOptimizer.removeNode('non-existent-node');
      expect(removed).toBe(false);
    });

    it('should clear metrics', () => {
      edgeOptimizer.clearMetrics();
      
      const nodes = edgeOptimizer.listNodes();
      expect(nodes.length).toBe(0);
    });
  });

  describe('performance and stress testing', () => {
    const createMockNode = (id: string, region: string): EdgeNode => ({
      id,
      location: { region, city: 'Test City', country: 'Test Country', latitude: 0, longitude: 0, timezone: 'UTC' },
      capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
      resources: { cpu_cores: 4, memory_gb: 8, storage_gb: 100, network_mbps: 1000 },
      status: { online: true, last_heartbeat: new Date(), current_load: Math.random() * 0.5, queue_depth: 0, response_time_p50: 30 + Math.random() * 20, response_time_p95: 50 + Math.random() * 30, response_time_p99: 80 + Math.random() * 40, error_rate: Math.random() * 0.02, uptime_percentage: 95 + Math.random() * 5, health_score: 80 + Math.random() * 20, failover_count: 0 },
      models: [], cache_stats: { hit_rate: 0.6 + Math.random() * 0.3, size_mb: Math.random() * 200, max_size_mb: 1024, eviction_count: Math.floor(Math.random() * 20) },
      performance_metrics: { requests_per_second: Math.random() * 100, concurrent_connections: Math.floor(Math.random() * 20), bandwidth_utilization: Math.random() * 0.5, memory_utilization: Math.random() * 0.6, cpu_utilization: Math.random() * 0.4 }
    });

    it('should handle multiple node registrations efficiently', async () => {
      const nodeCount = 50;
      const registrationPromises = [];

      for (let i = 0; i < nodeCount; i++) {
        const node = createMockNode(`stress-node-${i}`, `region-${i % 5}`);
        registrationPromises.push(edgeOptimizer.registerEdgeNode(node));
      }

      const results = await Promise.all(registrationPromises);
      
      expect(results.length).toBe(nodeCount);
      expect(results.every(r => r.success)).toBe(true);
      expect(edgeOptimizer.listNodes().length).toBe(nodeCount);
    });

    it('should handle concurrent optimization requests', async () => {
      // Register some nodes first
      for (let i = 0; i < 5; i++) {
        const node = createMockNode(`concurrent-node-${i}`, 'us-east');
        await edgeOptimizer.registerEdgeNode(node);
      }

      const requestCount = 20;
      const requestPromises = [];

      for (let i = 0; i < requestCount; i++) {
        const request: EdgeRequest = {
          id: `concurrent-req-${i}`,
          type: 'optimize',
          payload: { prompt: `Test prompt ${i} for concurrent processing` },
          priority: 'normal',
          timeout_ms: 30000,
          retry_count: 0,
          cache_policy: { enabled: true, ttl_minutes: 10 }
        };
        
        requestPromises.push(edgeOptimizer.processOptimizationRequest(request));
      }

      const responses = await Promise.all(requestPromises);
      
      expect(responses.length).toBe(requestCount);
      expect(responses.every(r => r.request_id.startsWith('concurrent-req-'))).toBe(true);
      expect(responses.every(r => r.performance.total_latency_ms > 0)).toBe(true);
    });

    it('should maintain performance under load', async () => {
      // Register nodes
      for (let i = 0; i < 10; i++) {
        const node = createMockNode(`load-node-${i}`, 'us-west');
        await edgeOptimizer.registerEdgeNode(node);
      }

      const startTime = performance.now();
      const requestCount = 100;
      const batchSize = 10;
      
      // Process requests in batches to simulate realistic load
      for (let batch = 0; batch < requestCount / batchSize; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const request: EdgeRequest = {
            id: `load-req-${batch}-${i}`,
            type: 'optimize',
            payload: { prompt: `Load test prompt ${batch}-${i}` },
            priority: 'normal',
            timeout_ms: 30000,
            retry_count: 0,
            cache_policy: { enabled: true }
          };
          
          batchPromises.push(edgeOptimizer.processOptimizationRequest(request));
        }
        
        await Promise.all(batchPromises);
      }

      const totalTime = performance.now() - startTime;
      const avgTimePerRequest = totalTime / requestCount;
      
      // Performance assertion - should process requests efficiently
      expect(avgTimePerRequest).toBeLessThan(1000); // Less than 1 second per request on average
      expect(totalTime).toBeLessThan(60000); // Complete within 1 minute
    });
  });
});