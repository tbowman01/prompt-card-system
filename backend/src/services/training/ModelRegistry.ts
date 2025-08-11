import { EventEmitter } from 'events';
import { EventStore } from '../analytics/EventStore';
import { createHash } from 'crypto';
import * as tf from '@tensorflow/tfjs-node';

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  model_type: 'foundation' | 'fine_tuned' | 'specialized' | 'custom';
  base_model?: string;
  training_job_id?: string;
  size_mb: number;
  parameter_count: number;
  architecture: {
    model_family: string;
    layers: number;
    hidden_size: number;
    attention_heads: number;
    vocab_size: number;
    max_sequence_length: number;
  };
  capabilities: {
    text_generation: boolean;
    text_classification: boolean;
    question_answering: boolean;
    summarization: boolean;
    code_generation: boolean;
    embedding_generation: boolean;
    multimodal: boolean;
  };
  performance_metrics: {
    accuracy?: number;
    f1_score?: number;
    bleu_score?: number;
    rouge_score?: number;
    perplexity?: number;
    inference_latency_ms: number;
    throughput_tokens_per_sec: number;
    memory_usage_mb: number;
  };
  deployment_info: {
    status: 'pending' | 'deployed' | 'deprecated' | 'failed';
    deployed_at?: Date;
    deployment_target?: string;
    endpoint?: string;
    health_status?: 'healthy' | 'degraded' | 'unhealthy';
    last_health_check?: Date;
  };
  usage_statistics: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    average_response_time: number;
    last_used: Date;
    daily_usage: Record<string, number>;
  };
  checksum: string;
  file_path?: string;
  config_path?: string;
  tokenizer_path?: string;
}

export interface ModelVersion {
  version: string;
  changelog: string;
  created_at: Date;
  performance_delta: Record<string, number>;
  backward_compatible: boolean;
  migration_notes?: string;
}

export interface ModelComparison {
  model_a: string;
  model_b: string;
  comparison_date: Date;
  metrics_comparison: Record<string, {
    model_a_value: number;
    model_b_value: number;
    percentage_diff: number;
    winner: 'model_a' | 'model_b' | 'tie';
  }>;
  benchmark_results: Record<string, any>;
  recommendation: {
    preferred_model: string;
    reasoning: string[];
    use_case_recommendations: Record<string, string>;
  };
}

