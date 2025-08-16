import request from 'supertest';
import express from 'express';
import { edgeComputingService } from '../../services/edge';
import edgeOptimizationRoutes from '../../routes/edge-optimization';
import { EventStore } from '../../services/analytics/EventStore';

// Mock EventStore
jest.mock('../../services/analytics/EventStore');

describe('Edge Computing Integration Tests', () => {
  let app: express.Application;
  let mockEventStore: jest.Mocked<EventStore>;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/edge-optimization', edgeOptimizationRoutes);

    // Mock EventStore
    mockEventStore = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
      getEvents: jest.fn().mockResolvedValue([]),
      getInstance: jest.fn()
    } as any;

    (EventStore.getInstance as jest.Mock).mockReturnValue(mockEventStore);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup after each test
    edgeComputingService.cleanup();
  });

  describe('POST /api/edge-optimization/optimize', () => {
    it('should process optimization request successfully', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize')
        .send({
          prompt: 'Optimize this prompt for better performance and clarity',
          target_metrics: {
            max_latency_ms: 500,
            min_quality_score: 0.8
          },
          cache_policy: {
            enabled: true,
            ttl_minutes: 15
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.optimization_result).toBeDefined();
      expect(response.body.edge_metadata).toBeDefined();
      expect(response.body.performance_metrics).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle optimization with client location', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize')
        .send({
          prompt: 'Test prompt with location context',
          client_location: {
            latitude: 40.7128,
            longitude: -74.0060
          },
          user_id: 'test-user-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.edge_metadata.geographic_distance_km).toBeGreaterThanOrEqual(0);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize')
        .send({
          // Missing required prompt field
          target_metrics: {
            max_latency_ms: 500
          }
        });

      expect(response.status).toBe(400);
    });

    it('should validate prompt length', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize')
        .send({
          prompt: 'short' // Too short
        });

      expect(response.status).toBe(400);
    });

    it('should validate location coordinates', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize')
        .send({
          prompt: 'Test prompt with invalid location',
          client_location: {
            latitude: 200, // Invalid latitude
            longitude: -74.0060
          }
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/edge-optimization/nodes/register', () => {
    const validNodeConfig = {
      id: 'test-edge-node-1',
      endpoint: 'https://edge1.example.com:8080',
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
      }
    };

    it('should register edge node successfully', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/nodes/register')
        .send(validNodeConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.node_id).toBe(validNodeConfig.id);
      expect(response.body.registration_details).toBeDefined();
      expect(response.body.estimated_capacity_contribution).toBeGreaterThan(0);
    });

    it('should validate node configuration', async () => {
      const invalidConfig = {
        ...validNodeConfig,
        resources: {
          ...validNodeConfig.resources,
          memory_gb: 1 // Below minimum
        }
      };

      const response = await request(app)
        .post('/api/edge-optimization/nodes/register')
        .send(invalidConfig);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should validate required capabilities', async () => {
      const invalidConfig = {
        ...validNodeConfig,
        capabilities: {
          ...validNodeConfig.capabilities,
          prompt_optimization: false // Required capability
        }
      };

      const response = await request(app)
        .post('/api/edge-optimization/nodes/register')
        .send(invalidConfig);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should validate geographic coordinates', async () => {
      const invalidConfig = {
        ...validNodeConfig,
        location: {
          ...validNodeConfig.location,
          latitude: 200 // Invalid
        }
      };

      const response = await request(app)
        .post('/api/edge-optimization/nodes/register')
        .send(invalidConfig);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/edge-optimization/analytics', () => {
    beforeEach(async () => {
      // Register a test node to have some data
      await edgeComputingService.registerEdgeNode({
        id: 'analytics-test-node',
        endpoint: 'https://analytics-node.example.com:8080',
        location: {
          region: 'us-west',
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
          cpu_cores: 6,
          memory_gb: 12,
          storage_gb: 200,
          network_mbps: 2000
        }
      });

      // Mock some analytics data
      mockEventStore.getEvents.mockResolvedValue([
        {
          event_type: 'edge_request_successful',
          entity_id: 'req-1',
          data: {
            node_id: 'analytics-test-node',
            total_latency_ms: 45,
            success: true,
            cache_hit: false,
            geographic_info: { node_region: 'us-west' }
          },
          timestamp: new Date()
        }
      ]);
    });

    it('should return comprehensive analytics', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/analytics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
      expect(response.body.analytics.edge_performance).toBeDefined();
      expect(response.body.analytics.node_management).toBeDefined();
      expect(response.body.analytics.cache_analytics).toBeDefined();
      expect(response.body.analytics.optimization_insights).toBeDefined();
    });

    it('should handle date range filtering', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/edge-optimization/analytics')
        .query({
          start_date: startDate,
          end_date: endDate
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/edge-optimization/optimize-infrastructure', () => {
    beforeEach(async () => {
      // Register test nodes for infrastructure optimization
      const nodes = [
        {
          id: 'infra-opt-node-1',
          endpoint: 'https://node1.example.com:8080',
          location: { region: 'us-east', city: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 4, memory_gb: 8, storage_gb: 100, network_mbps: 1000 }
        },
        {
          id: 'infra-opt-node-2',
          endpoint: 'https://node2.example.com:8080',
          location: { region: 'eu-west', city: 'London', country: 'UK', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 6, memory_gb: 12, storage_gb: 200, network_mbps: 1500 }
        }
      ];

      for (const node of nodes) {
        await edgeComputingService.registerEdgeNode(node);
      }
    });

    it('should optimize infrastructure successfully', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize-infrastructure');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.optimization_results).toBeDefined();
      expect(response.body.optimization_results.cache_optimization).toBeDefined();
      expect(response.body.optimization_results.node_optimization).toBeDefined();
      expect(response.body.optimization_results.overall_improvements).toBeDefined();
      expect(response.body.optimization_results.implementation_timeline).toBeDefined();
    });

    it('should include performance improvements in results', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize-infrastructure');

      expect(response.status).toBe(200);
      const improvements = response.body.optimization_results.overall_improvements;
      expect(improvements.latency_reduction_percentage).toBeGreaterThanOrEqual(0);
      expect(improvements.cost_savings_percentage).toBeGreaterThanOrEqual(0);
      expect(improvements.reliability_improvement).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/edge-optimization/simulate-deployment', () => {
    const validSimulationConfig = {
      node_count: 10,
      regions: ['us-east', 'us-west', 'eu-west'],
      workload_types: ['optimization', 'analysis', 'inference'],
      traffic_pattern: 'medium'
    };

    it('should simulate deployment successfully', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/simulate-deployment')
        .send(validSimulationConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.simulation_results).toBeDefined();
      expect(response.body.simulation_results.deployment_plan).toBeDefined();
      expect(response.body.simulation_results.performance_projections).toBeDefined();
      expect(response.body.simulation_results.scaling_recommendations).toBeDefined();
    });

    it('should validate simulation parameters', async () => {
      const invalidConfig = {
        ...validSimulationConfig,
        node_count: 0 // Invalid
      };

      const response = await request(app)
        .post('/api/edge-optimization/simulate-deployment')
        .send(invalidConfig);

      expect(response.status).toBe(400);
    });

    it('should handle different traffic patterns', async () => {
      const configs = ['low', 'medium', 'high', 'burst'];
      
      for (const pattern of configs) {
        const response = await request(app)
          .post('/api/edge-optimization/simulate-deployment')
          .send({
            ...validSimulationConfig,
            traffic_pattern: pattern
          });

        expect(response.status).toBe(200);
        expect(response.body.simulation_results.performance_projections).toBeDefined();
      }
    });
  });

  describe('GET /api/edge-optimization/status', () => {
    beforeEach(async () => {
      // Register a test node
      await edgeComputingService.registerEdgeNode({
        id: 'status-test-node',
        endpoint: 'https://status-node.example.com:8080',
        location: {
          region: 'ap-southeast',
          city: 'Singapore',
          country: 'Singapore',
          latitude: 1.3521,
          longitude: 103.8198,
          timezone: 'Asia/Singapore'
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
          memory_gb: 16,
          storage_gb: 300,
          network_mbps: 3000
        }
      });
    });

    it('should return system status', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.system_status).toBeDefined();
      expect(response.body.system_status.overall_health).toBeDefined();
      expect(response.body.system_status.components).toBeDefined();
      expect(response.body.system_status.resource_utilization).toBeDefined();
    });

    it('should include component health status', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/status');

      const components = response.body.system_status.components;
      expect(components.optimizer).toBeDefined();
      expect(components.node_manager).toBeDefined();
      expect(components.cache_manager).toBeDefined();
    });
  });

  describe('GET /api/edge-optimization/nodes', () => {
    beforeEach(async () => {
      // Register multiple test nodes
      const nodes = [
        {
          id: 'list-test-node-1',
          endpoint: 'https://node1.test.com:8080',
          location: { region: 'us-east', city: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 4, memory_gb: 8, storage_gb: 100, network_mbps: 1000 }
        },
        {
          id: 'list-test-node-2',
          endpoint: 'https://node2.test.com:8080',
          location: { region: 'us-west', city: 'San Francisco', country: 'USA', latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 6, memory_gb: 12, storage_gb: 200, network_mbps: 1500 }
        }
      ];

      for (const node of nodes) {
        await edgeComputingService.registerEdgeNode(node);
      }
    });

    it('should list all registered nodes', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/nodes');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.nodes).toBeInstanceOf(Array);
      expect(response.body.nodes.length).toBeGreaterThanOrEqual(2);
      expect(response.body.total_count).toBeGreaterThanOrEqual(2);
    });

    it('should filter nodes by region', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/nodes')
        .query({ region: 'us-east' });

      expect(response.status).toBe(200);
      expect(response.body.nodes.every((node: any) => node.location.region === 'us-east')).toBe(true);
    });

    it('should limit number of results', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/nodes')
        .query({ limit: 1 });

      expect(response.status).toBe(200);
      expect(response.body.nodes.length).toBe(1);
    });
  });

  describe('DELETE /api/edge-optimization/nodes/:nodeId', () => {
    let testNodeId: string;

    beforeEach(async () => {
      testNodeId = 'delete-test-node';
      await edgeComputingService.registerEdgeNode({
        id: testNodeId,
        endpoint: 'https://delete-test.com:8080',
        location: {
          region: 'eu-central',
          city: 'Frankfurt',
          country: 'Germany',
          latitude: 50.1109,
          longitude: 8.6821,
          timezone: 'Europe/Berlin'
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
        }
      });
    });

    it('should deregister node successfully', async () => {
      const response = await request(app)
        .delete(`/api/edge-optimization/nodes/${testNodeId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.node_id).toBe(testNodeId);
    });

    it('should return 404 for non-existent node', async () => {
      const response = await request(app)
        .delete('/api/edge-optimization/nodes/non-existent-node');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Cache Management Endpoints', () => {
    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cache_stats).toBeDefined();
      expect(response.body.cache_stats.global).toBeDefined();
      expect(response.body.cache_stats.regional).toBeDefined();
    });

    it('should filter cache stats by region', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/cache/stats')
        .query({ region: 'us-east' });

      expect(response.status).toBe(200);
      expect(response.body.cache_stats.regional['us-east']).toBeDefined();
    });

    it('should invalidate cache entries', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/cache/invalidate')
        .send({
          pattern: 'test-*',
          cascade_to_related: true,
          geographic_scope: 'regional',
          reason: 'test invalidation'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invalidation_result).toBeDefined();
    });

    it('should validate cache invalidation parameters', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/cache/invalidate')
        .send({
          // Missing required pattern
          cascade_to_related: true
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Geographic Cluster Management', () => {
    beforeEach(async () => {
      // Register nodes to create clusters
      const nodes = [
        {
          id: 'cluster-node-1',
          endpoint: 'https://cluster1.test.com:8080',
          location: { region: 'us-east', city: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 4, memory_gb: 8, storage_gb: 100, network_mbps: 1000 }
        },
        {
          id: 'cluster-node-2',
          endpoint: 'https://cluster2.test.com:8080',
          location: { region: 'us-east', city: 'Boston', country: 'USA', latitude: 42.3601, longitude: -71.0589, timezone: 'America/New_York' },
          capabilities: { prompt_optimization: true, semantic_analysis: true, model_inference: true, vector_search: true, caching: true, compression: true, load_balancing: true },
          resources: { cpu_cores: 6, memory_gb: 12, storage_gb: 200, network_mbps: 1500 }
        }
      ];

      for (const node of nodes) {
        await edgeComputingService.registerEdgeNode(node);
      }
    });

    it('should return geographic clusters', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/clusters');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.clusters).toBeInstanceOf(Array);
      expect(response.body.total_count).toBeGreaterThanOrEqual(0);
    });

    it('should include cluster details', async () => {
      const response = await request(app)
        .get('/api/edge-optimization/clusters');

      if (response.body.clusters.length > 0) {
        const cluster = response.body.clusters[0];
        expect(cluster.id).toBeDefined();
        expect(cluster.region).toBeDefined();
        expect(cluster.center_coordinates).toBeDefined();
        expect(cluster.total_capacity).toBeDefined();
        expect(cluster.health_metrics).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle large payloads gracefully', async () => {
      const largePrompt = 'A'.repeat(50000); // 50KB prompt
      
      const response = await request(app)
        .post('/api/edge-optimization/optimize')
        .send({
          prompt: largePrompt
        });

      // Should either process successfully or return appropriate error
      expect([200, 400, 413, 500]).toContain(response.status);
    });

    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/edge-optimization/optimize')
        .send({
          prompt: 'short' // Too short, should trigger validation error
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .post('/api/edge-optimization/optimize')
          .send({
            prompt: `Concurrent test prompt ${i} for load testing edge optimization`
          })
      );

      const responses = await Promise.all(promises);
      
      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(responses.every(r => r.body.success === true)).toBe(true);
    });

    it('should maintain reasonable response times under load', async () => {
      const requestCount = 5;
      const responseTimes: number[] = [];

      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();
        
        const response = await request(app)
          .post('/api/edge-optimization/optimize')
          .send({
            prompt: `Load test prompt ${i} for performance measurement`
          });

        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        expect(response.status).toBe(200);
      }

      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      
      // Response time should be reasonable (less than 10 seconds)
      expect(avgResponseTime).toBeLessThan(10000);
    });
  });
});