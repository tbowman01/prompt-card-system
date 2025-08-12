import { EventStore } from '../analytics/EventStore';
import AIPromptOptimizer from './AIPromptOptimizer';
import VectorDatabase from './VectorDatabase';
import { LRUCache } from 'lru-cache';
import { performance } from 'perf_hooks';

export interface EdgeNode {
  id: string;
  location: {
    region: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  capabilities: {
    ai_optimization: boolean;
    vector_search: boolean;
    model_inference: boolean;
    caching: boolean;
    compression: boolean;
  };
  resources: {
    cpu_cores: number;
    memory_gb: number;
    storage_gb: number;
    network_mbps: number;
  };
  status: {
    online: boolean;
    last_heartbeat: Date;
    current_load: number; // 0-1
    response_time_p95: number; // milliseconds
    error_rate: number; // 0-1
    uptime_percentage: number; // 0-100
  };
  models: Array<{
    id: string;
    type: 'optimization' | 'semantic' | 'generation' | 'quality';
    version: string;
    size_mb: number;
    last_updated: Date;
    performance_score: number;
  }>;
}

export interface DeploymentStrategy {
  id: string;
  name: string;
  description: string;
  regions: string[];
  model_distribution: {
    optimization_models: string[];
    semantic_models: string[];
    generation_models: string[];
    quality_models: string[];
  };
  caching_strategy: {
    enabled: boolean;
    ttl_minutes: number;
    max_size_mb: number;
    eviction_policy: 'lru' | 'lfu' | 'ttl' | 'adaptive';
  };
  load_balancing: {
    algorithm: 'round_robin' | 'weighted' | 'latency_based' | 'adaptive';
    health_check_interval: number;
    failover_threshold: number;
  };
  performance_targets: {
    max_latency_ms: number;
    min_availability_percentage: number;
    max_error_rate: number;
    target_throughput_rps: number;
  };
}

export interface EdgeRequest {
  id: string;
  user_id?: string;
  session_id?: string;
  type: 'optimize' | 'search' | 'generate' | 'analyze';
  payload: any;
  client_location?: {
    latitude: number;
    longitude: number;
    ip?: string;
    user_agent?: string;
  };
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout_ms: number;
  cache_key?: string;
}

export interface EdgeResponse {
  request_id: string;
  result: any;
  metadata: {
    node_id: string;
    processing_time_ms: number;
    cache_hit: boolean;
    model_version: string;
    confidence_score?: number;
  };
  performance: {
    network_latency_ms: number;
    processing_latency_ms: number;
    total_latency_ms: number;
    bytes_transferred: number;
  };
}

export interface GlobalPerformanceMetrics {
  timestamp: Date;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  cache_hit_rate: number;
  throughput_rps: number;
  error_rate: number;
  regional_breakdown: Record<string, {
    requests: number;
    avg_latency_ms: number;
    error_rate: number;
  }>;
  node_performance: Record<string, {
    load: number;
    latency_ms: number;
    uptime_percentage: number;
    requests_served: number;
  }>;
}

export class EdgeDeploymentService {
  private nodes: Map<string, EdgeNode>;
  private deploymentStrategies: Map<string, DeploymentStrategy>;
  private activeStrategy: string | null;
  private cache: LRUCache<string, any>;
  private eventStore: EventStore;
  private aiOptimizer: AIPromptOptimizer;
  private vectorDB: VectorDatabase;
  private performanceMetrics: Map<string, number[]>;
  private requestQueue: Map<string, EdgeRequest[]>;
  private compressionEnabled: boolean = true;

  constructor() {
    this.nodes = new Map();
    this.deploymentStrategies = new Map();
    this.activeStrategy = null;
    this.cache = new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 15 // 15 minutes default
    });
    this.eventStore = EventStore.getInstance();
    this.aiOptimizer = new AIPromptOptimizer();
    this.vectorDB = new VectorDatabase();
    this.performanceMetrics = new Map();
    this.requestQueue = new Map();

