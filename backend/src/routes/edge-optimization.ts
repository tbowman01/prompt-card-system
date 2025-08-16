import express from 'express';
import { edgeComputingService } from '../services/edge';
import { validateRequest } from '../middleware/validation';
import { structuredLogging } from '../middleware/structuredLogging';
import { rateLimitingOptimization } from '../middleware/rateLimiting';
import { performance } from 'perf_hooks';

const router = express.Router();

// Apply middleware
router.use(structuredLogging);
router.use(rateLimitingOptimization);

/**
 * POST /edge-optimization/optimize
 * Process prompt optimization using edge computing
 */
router.post('/optimize', validateRequest({
  body: {
    prompt: { type: 'string', required: true, minLength: 10 },
    user_id: { type: 'string', required: false },
    client_location: {
      type: 'object',
      required: false,
      properties: {
        latitude: { type: 'number', min: -90, max: 90 },
        longitude: { type: 'number', min: -180, max: 180 }
      }
    },
    target_metrics: {
      type: 'object',
      required: false,
      properties: {
        max_latency_ms: { type: 'number', min: 10, max: 10000 },
        min_quality_score: { type: 'number', min: 0, max: 1 }
      }
    },
    cache_policy: {
      type: 'object',
      required: false,
      properties: {
        enabled: { type: 'boolean' },
        ttl_minutes: { type: 'number', min: 1, max: 1440 }
      }
    }
  }
}), async (req, res) => {
  const startTime = performance.now();

  try {
    const { prompt, user_id, client_location, target_metrics, cache_policy } = req.body;

    console.log(`Processing edge optimization request for prompt: ${prompt.substring(0, 50)}...`);

    // Process optimization request through edge computing service
    const result = await edgeComputingService.processOptimizationRequest({
      prompt,
      user_id,
      client_location,
      target_metrics,
      cache_policy
    });

    const processingTime = performance.now() - startTime;

    res.json({
      success: true,
      optimization_result: result.optimization_result,
      edge_metadata: {
        ...result.edge_metadata,
        request_processing_time_ms: processingTime
      },
      performance_metrics: result.performance_metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Edge optimization failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      edge_metadata: {
        request_processing_time_ms: processingTime,
        fallback_used: true
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /edge-optimization/nodes/register
 * Register a new edge node
 */
router.post('/nodes/register', validateRequest({
  body: {
    id: { type: 'string', required: true, minLength: 3 },
    endpoint: { type: 'string', required: true, format: 'uri' },
    location: {
      type: 'object',
      required: true,
      properties: {
        region: { type: 'string', required: true },
        city: { type: 'string', required: true },
        country: { type: 'string', required: true },
        latitude: { type: 'number', required: true, min: -90, max: 90 },
        longitude: { type: 'number', required: true, min: -180, max: 180 },
        timezone: { type: 'string', required: true }
      }
    },
    capabilities: {
      type: 'object',
      required: true,
      properties: {
        prompt_optimization: { type: 'boolean', required: true },
        semantic_analysis: { type: 'boolean', required: true },
        model_inference: { type: 'boolean', required: true },
        vector_search: { type: 'boolean', required: true },
        caching: { type: 'boolean', required: true },
        compression: { type: 'boolean', required: true },
        load_balancing: { type: 'boolean', required: true }
      }
    },
    resources: {
      type: 'object',
      required: true,
      properties: {
        cpu_cores: { type: 'number', required: true, min: 1 },
        memory_gb: { type: 'number', required: true, min: 2 },
        storage_gb: { type: 'number', required: true, min: 10 },
        network_mbps: { type: 'number', required: true, min: 100 }
      }
    }
  }
}), async (req, res) => {
  const startTime = performance.now();

  try {
    const nodeConfig = req.body;

    console.log(`Registering edge node: ${nodeConfig.id} in ${nodeConfig.location.city}, ${nodeConfig.location.country}`);

    // Register the edge node
    const result = await edgeComputingService.registerEdgeNode(nodeConfig);

    const processingTime = performance.now() - startTime;

    res.json({
      success: result.success,
      node_id: result.node_id,
      registration_details: result.registration_details,
      estimated_capacity_contribution: result.estimated_capacity_contribution,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Node registration failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /edge-optimization/analytics
 * Get comprehensive edge computing analytics
 */
router.get('/analytics', async (req, res) => {
  const startTime = performance.now();

  try {
    const { start_date, end_date } = req.query;

    let timeRange: { start: Date; end: Date } | undefined;
    
    if (start_date && end_date) {
      timeRange = {
        start: new Date(start_date as string),
        end: new Date(end_date as string)
      };
    }

    console.log('Generating edge computing analytics...');

    // Get comprehensive analytics
    const analytics = await edgeComputingService.getAnalytics(timeRange);

    const processingTime = performance.now() - startTime;

    res.json({
      success: true,
      analytics,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics generation failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /edge-optimization/optimize-infrastructure
 * Perform comprehensive edge infrastructure optimization
 */
router.post('/optimize-infrastructure', async (req, res) => {
  const startTime = performance.now();

  try {
    console.log('Starting comprehensive edge infrastructure optimization...');

    // Perform infrastructure optimization
    const optimization = await edgeComputingService.optimizeEdgeInfrastructure();

    const processingTime = performance.now() - startTime;

    res.json({
      success: true,
      optimization_results: optimization,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Infrastructure optimization failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /edge-optimization/simulate-deployment
 * Simulate edge computing deployment
 */
router.post('/simulate-deployment', validateRequest({
  body: {
    node_count: { type: 'number', required: true, min: 1, max: 100 },
    regions: { 
      type: 'array', 
      required: true, 
      minItems: 1,
      items: { type: 'string' }
    },
    workload_types: {
      type: 'array',
      required: true,
      items: { type: 'string' }
    },
    traffic_pattern: {
      type: 'string',
      required: true,
      enum: ['low', 'medium', 'high', 'burst']
    }
  }
}), async (req, res) => {
  const startTime = performance.now();

  try {
    const { node_count, regions, workload_types, traffic_pattern } = req.body;

    console.log(`Simulating edge deployment: ${node_count} nodes across ${regions.length} regions`);

    // Simulate deployment
    const simulation = await edgeComputingService.simulateEdgeDeployment({
      node_count,
      regions,
      workload_types,
      traffic_pattern
    });

    const processingTime = performance.now() - startTime;

    res.json({
      success: true,
      simulation_results: simulation,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Deployment simulation failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /edge-optimization/status
 * Get current edge computing system status
 */
router.get('/status', async (req, res) => {
  const startTime = performance.now();

  try {
    console.log('Retrieving edge computing system status...');

    // Get system status
    const status = await edgeComputingService.getSystemStatus();

    const processingTime = performance.now() - startTime;

    res.json({
      success: true,
      system_status: status,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Status retrieval failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /edge-optimization/nodes
 * List all registered edge nodes
 */
router.get('/nodes', async (req, res) => {
  const startTime = performance.now();

  try {
    const { region, status, limit = 50 } = req.query;

    console.log('Retrieving registered edge nodes...');

    // Get nodes from node manager
    const allNodes = edgeComputingService.nodeManager.getRegisteredNodes();
    
    // Apply filters
    let filteredNodes = allNodes;
    
    if (region) {
      filteredNodes = filteredNodes.filter(node => 
        node.node_info.location.region === region
      );
    }
    
    if (status) {
      filteredNodes = filteredNodes.filter(node => 
        node.health_status === status
      );
    }
    
    // Apply limit
    const limitedNodes = filteredNodes.slice(0, Number(limit));

    const processingTime = performance.now() - startTime;

    res.json({
      success: true,
      nodes: limitedNodes.map(node => ({
        id: node.node_id,
        endpoint: node.endpoint,
        location: node.node_info.location,
        capabilities: node.node_info.capabilities,
        resources: node.node_info.resources,
        status: node.node_info.status,
        health_status: node.health_status,
        last_seen: node.last_seen,
        registration_time: node.registration_time
      })),
      total_count: allNodes.length,
      filtered_count: filteredNodes.length,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Node listing failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /edge-optimization/nodes/:nodeId
 * Deregister an edge node
 */
router.delete('/nodes/:nodeId', async (req, res) => {
  const startTime = performance.now();

  try {
    const { nodeId } = req.params;

    console.log(`Deregistering edge node: ${nodeId}`);

    // Deregister the node
    const success = await edgeComputingService.nodeManager.deregisterNode(nodeId);

    const processingTime = performance.now() - startTime;

    if (success) {
      res.json({
        success: true,
        node_id: nodeId,
        message: 'Node deregistered successfully',
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Node not found',
        node_id: nodeId,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Node deregistration failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /edge-optimization/cache/stats
 * Get edge cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  const startTime = performance.now();

  try {
    const { region } = req.query;

    console.log('Retrieving edge cache statistics...');

    // Get cache stats
    const cacheStats = edgeComputingService.cacheManager.getStats();

    const processingTime = performance.now() - startTime;

    const response = region ? 
      { 
        success: true, 
        cache_stats: { regional: { [region as string]: cacheStats.regional[region as string] } },
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString()
      } :
      {
        success: true,
        cache_stats: cacheStats,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString()
      };

    res.json(response);

  } catch (error) {
    console.error('Cache stats retrieval failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /edge-optimization/cache/invalidate
 * Invalidate cache entries
 */
router.post('/cache/invalidate', validateRequest({
  body: {
    pattern: { 
      type: ['string', 'array'], 
      required: true 
    },
    cascade_to_related: { type: 'boolean', required: false },
    geographic_scope: { 
      type: 'string', 
      required: false, 
      enum: ['local', 'regional', 'global'] 
    },
    reason: { type: 'string', required: false }
  }
}), async (req, res) => {
  const startTime = performance.now();

  try {
    const { pattern, cascade_to_related, geographic_scope, reason } = req.body;

    console.log(`Invalidating cache entries with pattern: ${JSON.stringify(pattern)}`);

    // Invalidate cache entries
    const result = await edgeComputingService.cacheManager.invalidate(pattern, {
      cascade_to_related,
      geographic_scope,
      reason
    });

    const processingTime = performance.now() - startTime;

    res.json({
      success: true,
      invalidation_result: result,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cache invalidation failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /edge-optimization/clusters
 * Get geographic cluster information
 */
router.get('/clusters', async (req, res) => {
  const startTime = performance.now();

  try {
    console.log('Retrieving geographic cluster information...');

    // Get cluster information
    const clusters = edgeComputingService.nodeManager.getGeographicClusters();

    const processingTime = performance.now() - startTime;

    res.json({
      success: true,
      clusters: clusters.map(cluster => ({
        id: cluster.id,
        region: cluster.region,
        center_coordinates: cluster.center_coordinates,
        radius_km: cluster.radius_km,
        node_count: cluster.nodes.size,
        total_capacity: cluster.total_capacity,
        current_utilization: cluster.current_utilization,
        health_metrics: cluster.health_metrics
      })),
      total_count: clusters.length,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cluster retrieval failed:', error);
    
    const processingTime = performance.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;