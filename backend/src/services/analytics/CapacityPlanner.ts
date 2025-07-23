import { PredictiveAnalytics, CapacityPrediction } from './PredictiveAnalytics';
import { AnalyticsEngine } from './AnalyticsEngine';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { EventStore } from './EventStore';
import { LRUCache } from 'lru-cache';

export interface CapacityModel {
  id: string;
  resource: string;
  currentCapacity: number;
  utilizationHistory: Array<{
    timestamp: Date;
    utilization: number;
    peak: number;
    average: number;
  }>;
  growthTrend: {
    rate: number; // percentage per day
    confidence: number;
    seasonality: {
      daily: number[];
      weekly: number[];
      monthly: number[];
    };
  };
  thresholds: {
    warning: number; // utilization percentage
    critical: number;
    maximum: number;
  };
  forecasts: Array<{
    timeframe: string;
    predictedUtilization: number;
    confidence: number;
    willExceedThreshold: boolean;
    recommendedAction: string;
  }>;
}

export interface ScalingRecommendation {
  id: string;
  resource: string;
  currentState: {
    capacity: number;
    utilization: number;
    performance: string;
  };
  recommendation: {
    action: 'scale_up' | 'scale_down' | 'maintain' | 'optimize';
    targetCapacity: number;
    timeframe: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedCost: number;
    expectedBenefit: string;
  };
  reasoning: {
    factors: string[];
    dataPoints: Array<{
      metric: string;
      current: number;
      predicted: number;
      threshold: number;
    }>;
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
    };
  };
  implementation: {
    steps: string[];
    estimatedTime: string;
    rollbackPlan: string[];
    monitoringPoints: string[];
  };
}

export interface CapacityAlert {
  id: string;
  timestamp: Date;
  resource: string;
  alertType: 'threshold_exceeded' | 'prediction_warning' | 'capacity_exhaustion' | 'optimization_opportunity';
  severity: 'info' | 'warning' | 'critical';
  current: {
    utilization: number;
    capacity: number;
    performance: any;
  };
  prediction: {
    timeToThreshold: Date | null;
    peakUtilization: number;
    confidence: number;
  };
  message: string;
  recommendations: string[];
  autoResolve: boolean;
  resolved: boolean;
}

export interface ResourceMetrics {
  cpu: {
    cores: number;
    utilization: number;
    peak24h: number;
    average24h: number;
    trend: number;
  };
  memory: {
    total: number;
    used: number;
    utilization: number;
    peak24h: number;
    average24h: number;
    trend: number;
  };
  storage: {
    total: number;
    used: number;
    utilization: number;
    iops: number;
    throughput: number;
    trend: number;
  };
  network: {
    bandwidth: number;
    utilization: number;
    latency: number;
    packetLoss: number;
    trend: number;
  };
  application: {
    concurrent_users: number;
    requests_per_second: number;
    queue_size: number;
    response_time: number;
    error_rate: number;
  };
}

export class CapacityPlanner {
  private predictiveAnalytics: PredictiveAnalytics;
  private analyticsEngine: AnalyticsEngine;
  private performanceMonitor: PerformanceMonitor;
  private eventStore: EventStore;
  private cache: LRUCache<string, any>;
  private capacityModels: Map<string, CapacityModel>;
  private alerts: Map<string, CapacityAlert>;
  private recommendations: Map<string, ScalingRecommendation>;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.predictiveAnalytics = new PredictiveAnalytics();
    this.analyticsEngine = AnalyticsEngine.getInstance();
    this.performanceMonitor = new PerformanceMonitor();
    this.eventStore = EventStore.getInstance();
    
