import { EventEmitter } from 'events';
import { ModelHealthStatus, ModelMetrics, ModelPerformanceConfig } from './types';
import { llmService } from '../llmService';

export class ModelHealthMonitor extends EventEmitter {
  private healthStatuses: Map<string, ModelHealthStatus> = new Map();
  private metrics: Map<string, ModelMetrics> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: ModelPerformanceConfig;
  private isInitialized = false;

  constructor(config: ModelPerformanceConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔍 Initializing Model Health Monitor...');
      
      // Get available models
      const models = await llmService.getModels();
      console.log(`📊 Found ${models.length} models to monitor`);
      
      // Initialize health status for each model
      for (const model of models) {
        await this.initializeModelHealth(model);
      }
      
      this.isInitialized = true;
      console.log('✅ Model Health Monitor initialized successfully');
      
      this.emit('initialized', { modelsCount: models.length });
    } catch (error) {
      console.error('❌ Failed to initialize Model Health Monitor:', error);
      throw error;
    }
  }

  private async initializeModelHealth(modelName: string): Promise<void> {
    const healthStatus: ModelHealthStatus = {
      modelName,
      status: 'offline',
      lastHealthCheck: new Date(),
      responseTime: 0,
      errorCount: 0,
      healthScore: 0,
      issues: [],
      uptime: 0
    };

    const metrics: ModelMetrics = {
      modelName,
      averageResponseTime: 0,
      successRate: 0,
      errorRate: 0,
      tokensPerSecond: 0,
      lastUpdated: new Date(),
      totalRequests: 0,
      failedRequests: 0,
      averageTokens: 0,
      peakMemoryUsage: 0,
      cpuUsage: 0
    };

    this.healthStatuses.set(modelName, healthStatus);
    this.metrics.set(modelName, metrics);

    // Start health checks
    this.startHealthChecks(modelName);
  }

  private startHealthChecks(modelName: string): void {
    const interval = setInterval(async () => {
      await this.performHealthCheck(modelName);
    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(modelName, interval);
  }

  private async performHealthCheck(modelName: string): Promise<void> {
    const startTime = Date.now();
    const healthStatus = this.healthStatuses.get(modelName);
    
    if (!healthStatus) return;

    try {
      // Simple health check prompt
      const testPrompt = 'Say "OK" if you are working correctly.';
      const response = await llmService.generate(testPrompt, modelName, {
        temperature: 0.1,
        num_predict: 10
      });

      const responseTime = Date.now() - startTime;
      const issues: string[] = [];

      // Check response time
      if (responseTime > this.config.maxResponseTime) {
        issues.push(`High response time: ${responseTime}ms`);
      }

      // Check response validity
      if (!response.response || response.response.trim().length === 0) {
        issues.push('Empty response received');
      }

      // Calculate health score
      let healthScore = 100;
      if (responseTime > this.config.maxResponseTime) {
        healthScore -= 30;
      }
      if (issues.length > 0) {
        healthScore -= issues.length * 20;
      }
      if (healthStatus.errorCount > 5) {
        healthScore -= 20;
      }

      // Update health status
      const updatedStatus: ModelHealthStatus = {
        ...healthStatus,
        status: this.determineHealthStatus(healthScore, issues.length),
        lastHealthCheck: new Date(),
        responseTime,
        healthScore: Math.max(0, healthScore),
        issues,
        uptime: healthStatus.uptime + this.config.healthCheckInterval
      };

      this.healthStatuses.set(modelName, updatedStatus);
      this.updateMetrics(modelName, responseTime, true);

      // Emit health check event
      this.emit('healthCheck', {
        modelName,
        status: updatedStatus.status,
        healthScore: updatedStatus.healthScore,
        responseTime,
        issues
      });

      // Check for alerts
      await this.checkAlerts(modelName, updatedStatus);

    } catch (error) {
      console.error(`❌ Health check failed for model ${modelName}:`, error);
      
      const errorStatus: ModelHealthStatus = {
        ...healthStatus,
        status: 'unhealthy',
        lastHealthCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorCount: healthStatus.errorCount + 1,
        healthScore: Math.max(0, healthStatus.healthScore - 25),
        issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };

      this.healthStatuses.set(modelName, errorStatus);
      this.updateMetrics(modelName, Date.now() - startTime, false);

      this.emit('healthCheckFailed', {
        modelName,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCount: errorStatus.errorCount
      });
    }
  }

  private determineHealthStatus(healthScore: number, issueCount: number): 'healthy' | 'degraded' | 'unhealthy' | 'offline' {
    if (healthScore >= 80 && issueCount === 0) return 'healthy';
    if (healthScore >= 60 && issueCount <= 2) return 'degraded';
    if (healthScore >= 20) return 'unhealthy';
    return 'offline';
  }

  private updateMetrics(modelName: string, responseTime: number, success: boolean): void {
    const metrics = this.metrics.get(modelName);
    if (!metrics) return;

    const totalRequests = metrics.totalRequests + 1;
    const failedRequests = success ? metrics.failedRequests : metrics.failedRequests + 1;
    const successRate = ((totalRequests - failedRequests) / totalRequests) * 100;
    const errorRate = (failedRequests / totalRequests) * 100;

    // Update average response time using exponential moving average
    const avgResponseTime = metrics.averageResponseTime === 0 
      ? responseTime 
      : (metrics.averageResponseTime * 0.8) + (responseTime * 0.2);

    const updatedMetrics: ModelMetrics = {
      ...metrics,
      averageResponseTime: avgResponseTime,
      successRate,
      errorRate,
      lastUpdated: new Date(),
      totalRequests,
      failedRequests
    };

    this.metrics.set(modelName, updatedMetrics);
  }

  private async checkAlerts(modelName: string, status: ModelHealthStatus): Promise<void> {
    const alerts: string[] = [];

    if (status.responseTime > this.config.alertThresholds.responseTime) {
      alerts.push(`High response time: ${status.responseTime}ms`);
    }

    const metrics = this.metrics.get(modelName);
    if (metrics && metrics.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push(`High error rate: ${metrics.errorRate.toFixed(2)}%`);
    }

    if (status.healthScore < this.config.minHealthScore) {
      alerts.push(`Low health score: ${status.healthScore}`);
    }

    if (alerts.length > 0) {
      this.emit('alert', {
        modelName,
        alerts,
        severity: status.status === 'unhealthy' ? 'critical' : 'warning',
        timestamp: new Date()
      });
    }
  }

  public getModelHealth(modelName: string): ModelHealthStatus | undefined {
    return this.healthStatuses.get(modelName);
  }

  public getModelMetrics(modelName: string): ModelMetrics | undefined {
    return this.metrics.get(modelName);
  }

  public getAllHealthStatuses(): Map<string, ModelHealthStatus> {
    return new Map(this.healthStatuses);
  }

  public getAllMetrics(): Map<string, ModelMetrics> {
    return new Map(this.metrics);
  }

  public getHealthyModels(): string[] {
    return Array.from(this.healthStatuses.entries())
      .filter(([_, status]) => status.status === 'healthy')
      .map(([modelName]) => modelName);
  }

  public getUnhealthyModels(): string[] {
    return Array.from(this.healthStatuses.entries())
      .filter(([_, status]) => status.status === 'unhealthy' || status.status === 'offline')
      .map(([modelName]) => modelName);
  }

  public async refreshModelList(): Promise<void> {
    try {
      const models = await llmService.getModels();
      const currentModels = new Set(this.healthStatuses.keys());
      const newModels = models.filter(model => !currentModels.has(model));
      const removedModels = Array.from(currentModels).filter(model => !models.includes(model));

      // Add new models
      for (const model of newModels) {
        await this.initializeModelHealth(model);
        console.log(`➕ Added monitoring for new model: ${model}`);
      }

      // Remove deleted models
      for (const model of removedModels) {
        const interval = this.healthCheckIntervals.get(model);
        if (interval) {
          clearInterval(interval);
          this.healthCheckIntervals.delete(model);
        }
        this.healthStatuses.delete(model);
        this.metrics.delete(model);
        console.log(`➖ Removed monitoring for deleted model: ${model}`);
      }

      if (newModels.length > 0 || removedModels.length > 0) {
        this.emit('modelListUpdated', {
          added: newModels,
          removed: removedModels,
          total: models.length
        });
      }
    } catch (error) {
      console.error('❌ Failed to refresh model list:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Model Health Monitor...');
    
    // Clear all intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    
    this.healthCheckIntervals.clear();
    this.healthStatuses.clear();
    this.metrics.clear();
    this.isInitialized = false;
    
    console.log('✅ Model Health Monitor shutdown complete');
  }

  public updateConfig(newConfig: Partial<ModelPerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Model Health Monitor configuration updated');
  }

  public getStatus(): {
    initialized: boolean;
    modelsMonitored: number;
    healthyModels: number;
    unhealthyModels: number;
    totalChecks: number;
  } {
    const healthyCount = this.getHealthyModels().length;
    const unhealthyCount = this.getUnhealthyModels().length;
    const totalChecks = Array.from(this.metrics.values())
      .reduce((sum, metrics) => sum + metrics.totalRequests, 0);

    return {
      initialized: this.isInitialized,
      modelsMonitored: this.healthStatuses.size,
      healthyModels: healthyCount,
      unhealthyModels: unhealthyCount,
      totalChecks
    };
  }
}