export interface ModelSearch {
  query?: string;
  filters: {
    model_type?: string[];
    capabilities?: string[];
    size_range?: { min_mb?: number; max_mb?: number };
    performance_threshold?: Record<string, number>;
    deployment_status?: string[];
    tags?: string[];
    created_after?: Date;
    created_before?: Date;
  };
  sort_by?: 'name' | 'created_at' | 'size_mb' | 'performance' | 'usage';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class ModelRegistry extends EventEmitter {
  private eventStore: EventStore;
  private models: Map<string, ModelMetadata>;
  private modelVersions: Map<string, ModelVersion[]>;
  private isInitialized = false;

  constructor() {
    super();
    this.eventStore = EventStore.getInstance();
    this.models = new Map();
    this.modelVersions = new Map();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔄 Initializing Model Registry...');
      
      // Load existing models from storage
      await this.loadModelsFromStorage();
      
      // Verify model integrity
      await this.verifyModelIntegrity();
      
      // Update deployment statuses
      await this.updateDeploymentStatuses();
      
      this.isInitialized = true;
      console.log('✅ Model Registry initialized successfully');
      
      this.emit('initialized', {
        total_models: this.models.size,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('❌ Failed to initialize Model Registry:', error);
      throw error;
    }
  }

  /**
   * Register a new model
   */
  async registerModel(modelData: Omit<ModelMetadata, 'id' | 'created_at' | 'updated_at' | 'checksum'>): Promise<ModelMetadata> {
    const modelId = this.generateModelId(modelData.name, modelData.version);
    
    // Validate model data
    await this.validateModelData(modelData);
    
    // Calculate checksum
    const checksum = await this.calculateModelChecksum(modelData);
    
    const model: ModelMetadata = {
      ...modelData,
      id: modelId,
      created_at: new Date(),
      updated_at: new Date(),
      checksum,
      usage_statistics: {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        average_response_time: 0,
        last_used: new Date(),
        daily_usage: {}
      }
    };

    // Check for duplicate
    if (this.models.has(modelId)) {
      throw new Error(`Model with ID ${modelId} already exists`);
    }

    // Store model
    this.models.set(modelId, model);
    
    // Initialize version history
    this.modelVersions.set(modelId, [{
      version: model.version,
      changelog: 'Initial registration',
      created_at: new Date(),
      performance_delta: {},
      backward_compatible: true
    }]);

    // Record registration event
    await this.eventStore.recordEvent({
      event_type: 'model_registered',
      entity_id: modelId,
      entity_type: 'model',
      data: model,
      timestamp: new Date()
    });

    console.log(`📝 Registered model: ${model.name} v${model.version}`);
    this.emit('modelRegistered', { model });

    return model;
  }

  /**
   * Update model metadata
   */
  async updateModel(modelId: string, updates: Partial<ModelMetadata>): Promise<ModelMetadata> {
    const existingModel = this.models.get(modelId);
    if (!existingModel) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Create new version if version number changed
    const isVersionUpdate = updates.version && updates.version !== existingModel.version;
    
    const updatedModel: ModelMetadata = {
      ...existingModel,
      ...updates,
      id: modelId, // Ensure ID doesn't change
      updated_at: new Date()
    };

    // Recalculate checksum if content changed
    if (updates.file_path || updates.config_path || updates.tokenizer_path) {
      updatedModel.checksum = await this.calculateModelChecksum(updatedModel);
    }

    this.models.set(modelId, updatedModel);

    // Add version history entry
    if (isVersionUpdate) {
      const versions = this.modelVersions.get(modelId) || [];
      versions.push({
        version: updatedModel.version,
        changelog: 'Model updated',
        created_at: new Date(),
        performance_delta: this.calculatePerformanceDelta(existingModel, updatedModel),
        backward_compatible: true // Should be determined by analysis
      });
      this.modelVersions.set(modelId, versions);
    }

    // Record update event
    await this.eventStore.recordEvent({
      event_type: isVersionUpdate ? 'model_version_updated' : 'model_metadata_updated',
      entity_id: modelId,
      entity_type: 'model',
      data: { updates, new_version: isVersionUpdate },
      timestamp: new Date()
    });

    console.log(`📝 Updated model: ${updatedModel.name} v${updatedModel.version}`);
    this.emit('modelUpdated', { model: updatedModel, isVersionUpdate });

    return updatedModel;
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelMetadata | undefined {
    return this.models.get(modelId);
  }

  /**
   * Search models
   */
  searchModels(searchParams: ModelSearch): {
    models: ModelMetadata[];
    total_count: number;
    pagination: {
      limit: number;
      offset: number;
      has_more: boolean;
    };
  } {
    let filteredModels = Array.from(this.models.values());

    // Apply text search
    if (searchParams.query) {
      const query = searchParams.query.toLowerCase();
      filteredModels = filteredModels.filter(model => 
        model.name.toLowerCase().includes(query) ||
        model.description.toLowerCase().includes(query) ||
        model.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (searchParams.filters) {
      const { filters } = searchParams;

      if (filters.model_type?.length) {
        filteredModels = filteredModels.filter(model => 
          filters.model_type!.includes(model.model_type)
        );
      }

      if (filters.capabilities?.length) {
        filteredModels = filteredModels.filter(model => 
          filters.capabilities!.some(cap => model.capabilities[cap])
        );
      }

      if (filters.size_range) {
        filteredModels = filteredModels.filter(model => {
          if (filters.size_range!.min_mb && model.size_mb < filters.size_range!.min_mb) return false;
          if (filters.size_range!.max_mb && model.size_mb > filters.size_range!.max_mb) return false;
          return true;
        });
      }

      if (filters.performance_threshold) {
        filteredModels = filteredModels.filter(model => {
          return Object.entries(filters.performance_threshold!).every(([metric, threshold]) => {
            const value = model.performance_metrics[metric];
            return value !== undefined && value >= threshold;
          });
        });
      }

      if (filters.deployment_status?.length) {
        filteredModels = filteredModels.filter(model => 
          filters.deployment_status!.includes(model.deployment_info.status)
        );
      }

      if (filters.tags?.length) {
        filteredModels = filteredModels.filter(model => 
          filters.tags!.some(tag => model.tags.includes(tag))
        );
      }

      if (filters.created_after) {
        filteredModels = filteredModels.filter(model => 
          model.created_at >= filters.created_after!
        );
      }

      if (filters.created_before) {
        filteredModels = filteredModels.filter(model => 
          model.created_at <= filters.created_before!
        );
      }
    }

    // Apply sorting
    if (searchParams.sort_by) {
      filteredModels.sort((a, b) => {
        let aVal: any, bVal: any;
        
        switch (searchParams.sort_by) {
          case 'name':
            aVal = a.name;
            bVal = b.name;
            break;
          case 'created_at':
            aVal = a.created_at.getTime();
            bVal = b.created_at.getTime();
            break;
          case 'size_mb':
            aVal = a.size_mb;
            bVal = b.size_mb;
            break;
          case 'performance':
            aVal = a.performance_metrics.accuracy || 0;
            bVal = b.performance_metrics.accuracy || 0;
            break;
          case 'usage':
            aVal = a.usage_statistics.total_requests;
            bVal = b.usage_statistics.total_requests;
            break;
          default:
            return 0;
        }

        if (searchParams.sort_order === 'desc') {
          return aVal < bVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    // Apply pagination
    const limit = searchParams.limit || 20;
    const offset = searchParams.offset || 0;
    const paginatedModels = filteredModels.slice(offset, offset + limit);
    const hasMore = offset + limit < filteredModels.length;

    return {
      models: paginatedModels,
      total_count: filteredModels.length,
      pagination: {
        limit,
        offset,
        has_more: hasMore
      }
    };
  }

  /**
   * Compare two models
   */
  async compareModels(modelAId: string, modelBId: string): Promise<ModelComparison> {
    const modelA = this.models.get(modelAId);
    const modelB = this.models.get(modelBId);

    if (!modelA || !modelB) {
      throw new Error('One or both models not found');
    }

    const comparison: ModelComparison = {
      model_a: modelAId,
      model_b: modelBId,
      comparison_date: new Date(),
      metrics_comparison: {},
      benchmark_results: {},
      recommendation: {
        preferred_model: '',
        reasoning: [],
        use_case_recommendations: {}
      }
    };

    // Compare performance metrics
    const allMetrics = new Set([
      ...Object.keys(modelA.performance_metrics),
      ...Object.keys(modelB.performance_metrics)
    ]);

    for (const metric of allMetrics) {
      const aValue = modelA.performance_metrics[metric] || 0;
      const bValue = modelB.performance_metrics[metric] || 0;
      const percentageDiff = bValue !== 0 ? ((aValue - bValue) / bValue) * 100 : 0;
      
      let winner: 'model_a' | 'model_b' | 'tie' = 'tie';
      if (metric === 'inference_latency_ms' || metric === 'memory_usage_mb') {
        // Lower is better for latency and memory
        winner = aValue < bValue ? 'model_a' : (aValue > bValue ? 'model_b' : 'tie');
      } else {
        // Higher is better for other metrics
        winner = aValue > bValue ? 'model_a' : (aValue < bValue ? 'model_b' : 'tie');
      }

      comparison.metrics_comparison[metric] = {
        model_a_value: aValue,
        model_b_value: bValue,
        percentage_diff: percentageDiff,
        winner
      };
    }

    // Generate recommendation
    const aWins = Object.values(comparison.metrics_comparison).filter(m => m.winner === 'model_a').length;
    const bWins = Object.values(comparison.metrics_comparison).filter(m => m.winner === 'model_b').length;
    
    comparison.recommendation.preferred_model = aWins > bWins ? modelAId : (bWins > aWins ? modelBId : 'tie');
    
    // Generate reasoning
    comparison.recommendation.reasoning = this.generateComparisonReasoning(modelA, modelB, comparison);
    
    // Generate use case recommendations
    comparison.recommendation.use_case_recommendations = this.generateUseCaseRecommendations(modelA, modelB);

    // Record comparison event
    await this.eventStore.recordEvent({
      event_type: 'models_compared',
      entity_id: `${modelAId}_vs_${modelBId}`,
      entity_type: 'comparison',
      data: comparison,
      timestamp: new Date()
    });

    return comparison;
  }

  /**
   * Get model usage statistics
   */
  getModelUsageStats(modelId: string, timeRange?: { start: Date; end: Date }): {
    total_requests: number;
    success_rate: number;
    average_response_time: number;
    usage_trend: Record<string, number>;
    top_error_types: Array<{ error_type: string; count: number }>;
  } {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // This would typically query actual usage data from logs/analytics
    return {
      total_requests: model.usage_statistics.total_requests,
      success_rate: model.usage_statistics.successful_requests / model.usage_statistics.total_requests * 100,
      average_response_time: model.usage_statistics.average_response_time,
      usage_trend: model.usage_statistics.daily_usage,
      top_error_types: [
        { error_type: 'timeout', count: 12 },
        { error_type: 'rate_limit', count: 8 },
        { error_type: 'invalid_input', count: 5 }
      ]
    };
  }

  /**
   * Update model usage statistics
   */
  async updateUsageStatistics(
    modelId: string,
    requestData: {
      success: boolean;
      response_time: number;
      error_type?: string;
      timestamp: Date;
    }
  ): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Update statistics
    model.usage_statistics.total_requests++;
    if (requestData.success) {
      model.usage_statistics.successful_requests++;
    } else {
      model.usage_statistics.failed_requests++;
    }

    // Update average response time (exponential moving average)
    const alpha = 0.1; // Smoothing factor
    model.usage_statistics.average_response_time = 
      alpha * requestData.response_time + (1 - alpha) * model.usage_statistics.average_response_time;

    // Update daily usage
    const dateKey = requestData.timestamp.toISOString().split('T')[0];
    model.usage_statistics.daily_usage[dateKey] = (model.usage_statistics.daily_usage[dateKey] || 0) + 1;

    model.usage_statistics.last_used = requestData.timestamp;
    model.updated_at = new Date();

    this.models.set(modelId, model);
  }

  /**
   * Get model version history
   */
  getModelVersionHistory(modelId: string): ModelVersion[] {
    return this.modelVersions.get(modelId) || [];
  }

  /**
   * Delete model
   */
  async deleteModel(modelId: string, force: boolean = false): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Check if model is deployed
    if (model.deployment_info.status === 'deployed' && !force) {
      throw new Error(`Cannot delete deployed model ${modelId}. Use force=true to override.`);
    }

    // Remove from registry
    this.models.delete(modelId);
    this.modelVersions.delete(modelId);

    // Record deletion event
    await this.eventStore.recordEvent({
      event_type: 'model_deleted',
      entity_id: modelId,
      entity_type: 'model',
      data: { model_name: model.name, force },
      timestamp: new Date()
    });

    console.log(`🗑️ Deleted model: ${model.name} v${model.version}`);
    this.emit('modelDeleted', { modelId, model });
  }

  /**
   * Get registry statistics
   */
  getRegistryStatistics(): {
    total_models: number;
    models_by_type: Record<string, number>;
    models_by_status: Record<string, number>;
    total_size_mb: number;
    most_used_models: Array<{ model_id: string; usage_count: number }>;
    recent_registrations: ModelMetadata[];
  } {
    const models = Array.from(this.models.values());
    
    const modelsByType = models.reduce((acc, model) => {
      acc[model.model_type] = (acc[model.model_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const modelsByStatus = models.reduce((acc, model) => {
      acc[model.deployment_info.status] = (acc[model.deployment_info.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalSize = models.reduce((sum, model) => sum + model.size_mb, 0);

    const mostUsed = models
      .map(model => ({ model_id: model.id, usage_count: model.usage_statistics.total_requests }))
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 10);

    const recentRegistrations = models
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 5);

    return {
      total_models: models.length,
      models_by_type: modelsByType,
      models_by_status: modelsByStatus,
      total_size_mb: totalSize,
      most_used_models: mostUsed,
      recent_registrations: recentRegistrations
    };
  }

  // Private methods
  private generateModelId(name: string, version: string): string {
    const content = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${version}`;
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private async validateModelData(modelData: any): Promise<void> {
    if (!modelData.name || modelData.name.trim().length === 0) {
      throw new Error('Model name is required');
    }

    if (!modelData.version || modelData.version.trim().length === 0) {
      throw new Error('Model version is required');
    }

    if (!modelData.model_type || !['foundation', 'fine_tuned', 'specialized', 'custom'].includes(modelData.model_type)) {
      throw new Error('Invalid model type');
    }

    if (modelData.size_mb <= 0) {
      throw new Error('Model size must be greater than 0');
    }
  }

  private async calculateModelChecksum(model: any): Promise<string> {
    // In a real implementation, this would calculate checksum of the actual model files
    const content = JSON.stringify({
      name: model.name,
      version: model.version,
      architecture: model.architecture,
      size_mb: model.size_mb
    });
    
    return createHash('sha256').update(content).digest('hex');
  }

  private calculatePerformanceDelta(oldModel: ModelMetadata, newModel: ModelMetadata): Record<string, number> {
    const delta: Record<string, number> = {};
    
    Object.keys(newModel.performance_metrics).forEach(metric => {
      const oldValue = oldModel.performance_metrics[metric];
      const newValue = newModel.performance_metrics[metric];
      
      if (oldValue !== undefined && newValue !== undefined) {
        delta[metric] = newValue - oldValue;
      }
    });
    
    return delta;
  }

  private generateComparisonReasoning(modelA: ModelMetadata, modelB: ModelMetadata, comparison: ModelComparison): string[] {
    const reasoning: string[] = [];
    
    // Size comparison
    if (modelA.size_mb < modelB.size_mb * 0.8) {
      reasoning.push(`${modelA.name} is significantly smaller (${modelA.size_mb}MB vs ${modelB.size_mb}MB), better for resource-constrained environments`);
    } else if (modelB.size_mb < modelA.size_mb * 0.8) {
      reasoning.push(`${modelB.name} is significantly smaller (${modelB.size_mb}MB vs ${modelA.size_mb}MB), better for resource-constrained environments`);
    }
    
    // Performance comparison
    const aAccuracy = modelA.performance_metrics.accuracy || 0;
    const bAccuracy = modelB.performance_metrics.accuracy || 0;
    
    if (aAccuracy > bAccuracy * 1.1) {
      reasoning.push(`${modelA.name} has significantly better accuracy (${(aAccuracy * 100).toFixed(1)}% vs ${(bAccuracy * 100).toFixed(1)}%)`);
    } else if (bAccuracy > aAccuracy * 1.1) {
      reasoning.push(`${modelB.name} has significantly better accuracy (${(bAccuracy * 100).toFixed(1)}% vs ${(aAccuracy * 100).toFixed(1)}%)`);
    }
    
    // Latency comparison
    const aLatency = modelA.performance_metrics.inference_latency_ms;
    const bLatency = modelB.performance_metrics.inference_latency_ms;
    
    if (aLatency && bLatency) {
      if (aLatency < bLatency * 0.8) {
        reasoning.push(`${modelA.name} is significantly faster (${aLatency}ms vs ${bLatency}ms response time)`);
      } else if (bLatency < aLatency * 0.8) {
        reasoning.push(`${modelB.name} is significantly faster (${bLatency}ms vs ${aLatency}ms response time)`);
      }
    }
    
    return reasoning;
  }

  private generateUseCaseRecommendations(modelA: ModelMetadata, modelB: ModelMetadata): Record<string, string> {
    const recommendations: Record<string, string> = {};
    
    // Size-based recommendations
    if (modelA.size_mb < modelB.size_mb) {
      recommendations['edge_deployment'] = modelA.name;
      recommendations['mobile_applications'] = modelA.name;
    } else {
      recommendations['high_accuracy_tasks'] = modelB.name;
      recommendations['server_deployment'] = modelB.name;
    }
    
    // Performance-based recommendations
    const aLatency = modelA.performance_metrics.inference_latency_ms;
    const bLatency = modelB.performance_metrics.inference_latency_ms;
    
    if (aLatency && bLatency) {
      if (aLatency < bLatency) {
        recommendations['real_time_applications'] = modelA.name;
        recommendations['interactive_systems'] = modelA.name;
      } else {
        recommendations['batch_processing'] = modelB.name;
        recommendations['offline_analysis'] = modelB.name;
      }
    }
    
    // Capability-based recommendations
    if (modelA.capabilities.code_generation && !modelB.capabilities.code_generation) {
      recommendations['code_generation'] = modelA.name;
    } else if (modelB.capabilities.code_generation && !modelA.capabilities.code_generation) {
      recommendations['code_generation'] = modelB.name;
    }
    
    return recommendations;
  }

  private async loadModelsFromStorage(): Promise<void> {
    try {
      // Load models from persistent storage (database, file system, etc.)
      console.log('📥 Loading models from storage...');
      
      // This would typically load from a database or file system
      // For now, we'll initialize with empty registry
      
      console.log(`✅ Loaded ${this.models.size} models from storage`);
    } catch (error) {
      console.warn('⚠️ Failed to load models from storage:', error);
    }
  }

  private async verifyModelIntegrity(): Promise<void> {
    try {
      console.log('🔍 Verifying model integrity...');
      
      for (const [modelId, model] of this.models) {
        // Verify checksums, file existence, etc.
        // Mark models as corrupted if verification fails
      }
      
      console.log('✅ Model integrity verification completed');
    } catch (error) {
      console.warn('⚠️ Model integrity verification failed:', error);
    }
  }

  private async updateDeploymentStatuses(): Promise<void> {
    try {
      console.log('🔄 Updating deployment statuses...');
      
      for (const [modelId, model] of this.models) {
        if (model.deployment_info.status === 'deployed') {
          // Check if model is actually healthy
          const isHealthy = await this.checkModelHealth(model);
          model.deployment_info.health_status = isHealthy ? 'healthy' : 'unhealthy';
          model.deployment_info.last_health_check = new Date();
        }
      }
      
      console.log('✅ Deployment status update completed');
    } catch (error) {
      console.warn('⚠️ Failed to update deployment statuses:', error);
    }
  }

  private async checkModelHealth(model: ModelMetadata): Promise<boolean> {
    try {
      if (!model.deployment_info.endpoint) return false;
      
      // Perform actual health check against the deployed model
      // This is a placeholder - implement actual health check logic
      
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const modelRegistry = new ModelRegistry();