    this.cache = new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 15 // 15 minutes cache
    });

    this.capacityModels = new Map();
    this.alerts = new Map();
    this.recommendations = new Map();

    this.initializeCapacityModels();
  }

  /**
   * Start capacity monitoring and planning
   */
  public startMonitoring(intervalMs: number = 300000): void { // 5 minutes default
    if (this.isMonitoring) {
      console.log('Capacity monitoring already running');
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting capacity monitoring with ${intervalMs}ms interval`);

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performCapacityAnalysis();
      } catch (error) {
        console.error('Error during capacity analysis:', error);
      }
    }, intervalMs);

    // Perform initial analysis
    this.performCapacityAnalysis();
  }

  /**
   * Stop capacity monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Capacity monitoring stopped');
  }

  /**
   * Generate comprehensive capacity forecast
   */
  public async generateCapacityForecast(
    resources: string[] = ['cpu', 'memory', 'storage', 'network'],
    timeframes: string[] = ['1h', '6h', '24h', '7d', '30d']
  ): Promise<Map<string, CapacityPrediction[]>> {
    const forecasts = new Map<string, CapacityPrediction[]>();

    for (const resource of resources) {
      const resourceForecasts: CapacityPrediction[] = [];

      for (const timeframe of timeframes) {
        try {
          const prediction = await this.predictiveAnalytics.predictCapacity(
            `${resource}_usage`,
            timeframe as any
          );
          resourceForecasts.push(prediction);
        } catch (error) {
          console.warn(`Failed to generate forecast for ${resource} at ${timeframe}:`, error.message);
        }
      }

      if (resourceForecasts.length > 0) {
        forecasts.set(resource, resourceForecasts);
      }
    }

    return forecasts;
  }

  /**
   * Generate scaling recommendations
   */
  public async generateScalingRecommendations(): Promise<ScalingRecommendation[]> {
    const recommendations: ScalingRecommendation[] = [];
    const currentMetrics = await this.getCurrentResourceMetrics();

    // Analyze each resource type
    for (const [resource, metrics] of Object.entries(currentMetrics)) {
      if (resource === 'application') continue; // Skip application metrics for scaling

      try {
        const recommendation = await this.analyzeResourceScaling(resource, metrics);
        if (recommendation) {
          recommendations.push(recommendation);
          this.recommendations.set(recommendation.id, recommendation);
        }
      } catch (error) {
        console.error(`Error analyzing scaling for ${resource}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Analyze resource scaling needs
   */
  private async analyzeResourceScaling(
    resource: string,
    metrics: any
  ): Promise<ScalingRecommendation | null> {
    const utilizationKey = `${resource}_utilization`;
    const currentUtilization = metrics.utilization || 0;
    
    // Get capacity model for this resource
    const model = this.capacityModels.get(resource);
    if (!model) {
      await this.createCapacityModel(resource);
    }

    // Get predictions for different timeframes
    const predictions = await Promise.all([
      this.predictiveAnalytics.predictCapacity(`${resource}_usage`, '6h'),
      this.predictiveAnalytics.predictCapacity(`${resource}_usage`, '24h'),
      this.predictiveAnalytics.predictCapacity(`${resource}_usage`, '7d')
    ]);

    // Determine scaling action
    const scalingAction = this.determineScalingAction(currentUtilization, predictions, model);
    
    if (scalingAction.action === 'maintain') {
      return null; // No scaling needed
    }

    // Calculate target capacity
    const targetCapacity = this.calculateTargetCapacity(
      resource,
      currentUtilization,
      predictions,
      scalingAction.action
    );

    // Estimate cost and benefit
    const costBenefit = this.estimateCostBenefit(resource, scalingAction.action, targetCapacity);

    // Assess risks
    const riskAssessment = this.assessScalingRisks(resource, scalingAction.action, predictions);

    const recommendation: ScalingRecommendation = {
      id: `scaling_${resource}_${Date.now()}`,
      resource,
      currentState: {
        capacity: metrics.total || metrics.cores || 100,
        utilization: currentUtilization,
        performance: this.assessPerformance(resource, metrics)
      },
      recommendation: {
        action: scalingAction.action,
        targetCapacity,
        timeframe: scalingAction.timeframe,
        priority: scalingAction.priority,
        estimatedCost: costBenefit.cost,
        expectedBenefit: costBenefit.benefit
      },
      reasoning: {
        factors: scalingAction.factors,
        dataPoints: predictions.map(p => ({
          metric: p.metric,
          current: p.currentValue,
          predicted: p.predictedValue,
          threshold: p.threshold
        })),
        riskAssessment
      },
      implementation: {
        steps: this.generateImplementationSteps(resource, scalingAction.action),
        estimatedTime: this.estimateImplementationTime(resource, scalingAction.action),
        rollbackPlan: this.generateRollbackPlan(resource, scalingAction.action),
        monitoringPoints: this.generateMonitoringPoints(resource)
      }
    };

    return recommendation;
  }

  /**
   * Create growth projections with ML models
   */
  public async createGrowthProjections(
    resource: string,
    projectionDays: number = 30
  ): Promise<{
    current: number;
    projected: number;
    growthRate: number;
    seasonality: {
      daily: number[];
      weekly: number[];
    };
    scenarios: {
      optimistic: number;
      realistic: number;
      pessimistic: number;
    };
    recommendations: string[];
  }> {
    const cacheKey = `growth_projection_${resource}_${projectionDays}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Get growth projections from predictive analytics
    const projections = await this.predictiveAnalytics.getGrowthProjections(
      `${resource}_usage`,
      projectionDays
    );

    // Analyze seasonality patterns
    const seasonality = await this.analyzeSeasonality(resource, projectionDays * 2);

    // Generate different scenarios
    const scenarios = this.generateScenarios(projections.projected, projections.growthRate);

    // Generate recommendations based on projections
    const recommendations = this.generateGrowthRecommendations(
      resource,
      projections.current,
      scenarios,
      projections.growthRate
    );

    const result = {
      current: projections.current,
      projected: projections.projected,
      growthRate: projections.growthRate,
      seasonality,
      scenarios,
      recommendations
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Generate capacity optimization recommendations
   */
  public async generateOptimizationRecommendations(): Promise<{
    cpu: string[];
    memory: string[];
    storage: string[];
    network: string[];
    application: string[];
    cost: string[];
  }> {
    const recommendations = {
      cpu: [],
      memory: [],
      storage: [],
      network: [],
      application: [],
      cost: []
    };

    const metrics = await this.getCurrentResourceMetrics();
    const forecasts = await this.generateCapacityForecast();

    // CPU optimization
    if (metrics.cpu.utilization < 30) {
      recommendations.cpu.push('CPU utilization is low - consider downsizing instances');
      recommendations.cost.push('Potential cost savings from CPU optimization');
    } else if (metrics.cpu.utilization > 80) {
      recommendations.cpu.push('CPU utilization is high - consider scaling up or optimizing workloads');
    }

    // Memory optimization
    if (metrics.memory.utilization < 40) {
      recommendations.memory.push('Memory utilization is low - review memory allocation');
      recommendations.cost.push('Potential cost savings from memory optimization');
    } else if (metrics.memory.utilization > 85) {
      recommendations.memory.push('Memory utilization is high - consider adding memory or optimizing usage');
    }

    // Storage optimization
    if (metrics.storage.utilization > 80) {
      recommendations.storage.push('Storage utilization is high - plan for capacity expansion');
    }
    if (metrics.storage.iops > 1000) {
      recommendations.storage.push('High IOPS detected - consider faster storage or caching');
    }

    // Network optimization
    if (metrics.network.latency > 100) {
      recommendations.network.push('High network latency detected - investigate network bottlenecks');
    }
    if (metrics.network.utilization > 70) {
      recommendations.network.push('Network utilization is high - consider bandwidth upgrade');
    }

    // Application optimization
    if (metrics.application.response_time > 2000) {
      recommendations.application.push('High response times - optimize application performance');
    }
    if (metrics.application.queue_size > 100) {
      recommendations.application.push('Large queue size - consider horizontal scaling');
    }
    if (metrics.application.error_rate > 1) {
      recommendations.application.push('High error rate - investigate and fix application issues');
    }

    return recommendations;
  }

  /**
   * Get capacity alerts
   */
  public getCapacityAlerts(): CapacityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }

  /**
   * Get capacity dashboard data
   */
  public async getCapacityDashboard(): Promise<{
    overview: {
      totalResources: number;
      resourcesAtRisk: number;
      upcomingThresholds: number;
      optimizationOpportunities: number;
    };
    resources: ResourceMetrics;
    alerts: CapacityAlert[];
    recommendations: ScalingRecommendation[];
    forecasts: any;
    trends: {
      cpu: number[];
      memory: number[];
      storage: number[];
      network: number[];
    };
  }> {
    const [resources, alerts, recommendations, forecasts, trends] = await Promise.all([
      this.getCurrentResourceMetrics(),
      Promise.resolve(this.getCapacityAlerts()),
      this.generateScalingRecommendations(),
      this.generateCapacityForecast(),
      this.getResourceTrends()
    ]);

    const resourcesAtRisk = alerts.filter(a => a.severity === 'critical').length;
    const upcomingThresholds = alerts.filter(a => 
      a.alertType === 'prediction_warning' && 
      a.prediction.timeToThreshold
    ).length;
    const optimizationOpportunities = recommendations.filter(r => 
      r.recommendation.action === 'optimize'
    ).length;

    return {
      overview: {
        totalResources: Object.keys(resources).length - 1, // Exclude application
        resourcesAtRisk,
        upcomingThresholds,
        optimizationOpportunities
      },
      resources,
      alerts,
      recommendations,
      forecasts: Object.fromEntries(forecasts),
      trends
    };
  }

  // Private helper methods

  private async initializeCapacityModels(): Promise<void> {
    const resources = ['cpu', 'memory', 'storage', 'network'];
    
    for (const resource of resources) {
      try {
        await this.createCapacityModel(resource);
      } catch (error) {
        console.warn(`Failed to initialize capacity model for ${resource}:`, error.message);
      }
    }
  }

  private async createCapacityModel(resource: string): Promise<CapacityModel> {
    // Get historical utilization data
    const utilizationHistory = await this.getUtilizationHistory(resource, 30); // 30 days

    // Calculate growth trend
    const growthTrend = this.calculateGrowthTrend(utilizationHistory);

    // Analyze seasonality
    const seasonality = await this.analyzeSeasonality(resource, 30);

    // Set thresholds based on resource type
    const thresholds = this.getResourceThresholds(resource);

    // Generate forecasts
    const forecasts = await this.generateResourceForecasts(resource);

    const model: CapacityModel = {
      id: `capacity_${resource}_${Date.now()}`,
      resource,
      currentCapacity: await this.getCurrentCapacity(resource),
      utilizationHistory,
      growthTrend: {
        rate: growthTrend.rate,
        confidence: growthTrend.confidence,
        seasonality
      },
      thresholds,
      forecasts
    };

    this.capacityModels.set(resource, model);
    return model;
  }

  private async performCapacityAnalysis(): Promise<void> {
    try {
      // Update capacity models
      for (const resource of this.capacityModels.keys()) {
        await this.updateCapacityModel(resource);
      }

      // Check for threshold violations
      await this.checkCapacityThresholds();

      // Generate alerts if needed
      await this.generateCapacityAlerts();

      // Update cache
      this.cache.set('last_analysis', {
        timestamp: new Date(),
        models: this.capacityModels.size,
        alerts: this.alerts.size
      });

    } catch (error) {
      console.error('Error during capacity analysis:', error);
    }
  }

  private async updateCapacityModel(resource: string): Promise<void> {
    const model = this.capacityModels.get(resource);
    if (!model) return;

    // Get latest utilization data
    const latestUtilization = await this.getLatestUtilization(resource);
    
    // Update utilization history
    model.utilizationHistory.push({
      timestamp: new Date(),
      utilization: latestUtilization.current,
      peak: latestUtilization.peak,
      average: latestUtilization.average
    });

    // Keep only last 1000 data points
    if (model.utilizationHistory.length > 1000) {
      model.utilizationHistory = model.utilizationHistory.slice(-1000);
    }

    // Recalculate growth trend
    model.growthTrend = {
      ...model.growthTrend,
      rate: this.calculateGrowthTrend(model.utilizationHistory).rate
    };

    // Update forecasts
    model.forecasts = await this.generateResourceForecasts(resource);
  }

  private async checkCapacityThresholds(): Promise<void> {
    const metrics = await this.getCurrentResourceMetrics();

    for (const [resource, resourceMetrics] of Object.entries(metrics)) {
      if (resource === 'application') continue;

      const model = this.capacityModels.get(resource);
      if (!model) continue;

      const utilization = resourceMetrics.utilization || 0;

      // Check immediate thresholds
      if (utilization > model.thresholds.critical) {
        this.createCapacityAlert(
          resource,
          'threshold_exceeded',
          'critical',
          `${resource} utilization exceeded critical threshold`,
          utilization,
          model
        );
      } else if (utilization > model.thresholds.warning) {
        this.createCapacityAlert(
          resource,
          'threshold_exceeded',
          'warning',
          `${resource} utilization exceeded warning threshold`,
          utilization,
          model
        );
      }

      // Check predictions
      const predictions = await this.predictiveAnalytics.predictCapacity(`${resource}_usage`, '24h');
      
      if (predictions.willExceedThreshold && predictions.timeToThreshold) {
        this.createCapacityAlert(
          resource,
          'prediction_warning',
          'warning',
          `${resource} predicted to exceed threshold within 24 hours`,
          utilization,
          model,
          predictions.timeToThreshold
        );
      }
    }
  }

  private createCapacityAlert(
    resource: string,
    alertType: CapacityAlert['alertType'],
    severity: CapacityAlert['severity'],
    message: string,
    currentUtilization: number,
    model: CapacityModel,
    timeToThreshold?: Date
  ): void {
    const alertId = `capacity_${resource}_${alertType}_${Date.now()}`;
    
    // Check if similar alert already exists
    const existingAlert = Array.from(this.alerts.values())
      .find(alert => 
        alert.resource === resource && 
        alert.alertType === alertType &&
        !alert.resolved &&
        (Date.now() - alert.timestamp.getTime()) < 30 * 60 * 1000 // 30 minutes
      );

    if (existingAlert) return; // Don't create duplicate alerts

    const alert: CapacityAlert = {
      id: alertId,
      timestamp: new Date(),
      resource,
      alertType,
      severity,
      current: {
        utilization: currentUtilization,
        capacity: model.currentCapacity,
        performance: {} // Would include performance metrics
      },
      prediction: {
        timeToThreshold,
        peakUtilization: Math.max(...model.utilizationHistory.map(h => h.peak)),
        confidence: model.growthTrend.confidence
      },
      message,
      recommendations: this.generateAlertRecommendations(resource, alertType, currentUtilization),
      autoResolve: severity === 'info',
      resolved: false
    };

    this.alerts.set(alertId, alert);
    console.log(`Capacity alert created: ${message}`);
  }

  private generateAlertRecommendations(
    resource: string,
    alertType: string,
    utilization: number
  ): string[] {
    const recommendations: string[] = [];

    if (alertType === 'threshold_exceeded') {
      recommendations.push(`Immediate action required for ${resource}`);
      recommendations.push('Consider scaling resources');
      recommendations.push('Investigate high utilization causes');
    }

    if (alertType === 'prediction_warning') {
      recommendations.push(`Plan capacity expansion for ${resource}`);
      recommendations.push('Monitor growth trends closely');
      recommendations.push('Prepare scaling procedures');
    }

    if (utilization > 90) {
      recommendations.push('Critical utilization - immediate scaling recommended');
    }

    return recommendations;
  }

  // Additional helper methods would be implemented here...
  // (Simplified for space considerations)

  private async getCurrentResourceMetrics(): Promise<ResourceMetrics> {
    // Implementation to get current resource metrics
    return {
      cpu: { cores: 4, utilization: 65, peak24h: 80, average24h: 60, trend: 0.5 },
      memory: { total: 16000, used: 10000, utilization: 62.5, peak24h: 75, average24h: 58, trend: 0.3 },
      storage: { total: 1000000, used: 600000, utilization: 60, iops: 500, throughput: 100, trend: 0.8 },
      network: { bandwidth: 1000, utilization: 40, latency: 50, packetLoss: 0.1, trend: 0.2 },
      application: { concurrent_users: 150, requests_per_second: 45, queue_size: 12, response_time: 800, error_rate: 0.5 }
    };
  }

  private determineScalingAction(
    currentUtilization: number,
    predictions: CapacityPrediction[],
    model?: CapacityModel
  ): {
    action: ScalingRecommendation['recommendation']['action'];
    timeframe: string;
    priority: ScalingRecommendation['recommendation']['priority'];
    factors: string[];
  } {
    const factors: string[] = [];
    let action: ScalingRecommendation['recommendation']['action'] = 'maintain';
    let priority: ScalingRecommendation['recommendation']['priority'] = 'low';
    let timeframe = 'within 7 days';

    // Determine action based on current utilization and predictions
    const maxPredicted = Math.max(...predictions.map(p => p.predictedValue));
    
    if (currentUtilization > 85 || maxPredicted > 90) {
      action = 'scale_up';
      priority = 'high';
      timeframe = 'within 24 hours';
      factors.push('High current or predicted utilization');
    } else if (currentUtilization < 20 && maxPredicted < 30) {
      action = 'scale_down';
      priority = 'medium';
      timeframe = 'within 7 days';
      factors.push('Low utilization indicates over-provisioning');
    } else if (currentUtilization > 70) {
      action = 'optimize';
      priority = 'medium';
      factors.push('Moderate utilization - optimization opportunities exist');
    }

    return { action, timeframe, priority, factors };
  }

  private calculateTargetCapacity(
    resource: string,
    currentUtilization: number,
    predictions: CapacityPrediction[],
    action: string
  ): number {
    const maxPredicted = Math.max(...predictions.map(p => p.predictedValue));
    
    switch (action) {
      case 'scale_up':
        // Target 70% utilization of new capacity
        return Math.ceil((maxPredicted * 1.2) / 0.7);
      case 'scale_down':
        // Target 60% utilization of new capacity
        return Math.ceil((maxPredicted * 1.1) / 0.6);
      default:
        return 100; // Maintain current
    }
  }

  private estimateCostBenefit(
    resource: string,
    action: string,
    targetCapacity: number
  ): { cost: number; benefit: string } {
    // Simplified cost estimation
    const baseCost = { cpu: 100, memory: 50, storage: 20, network: 30 }[resource] || 50;
    
    let cost = 0;
    let benefit = '';

    switch (action) {
      case 'scale_up':
        cost = baseCost * 1.5;
        benefit = 'Improved performance and reliability';
        break;
      case 'scale_down':
        cost = -baseCost * 0.3; // Cost savings
        benefit = 'Reduced operational costs';
        break;
      case 'optimize':
        cost = baseCost * 0.1;
        benefit = 'Better resource utilization without scaling';
        break;
    }

    return { cost, benefit };
  }

  private assessScalingRisks(
    resource: string,
    action: string,
    predictions: CapacityPrediction[]
  ): { level: 'low' | 'medium' | 'high'; factors: string[] } {
    const factors: string[] = [];
    let level: 'low' | 'medium' | 'high' = 'low';

    const confidence = Math.min(...predictions.map(p => p.confidence));
    
    if (confidence < 0.7) {
      factors.push('Low prediction confidence');
      level = 'medium';
    }

    if (action === 'scale_down') {
      factors.push('Risk of performance degradation');
      level = level === 'medium' ? 'high' : 'medium';
    }

    if (action === 'scale_up') {
      factors.push('Increased operational costs');
    }

    return { level, factors };
  }

  private generateImplementationSteps(resource: string, action: string): string[] {
    const baseSteps = [
      'Create backup of current configuration',
      'Plan maintenance window',
      'Notify stakeholders'
    ];

    switch (action) {
      case 'scale_up':
        return [
          ...baseSteps,
          `Add additional ${resource} capacity`,
          'Update load balancer configuration',
          'Test new capacity',
          'Monitor performance'
        ];
      case 'scale_down':
        return [
          ...baseSteps,
          'Drain traffic from excess capacity',
          `Remove unnecessary ${resource} resources`,
          'Update monitoring thresholds',
          'Verify performance maintained'
        ];
      case 'optimize':
        return [
          ...baseSteps,
          `Analyze ${resource} usage patterns`,
          'Implement optimization recommendations',
          'Monitor performance improvements',
          'Document optimizations'
        ];
      default:
        return baseSteps;
    }
  }

  private estimateImplementationTime(resource: string, action: string): string {
    const timeMap = {
      scale_up: '2-4 hours',
      scale_down: '1-2 hours',
      optimize: '4-8 hours',
      maintain: '0 hours'
    };
    return timeMap[action] || '2-4 hours';
  }

  private generateRollbackPlan(resource: string, action: string): string[] {
    return [
      'Monitor key performance indicators',
      'Identify performance degradation',
      'Restore previous configuration',
      'Verify system stability',
      'Document rollback reasons'
    ];
  }

  private generateMonitoringPoints(resource: string): string[] {
    return [
      `${resource} utilization`,
      `${resource} performance metrics`,
      'Application response times',
      'Error rates',
      'User experience metrics'
    ];
  }

  // Additional helper methods (simplified implementations)
  private async getUtilizationHistory(resource: string, days: number): Promise<any[]> { return []; }
  private calculateGrowthTrend(history: any[]): { rate: number; confidence: number } { return { rate: 0.1, confidence: 0.8 }; }
  private async analyzeSeasonality(resource: string, days: number): Promise<{ daily: number[]; weekly: number[]; monthly: number[] }> { 
    return { daily: new Array(24).fill(0), weekly: new Array(7).fill(0), monthly: new Array(12).fill(0) }; 
  }
  private getResourceThresholds(resource: string): { warning: number; critical: number; maximum: number } {
    return { warning: 70, critical: 85, maximum: 95 };
  }
  private async generateResourceForecasts(resource: string): Promise<any[]> { return []; }
  private async getCurrentCapacity(resource: string): Promise<number> { return 100; }
  private async getLatestUtilization(resource: string): Promise<{ current: number; peak: number; average: number }> {
    return { current: 65, peak: 80, average: 60 };
  }
  private async generateCapacityAlerts(): Promise<void> {}
  private generateScenarios(projected: number, growthRate: number): { optimistic: number; realistic: number; pessimistic: number } {
    return {
      optimistic: projected * 0.8,
      realistic: projected,
      pessimistic: projected * 1.3
    };
  }
  private generateGrowthRecommendations(resource: string, current: number, scenarios: any, growthRate: number): string[] {
    return ['Monitor growth trends', 'Plan for capacity expansion', 'Optimize resource usage'];
  }
  private assessPerformance(resource: string, metrics: any): string {
    const utilization = metrics.utilization || 0;
    if (utilization > 85) return 'poor';
    if (utilization > 70) return 'fair';
    return 'good';
  }
  private async getResourceTrends(): Promise<{ cpu: number[]; memory: number[]; storage: number[]; network: number[] }> {
    return {
      cpu: [60, 62, 65, 63, 68, 70, 65],
      memory: [55, 58, 60, 62, 59, 61, 63],
      storage: [50, 52, 55, 58, 60, 62, 60],
      network: [35, 38, 40, 42, 39, 41, 40]
    };
  }
}

export const capacityPlanner = new CapacityPlanner();