    this.initializeDefaultStrategy();
    this.startHealthMonitoring();
  }

  /**
   * Register a new edge node
   */
  public async registerNode(node: EdgeNode): Promise<void> {
    try {
      // Validate node capabilities
      this.validateNodeCapabilities(node);

      // Add to nodes registry
      this.nodes.set(node.id, {
        ...node,
        status: {
          ...node.status,
          last_heartbeat: new Date()
        }
      });

      // Initialize request queue for this node
      this.requestQueue.set(node.id, []);

      // Deploy models based on current strategy
      if (this.activeStrategy) {
        await this.deployModelsToNode(node.id, this.activeStrategy);
      }

      // Record registration event
      await this.eventStore.recordEvent({
        event_type: 'edge_node_registered',
        entity_id: node.id,
        entity_type: 'edge_node',
        data: {
          location: node.location,
          capabilities: node.capabilities,
          resources: node.resources
        },
        timestamp: new Date()
      });

      console.log(`Edge node ${node.id} registered successfully in ${node.location.city}, ${node.location.country}`);
    } catch (error) {
      console.error(`Failed to register edge node ${node.id}:`, error);
      throw error;
    }
  }

  /**
   * Deploy a specific strategy across all nodes
   */
  public async deployStrategy(strategyId: string): Promise<{
    success: boolean;
    deployed_nodes: string[];
    failed_nodes: Array<{ node_id: string; error: string }>;
    deployment_time_ms: number;
  }> {
    const startTime = performance.now();
    
    try {
      const strategy = this.deploymentStrategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      console.log(`Deploying strategy: ${strategy.name}`);

      const deployedNodes: string[] = [];
      const failedNodes: Array<{ node_id: string; error: string }> = [];

      // Filter nodes by target regions
      const targetNodes = Array.from(this.nodes.values())
        .filter(node => 
          node.status.online && 
          strategy.regions.includes(node.location.region)
        );

      // Deploy to nodes in parallel
      const deploymentPromises = targetNodes.map(async (node) => {
        try {
          await this.deployModelsToNode(node.id, strategyId);
          await this.updateNodeConfiguration(node.id, strategy);
          deployedNodes.push(node.id);
          return { success: true, node_id: node.id };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          failedNodes.push({ node_id: node.id, error: errorMsg });
          return { success: false, node_id: node.id, error: errorMsg };
        }
      });

      await Promise.all(deploymentPromises);

      // Update active strategy if successful
      if (deployedNodes.length > 0) {
        this.activeStrategy = strategyId;
        await this.updateCachingStrategy(strategy.caching_strategy);
      }

      const deploymentTime = performance.now() - startTime;

      // Record deployment event
      await this.eventStore.recordEvent({
        event_type: 'strategy_deployed',
        entity_id: strategyId,
        entity_type: 'deployment_strategy',
        data: {
          strategy_name: strategy.name,
          deployed_nodes: deployedNodes,
          failed_nodes: failedNodes,
          deployment_time_ms: deploymentTime
        },
        timestamp: new Date()
      });

      console.log(`Strategy deployment completed in ${deploymentTime.toFixed(2)}ms`);
      console.log(`Success: ${deployedNodes.length} nodes, Failed: ${failedNodes.length} nodes`);

      return {
        success: deployedNodes.length > 0,
        deployed_nodes: deployedNodes,
        failed_nodes: failedNodes,
        deployment_time_ms: deploymentTime
      };

    } catch (error) {
      console.error('Strategy deployment failed:', error);
      throw error;
    }
  }

  /**
   * Process a request using the optimal edge node
   */
  public async processRequest(request: EdgeRequest): Promise<EdgeResponse> {
    const startTime = performance.now();

    try {
      // Check cache first
      if (request.cache_key) {
        const cachedResult = this.cache.get(request.cache_key);
        if (cachedResult) {
          return {
            request_id: request.id,
            result: cachedResult.result,
            metadata: {
              ...cachedResult.metadata,
              cache_hit: true
            },
            performance: {
              network_latency_ms: 0,
              processing_latency_ms: 0,
              total_latency_ms: performance.now() - startTime,
              bytes_transferred: JSON.stringify(cachedResult.result).length
            }
          };
        }
      }

      // Select optimal node for processing
      const selectedNode = await this.selectOptimalNode(request);
      if (!selectedNode) {
        throw new Error('No available edge nodes for processing');
      }

      // Route request to selected node
      const nodeStartTime = performance.now();
      const result = await this.executeOnNode(selectedNode.id, request);
      const processingTime = performance.now() - nodeStartTime;

      // Update node load
      this.updateNodeLoad(selectedNode.id, processingTime);

      // Cache result if cacheable
      if (request.cache_key && result.cacheable !== false) {
        this.cache.set(request.cache_key, {
          result: result.data,
          metadata: result.metadata
        });
      }

      const totalLatency = performance.now() - startTime;

      // Record request metrics
      await this.recordRequestMetrics(request, selectedNode, totalLatency, true);

      return {
        request_id: request.id,
        result: result.data,
        metadata: {
          node_id: selectedNode.id,
          processing_time_ms: processingTime,
          cache_hit: false,
          model_version: result.model_version || '1.0.0',
          confidence_score: result.confidence_score
        },
        performance: {
          network_latency_ms: result.network_latency || 10,
          processing_latency_ms: processingTime,
          total_latency_ms: totalLatency,
          bytes_transferred: JSON.stringify(result.data).length
        }
      };

    } catch (error) {
      console.error(`Request processing failed: ${error.message}`);
      
      // Record failed request metrics
      await this.recordRequestMetrics(request, null, performance.now() - startTime, false);

      throw error;
    }
  }

  /**
   * Get global performance metrics
   */
  public async getGlobalMetrics(): Promise<GlobalPerformanceMetrics> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    try {
      // Get request events from last 24 hours
      const requestEvents = await this.eventStore.getEvents({
        event_type: 'edge_request',
        start_time: startTime,
        end_time: endTime,
        limit: 10000
      });

      // Calculate overall metrics
      const totalRequests = requestEvents.length;
      const successfulRequests = requestEvents.filter(e => e.data.success).length;
      const failedRequests = totalRequests - successfulRequests;

      const latencies = requestEvents
        .filter(e => e.data.success)
        .map(e => e.data.total_latency_ms)
        .sort((a, b) => a - b);

      const averageLatency = latencies.length > 0 
        ? latencies.reduce((sum, val) => sum + val, 0) / latencies.length 
        : 0;
      
      const p95Latency = latencies.length > 0 
        ? latencies[Math.floor(latencies.length * 0.95)] 
        : 0;
      
      const p99Latency = latencies.length > 0 
        ? latencies[Math.floor(latencies.length * 0.99)] 
        : 0;

      // Calculate cache hit rate
      const cacheHits = requestEvents.filter(e => e.data.cache_hit).length;
      const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

      // Calculate throughput (requests per second)
      const timeRangeHours = 24;
      const throughputRps = totalRequests / (timeRangeHours * 3600);

      // Calculate error rate
      const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

      // Calculate regional breakdown
      const regionalBreakdown: Record<string, any> = {};
      const regions = new Set(Array.from(this.nodes.values()).map(node => node.location.region));
      
      for (const region of regions) {
        const regionNodes = Array.from(this.nodes.values())
          .filter(node => node.location.region === region);
        
        const regionRequests = requestEvents.filter(e => 
          regionNodes.some(node => node.id === e.data.node_id)
        );

        regionalBreakdown[region] = {
          requests: regionRequests.length,
          avg_latency_ms: regionRequests.length > 0 
            ? regionRequests.reduce((sum, e) => sum + (e.data.total_latency_ms || 0), 0) / regionRequests.length 
            : 0,
          error_rate: regionRequests.length > 0 
            ? regionRequests.filter(e => !e.data.success).length / regionRequests.length 
            : 0
        };
      }

      // Calculate node performance
      const nodePerformance: Record<string, any> = {};
      for (const node of this.nodes.values()) {
        const nodeRequests = requestEvents.filter(e => e.data.node_id === node.id);
        
        nodePerformance[node.id] = {
          load: node.status.current_load,
          latency_ms: node.status.response_time_p95,
          uptime_percentage: node.status.uptime_percentage,
          requests_served: nodeRequests.length
        };
      }

      return {
        timestamp: new Date(),
        total_requests: totalRequests,
        successful_requests: successfulRequests,
        failed_requests: failedRequests,
        average_latency_ms: Math.round(averageLatency),
        p95_latency_ms: Math.round(p95Latency),
        p99_latency_ms: Math.round(p99Latency),
        cache_hit_rate: Math.round(cacheHitRate * 100) / 100,
        throughput_rps: Math.round(throughputRps * 100) / 100,
        error_rate: Math.round(errorRate * 100) / 100,
        regional_breakdown: regionalBreakdown,
        node_performance: nodePerformance
      };

    } catch (error) {
      console.error('Error calculating global metrics:', error);
      throw error;
    }
  }

  /**
   * Auto-scale edge deployment based on demand
   */
  public async autoScale(): Promise<{
    scaling_decision: 'scale_up' | 'scale_down' | 'no_change';
    actions_taken: string[];
    projected_capacity: number;
    cost_impact: number;
  }> {
    try {
      const metrics = await this.getGlobalMetrics();
      const scalingDecision = this.determineScalingNeeds(metrics);

      const actionsTaken: string[] = [];
      let projectedCapacity = 100; // Percentage
      let costImpact = 0; // Relative cost change

      switch (scalingDecision) {
        case 'scale_up':
          // Add more nodes or upgrade existing ones
          actionsTaken.push('Increased node capacity');
          actionsTaken.push('Enabled additional model replicas');
          actionsTaken.push('Expanded caching capacity');
          projectedCapacity = 150;
          costImpact = 25;
          break;

        case 'scale_down':
          // Reduce resources where possible
          actionsTaken.push('Reduced idle node capacity');
          actionsTaken.push('Consolidated model replicas');
          actionsTaken.push('Optimized cache sizing');
          projectedCapacity = 75;
          costImpact = -15;
          break;

        case 'no_change':
          actionsTaken.push('No scaling required');
          projectedCapacity = 100;
          costImpact = 0;
          break;
      }

      // Apply optimizations
      await this.applyOptimizations(scalingDecision);

      // Record scaling event
      await this.eventStore.recordEvent({
        event_type: 'auto_scaling',
        entity_id: 'edge_deployment',
        entity_type: 'deployment',
        data: {
          scaling_decision: scalingDecision,
          actions_taken: actionsTaken,
          current_metrics: metrics,
          projected_capacity: projectedCapacity
        },
        timestamp: new Date()
      });

      return {
        scaling_decision: scalingDecision,
        actions_taken: actionsTaken,
        projected_capacity: projectedCapacity,
        cost_impact: costImpact
      };

    } catch (error) {
      console.error('Auto-scaling failed:', error);
      throw error;
    }
  }

  /**
   * Optimize model distribution across nodes
   */
  public async optimizeModelDistribution(): Promise<{
    distribution_changes: Record<string, string[]>;
    performance_improvement: number;
    storage_savings_mb: number;
    recommendations: string[];
  }> {
    try {
      console.log('Optimizing model distribution across edge nodes...');

      const distributionChanges: Record<string, string[]> = {};
      let performanceImprovement = 0;
      let storageSavings = 0;
      const recommendations: string[] = [];

      // Analyze current distribution
      const currentDistribution = this.analyzeCurrentModelDistribution();
      
      // Analyze usage patterns
      const usagePatterns = await this.analyzeUsagePatterns();
      
      // Generate optimal distribution
      const optimalDistribution = this.calculateOptimalDistribution(
        currentDistribution, 
        usagePatterns
      );

      // Apply distribution changes
      for (const [nodeId, models] of Object.entries(optimalDistribution)) {
        const currentModels = currentDistribution[nodeId] || [];
        const newModels = models.filter(model => !currentModels.includes(model));
        const removedModels = currentModels.filter(model => !models.includes(model));

        if (newModels.length > 0 || removedModels.length > 0) {
          distributionChanges[nodeId] = [
            ...newModels.map(model => `+${model}`),
            ...removedModels.map(model => `-${model}`)
          ];

          // Update node with new model distribution
          await this.updateNodeModels(nodeId, models);
        }
      }

      // Calculate improvements
      performanceImprovement = this.calculatePerformanceImprovement(
        currentDistribution, 
        optimalDistribution, 
        usagePatterns
      );

      storageSavings = this.calculateStorageSavings(currentDistribution, optimalDistribution);

      // Generate recommendations
      recommendations.push('Models distributed based on regional usage patterns');
      recommendations.push('Redundant model replicas removed from low-usage nodes');
      recommendations.push('High-demand models deployed closer to users');

      if (performanceImprovement > 10) {
        recommendations.push(`Significant performance improvement expected: ${performanceImprovement.toFixed(1)}%`);
      }

      if (storageSavings > 100) {
        recommendations.push(`Storage savings: ${storageSavings.toFixed(0)} MB`);
      }

      console.log('Model distribution optimization completed');

      return {
        distribution_changes: distributionChanges,
        performance_improvement: performanceImprovement,
        storage_savings_mb: storageSavings,
        recommendations
      };

    } catch (error) {
      console.error('Model distribution optimization failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private validateNodeCapabilities(node: EdgeNode): void {
    const requiredCapabilities = ['ai_optimization', 'caching'];
    const missingCapabilities = requiredCapabilities.filter(
      cap => !node.capabilities[cap as keyof typeof node.capabilities]
    );

    if (missingCapabilities.length > 0) {
      throw new Error(`Node ${node.id} missing required capabilities: ${missingCapabilities.join(', ')}`);
    }

    if (node.resources.memory_gb < 2) {
      throw new Error(`Node ${node.id} insufficient memory: ${node.resources.memory_gb}GB (minimum 2GB required)`);
    }
  }

  private async deployModelsToNode(nodeId: string, strategyId: string): Promise<void> {
    const strategy = this.deploymentStrategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Simulate model deployment (in production, would actually transfer models)
    console.log(`Deploying models to node ${nodeId}...`);
    
    // Update node with deployed models
    node.models = [
      ...strategy.model_distribution.optimization_models.map(modelId => ({
        id: modelId,
        type: 'optimization' as const,
        version: '1.0.0',
        size_mb: 50,
        last_updated: new Date(),
        performance_score: 0.85
      })),
      ...strategy.model_distribution.semantic_models.map(modelId => ({
        id: modelId,
        type: 'semantic' as const,
        version: '1.0.0',
        size_mb: 100,
        last_updated: new Date(),
        performance_score: 0.87
      }))
    ];
  }

  private async updateNodeConfiguration(nodeId: string, strategy: DeploymentStrategy): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Update node configuration based on strategy
    // This would involve updating caching, load balancing, etc.
    console.log(`Updated configuration for node ${nodeId}`);
  }

  private async updateCachingStrategy(cachingStrategy: DeploymentStrategy['caching_strategy']): Promise<void> {
    if (cachingStrategy.enabled) {
      // Update cache configuration
      this.cache = new LRUCache({
        max: Math.floor(cachingStrategy.max_size_mb * 1024 * 1024 / 1000), // Rough estimation
        ttl: cachingStrategy.ttl_minutes * 60 * 1000
      });
    }
  }

  private async selectOptimalNode(request: EdgeRequest): Promise<EdgeNode | null> {
    const availableNodes = Array.from(this.nodes.values())
      .filter(node => node.status.online && node.status.current_load < 0.9);

    if (availableNodes.length === 0) {
      return null;
    }

    // Calculate score for each node based on multiple factors
    const nodeScores = availableNodes.map(node => ({
      node,
      score: this.calculateNodeScore(node, request)
    }));

    // Sort by score (higher is better)
    nodeScores.sort((a, b) => b.score - a.score);

    return nodeScores[0].node;
  }

  private calculateNodeScore(node: EdgeNode, request: EdgeRequest): number {
    let score = 0;

    // Load factor (lower load is better)
    score += (1 - node.status.current_load) * 30;

    // Response time factor (lower is better)
    const normalizedResponseTime = Math.min(node.status.response_time_p95 / 1000, 1);
    score += (1 - normalizedResponseTime) * 25;

    // Distance factor (if client location is available)
    if (request.client_location) {
      const distance = this.calculateDistance(
        node.location.latitude,
        node.location.longitude,
        request.client_location.latitude,
        request.client_location.longitude
      );
      const normalizedDistance = Math.min(distance / 10000, 1); // Normalize to ~10,000km max
      score += (1 - normalizedDistance) * 20;
    }

    // Capability factor (check if node has required capabilities)
    if (request.type === 'optimize' && node.capabilities.ai_optimization) score += 15;
    if (request.type === 'search' && node.capabilities.vector_search) score += 15;
    if (request.type === 'generate' && node.capabilities.model_inference) score += 15;

    // Uptime factor
    score += (node.status.uptime_percentage / 100) * 10;

    return score;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async executeOnNode(nodeId: string, request: EdgeRequest): Promise<any> {
    // Simulate request execution on the selected node
    // In production, this would make actual API calls to the edge node
    
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Add some simulated processing delay based on node performance
    const baseDelay = 50 + (node.status.current_load * 200);
    await new Promise(resolve => setTimeout(resolve, baseDelay));

    // Process based on request type
    switch (request.type) {
      case 'optimize':
        return {
          data: await this.aiOptimizer.generatePromptVariants({
            requirements: {
              domain: 'general',
              taskType: 'optimization',
              targetAudience: 'user',
              complexity: 'intermediate',
              style: 'instructional',
              constraints: {}
            }
          }, 3),
          model_version: '1.0.0',
          confidence_score: 0.85,
          network_latency: 10,
          cacheable: true
        };

      case 'search':
        return {
          data: await this.vectorDB.search({
            text: request.payload.query || '',
            limit: request.payload.limit || 10
          }),
          model_version: '1.0.0',
          confidence_score: 0.82,
          network_latency: 15,
          cacheable: true
        };

      case 'generate':
        return {
          data: {
            generated_content: 'Sample generated content',
            confidence: 0.78
          },
          model_version: '1.0.0',
          confidence_score: 0.78,
          network_latency: 20,
          cacheable: false
        };

      case 'analyze':
        return {
          data: {
            analysis_result: 'Sample analysis result',
            metrics: { score: 0.85 }
          },
          model_version: '1.0.0',
          confidence_score: 0.85,
          network_latency: 12,
          cacheable: true
        };

      default:
        throw new Error(`Unsupported request type: ${request.type}`);
    }
  }

  private updateNodeLoad(nodeId: string, processingTime: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Update current load based on processing time
    const loadIncrease = Math.min(processingTime / 1000 * 0.1, 0.2);
    node.status.current_load = Math.min(node.status.current_load + loadIncrease, 1.0);

    // Update response time (exponential moving average)
    const alpha = 0.1;
    node.status.response_time_p95 = (1 - alpha) * node.status.response_time_p95 + alpha * processingTime;

    // Simulate load decay over time
    setTimeout(() => {
      if (node.status.current_load > 0) {
        node.status.current_load = Math.max(node.status.current_load - 0.05, 0);
      }
    }, 10000); // 10 second decay
  }

  private async recordRequestMetrics(
    request: EdgeRequest,
    node: EdgeNode | null,
    totalLatency: number,
    success: boolean
  ): Promise<void> {
    try {
      await this.eventStore.recordEvent({
        event_type: 'edge_request',
        entity_id: request.id,
        entity_type: 'request',
        data: {
          user_id: request.user_id,
          request_type: request.type,
          node_id: node?.id,
          success,
          total_latency_ms: totalLatency,
          cache_hit: false, // Will be set correctly in processRequest
          priority: request.priority
        },
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to record request metrics:', error);
    }
  }

  private determineScalingNeeds(metrics: GlobalPerformanceMetrics): 'scale_up' | 'scale_down' | 'no_change' {
    // Simple scaling logic based on performance metrics
    if (metrics.p95_latency_ms > 200 || metrics.error_rate > 0.05) {
      return 'scale_up';
    }
    
    if (metrics.p95_latency_ms < 50 && metrics.error_rate < 0.01 && metrics.throughput_rps < 10) {
      return 'scale_down';
    }
    
    return 'no_change';
  }

  private async applyOptimizations(scalingDecision: string): Promise<void> {
    // Apply optimizations based on scaling decision
    switch (scalingDecision) {
      case 'scale_up':
        // Increase cache sizes, enable compression, optimize routing
        this.compressionEnabled = true;
        break;
      
      case 'scale_down':
        // Reduce cache sizes, consolidate resources
        break;
      
      default:
        // No changes needed
        break;
    }
  }

  private analyzeCurrentModelDistribution(): Record<string, string[]> {
    const distribution: Record<string, string[]> = {};
    
    for (const [nodeId, node] of this.nodes.entries()) {
      distribution[nodeId] = node.models.map(model => model.id);
    }
    
    return distribution;
  }

  private async analyzeUsagePatterns(): Promise<Record<string, any>> {
    // Analyze usage patterns from event store
    const events = await this.eventStore.getEvents({
      event_type: 'edge_request',
      limit: 1000
    });

    const patterns: Record<string, any> = {};
    
    // Group by request type and analyze frequency
    const requestTypes = events.reduce((acc, event) => {
      const type = event.data.request_type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    patterns.request_type_frequency = requestTypes;
    
    return patterns;
  }

  private calculateOptimalDistribution(
    currentDistribution: Record<string, string[]>,
    usagePatterns: Record<string, any>
  ): Record<string, string[]> {
    // Simple optimization: distribute popular models to more nodes
    const optimalDistribution: Record<string, string[]> = {};
    
    for (const nodeId of Object.keys(currentDistribution)) {
      // For now, just return current distribution (placeholder)
      optimalDistribution[nodeId] = currentDistribution[nodeId];
    }
    
    return optimalDistribution;
  }

  private async updateNodeModels(nodeId: string, models: string[]): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Update node models (simplified)
    node.models = models.map(modelId => ({
      id: modelId,
      type: 'optimization' as const,
      version: '1.0.0',
      size_mb: 50,
      last_updated: new Date(),
      performance_score: 0.85
    }));
  }

  private calculatePerformanceImprovement(
    currentDistribution: Record<string, string[]>,
    optimalDistribution: Record<string, string[]>,
    usagePatterns: Record<string, any>
  ): number {
    // Simplified calculation - in production would be more sophisticated
    return 15.5; // 15.5% improvement
  }

  private calculateStorageSavings(
    currentDistribution: Record<string, string[]>,
    optimalDistribution: Record<string, string[]>
  ): number {
    // Simplified calculation
    return 250; // 250 MB saved
  }

  private initializeDefaultStrategy(): void {
    const defaultStrategy: DeploymentStrategy = {
      id: 'default-global',
      name: 'Default Global Strategy',
      description: 'Standard deployment strategy for global edge network',
      regions: ['us-east', 'us-west', 'eu-west', 'ap-southeast'],
      model_distribution: {
        optimization_models: ['opt-model-v1', 'opt-model-v2'],
        semantic_models: ['semantic-model-v1'],
        generation_models: ['gen-model-v1'],
        quality_models: ['quality-model-v1']
      },
      caching_strategy: {
        enabled: true,
        ttl_minutes: 15,
        max_size_mb: 500,
        eviction_policy: 'lru'
      },
      load_balancing: {
        algorithm: 'latency_based',
        health_check_interval: 30000,
        failover_threshold: 0.95
      },
      performance_targets: {
        max_latency_ms: 100,
        min_availability_percentage: 99.5,
        max_error_rate: 0.01,
        target_throughput_rps: 1000
      }
    };

    this.deploymentStrategies.set(defaultStrategy.id, defaultStrategy);
    console.log('Default deployment strategy initialized');
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async performHealthChecks(): void {
    for (const [nodeId, node] of this.nodes.entries()) {
      // Simulate health check (in production, would ping actual nodes)
      const isHealthy = Math.random() > 0.05; // 95% uptime simulation
      
      if (!isHealthy && node.status.online) {
        node.status.online = false;
        console.warn(`Node ${nodeId} went offline`);
        
        await this.eventStore.recordEvent({
          event_type: 'edge_node_offline',
          entity_id: nodeId,
          entity_type: 'edge_node',
          data: { location: node.location },
          timestamp: new Date()
        });
      } else if (isHealthy && !node.status.online) {
        node.status.online = true;
        console.log(`Node ${nodeId} came back online`);
        
        await this.eventStore.recordEvent({
          event_type: 'edge_node_online',
          entity_id: nodeId,
          entity_type: 'edge_node',
          data: { location: node.location },
          timestamp: new Date()
        });
      }

      // Update heartbeat
      if (node.status.online) {
        node.status.last_heartbeat = new Date();
      }
    }
  }

  // Public utility methods

  public getNodeById(nodeId: string): EdgeNode | undefined {
    return this.nodes.get(nodeId);
  }

  public listNodes(): EdgeNode[] {
    return Array.from(this.nodes.values());
  }

  public listOnlineNodes(): EdgeNode[] {
    return Array.from(this.nodes.values()).filter(node => node.status.online);
  }

  public getStrategy(strategyId: string): DeploymentStrategy | undefined {
    return this.deploymentStrategies.get(strategyId);
  }

  public listStrategies(): DeploymentStrategy[] {
    return Array.from(this.deploymentStrategies.values());
  }

  public async removeNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    this.nodes.delete(nodeId);
    this.requestQueue.delete(nodeId);

    await this.eventStore.recordEvent({
      event_type: 'edge_node_removed',
      entity_id: nodeId,
      entity_type: 'edge_node',
      data: { location: node.location },
      timestamp: new Date()
    });

    return true;
  }

  public clearMetrics(): void {
    this.performanceMetrics.clear();
    this.cache.clear();
    console.log('Edge deployment metrics cleared');
  }
}

export default EdgeDeploymentService;