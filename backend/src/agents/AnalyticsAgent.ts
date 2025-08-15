import { BaseAgent, AgentConfig, Task, AgentMessage } from './core/BaseAgent';
import { MemoryService } from '../memory/MemoryService';
import { AnalyticsEngine } from '../services/analytics/AnalyticsEngine';
import { PredictiveAnalytics } from '../services/analytics/PredictiveAnalytics';
import { EventStore } from '../services/analytics/EventStore';

export interface AnalyticsMetrics {
  totalPromptCards: number;
  totalTestCases: number;
  averageTestSuccessRate: number;
  mostUsedPromptTemplates: Array<{ id: number; usage: number }>;
  performanceTrends: any[];
  costAnalysis: any;
}

export class AnalyticsAgent extends BaseAgent {
  private analyticsEngine?: AnalyticsEngine;
  private predictiveAnalytics?: PredictiveAnalytics;
  private eventStore?: EventStore;
  private metricsCache: Map<string, any> = new Map();

  constructor(memoryService?: MemoryService) {
    const config: AgentConfig = {
      id: 'analytics-agent',
      name: 'Analytics Agent',
      description: 'Specialized agent for analytics, reporting, and predictive insights',
      capabilities: [
        {
          name: 'generate_dashboard_metrics',
          description: 'Generate comprehensive dashboard metrics',
          inputSchema: {
            type: 'object',
            properties: {
              timeRange: { 
                type: 'object',
                properties: {
                  start: { type: 'string' },
                  end: { type: 'string' }
                }
              },
              filters: { type: 'object' },
              metrics: { 
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        },
        {
          name: 'analyze_performance_trends',
          description: 'Analyze performance trends over time',
          inputSchema: {
            type: 'object',
            properties: {
              metric: { type: 'string' },
              period: { 
                type: 'string',
                enum: ['hour', 'day', 'week', 'month']
              },
              aggregation: {
                type: 'string',
                enum: ['avg', 'sum', 'min', 'max', 'count']
              }
            },
            required: ['metric', 'period']
          }
        },
        {
          name: 'predict_resource_usage',
          description: 'Predict future resource usage and capacity needs',
          inputSchema: {
            type: 'object',
            properties: {
              resource: { type: 'string' },
              horizon: { type: 'number' },
              confidence: { type: 'number' }
            },
            required: ['resource', 'horizon']
          }
        },
        {
          name: 'generate_cost_report',
          description: 'Generate detailed cost analysis report',
          inputSchema: {
            type: 'object',
            properties: {
              includeProjections: { type: 'boolean' },
              breakdown: {
                type: 'string',
                enum: ['service', 'user', 'model', 'time']
              }
            }
          }
        },
        {
          name: 'detect_anomalies',
          description: 'Detect anomalies in system metrics',
          inputSchema: {
            type: 'object',
            properties: {
              metrics: { type: 'array', items: { type: 'string' } },
              sensitivity: { type: 'number', minimum: 0, maximum: 1 },
              lookbackPeriod: { type: 'string' }
            },
            required: ['metrics']
          }
        }
      ],
      maxConcurrentTasks: 5,
      priority: 'medium',
      specialization: ['analytics', 'reporting', 'prediction', 'anomaly_detection'],
      memoryEnabled: true
    };

    super(config, memoryService);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing Analytics Agent');
    
    try {
      // Initialize analytics services
      this.analyticsEngine = new AnalyticsEngine();
      this.predictiveAnalytics = new PredictiveAnalytics();
      this.eventStore = new EventStore();
      
      // Warm up cache with recent metrics
      await this.warmUpMetricsCache();
      
      this.logger.info('Analytics Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Analytics Agent:', error);
      throw error;
    }
  }

  protected async executeTask(task: Task): Promise<any> {
    this.logger.info(`Executing task: ${task.type}`);

    switch (task.type) {
      case 'generate_dashboard_metrics':
        return await this.generateDashboardMetrics(task.input);
      
      case 'analyze_performance_trends':
        return await this.analyzePerformanceTrends(task.input);
      
      case 'predict_resource_usage':
        return await this.predictResourceUsage(task.input);
      
      case 'generate_cost_report':
        return await this.generateCostReport(task.input);
      
      case 'detect_anomalies':
        return await this.detectAnomalies(task.input);
      
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    this.logger.info(`Handling message from ${message.from}: ${message.type}`);

    switch (message.type) {
      case 'task_request':
        await this.handleTaskRequest(message);
        break;
      
      case 'coordination':
        await this.handleCoordinationMessage(message);
        break;
      
      default:
        this.logger.warn(`Unhandled message type: ${message.type}`);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Analytics Agent');
    
    // Save cached metrics
    await this.saveMetricsCache();
    
    // Cleanup event store
    if (this.eventStore) {
      await this.eventStore.flush();
    }
  }

  /**
   * Generate dashboard metrics
   */
  private async generateDashboardMetrics(input: any): Promise<any> {
    this.logger.info('Generating dashboard metrics');

    const { timeRange, filters = {}, metrics = [] } = input;
    
    if (!this.analyticsEngine) {
      throw new Error('Analytics engine not initialized');
    }

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey('dashboard', input);
      const cached = this.metricsCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached)) {
        this.logger.info('Returning cached dashboard metrics');
        return cached.data;
      }

      // Generate fresh metrics
      const dashboardData = await this.analyticsEngine.generateDashboard({
        timeRange,
        filters,
        requestedMetrics: metrics.length > 0 ? metrics : undefined
      });

      // Add real-time metrics
      const realTimeMetrics = await this.collectRealTimeMetrics();
      
      const result = {
        ...dashboardData,
        realTime: realTimeMetrics,
        generated_at: new Date().toISOString(),
        cache_ttl: 300 // 5 minutes
      };

      // Cache the result
      this.metricsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: 300000
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to generate dashboard metrics:', error);
      throw new Error(`Dashboard generation failed: ${error.message}`);
    }
  }

  /**
   * Analyze performance trends
   */
  private async analyzePerformanceTrends(input: any): Promise<any> {
    this.logger.info('Analyzing performance trends');

    const { metric, period, aggregation = 'avg' } = input;

    if (!this.analyticsEngine || !this.predictiveAnalytics) {
      throw new Error('Analytics services not initialized');
    }

    try {
      // Get historical data
      const historicalData = await this.analyticsEngine.getMetricHistory(
        metric,
        period,
        aggregation
      );

      // Analyze trends
      const trendAnalysis = await this.predictiveAnalytics.analyzeTrend(
        historicalData,
        { period, aggregation }
      );

      // Detect patterns
      const patterns = this.detectPatterns(historicalData);

      return {
        metric,
        period,
        aggregation,
        data: historicalData,
        trend: trendAnalysis,
        patterns,
        insights: this.generateInsights(trendAnalysis, patterns),
        forecast: await this.generateForecast(metric, historicalData),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to analyze performance trends:', error);
      throw new Error(`Trend analysis failed: ${error.message}`);
    }
  }

  /**
   * Predict resource usage
   */
  private async predictResourceUsage(input: any): Promise<any> {
    this.logger.info('Predicting resource usage');

    const { resource, horizon, confidence = 0.95 } = input;

    if (!this.predictiveAnalytics) {
      throw new Error('Predictive analytics not initialized');
    }

    try {
      // Get historical resource data
      const historicalUsage = await this.getHistoricalResourceUsage(resource);
      
      // Generate prediction
      const prediction = await this.predictiveAnalytics.predictResourceUsage(
        historicalUsage,
        horizon,
        confidence
      );

      // Calculate capacity recommendations
      const recommendations = this.calculateCapacityRecommendations(
        prediction,
        resource
      );

      return {
        resource,
        current_usage: historicalUsage[historicalUsage.length - 1],
        prediction: {
          horizon,
          confidence,
          predicted_values: prediction.values,
          confidence_intervals: prediction.intervals,
          trend: prediction.trend
        },
        recommendations,
        alerts: this.generateResourceAlerts(prediction, resource),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to predict resource usage:', error);
      throw new Error(`Resource prediction failed: ${error.message}`);
    }
  }

  /**
   * Generate cost report
   */
  private async generateCostReport(input: any): Promise<any> {
    this.logger.info('Generating cost report');

    const { includeProjections = false, breakdown = 'service' } = input;

    try {
      // Get cost data from various sources
      const costData = await this.aggregateCostData();
      
      // Calculate breakdown
      const costBreakdown = this.calculateCostBreakdown(costData, breakdown);
      
      // Generate projections if requested
      let projections = null;
      if (includeProjections && this.predictiveAnalytics) {
        projections = await this.predictiveAnalytics.projectCosts(costData, 30);
      }

      // Calculate optimization opportunities
      const optimizations = this.identifyCostOptimizations(costData);

      return {
        summary: {
          total_cost: costData.total,
          period: costData.period,
          currency: 'USD',
          change_from_previous: costData.change
        },
        breakdown: costBreakdown,
        projections,
        optimizations,
        top_consumers: this.getTopCostConsumers(costData),
        recommendations: this.generateCostRecommendations(costData, optimizations),
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to generate cost report:', error);
      throw new Error(`Cost report generation failed: ${error.message}`);
    }
  }

  /**
   * Detect anomalies in system metrics
   */
  private async detectAnomalies(input: any): Promise<any> {
    this.logger.info('Detecting anomalies');

    const { metrics, sensitivity = 0.5, lookbackPeriod = '24h' } = input;

    if (!this.analyticsEngine) {
      throw new Error('Analytics engine not initialized');
    }

    try {
      const anomalies: any[] = [];

      for (const metric of metrics) {
        // Get metric data for lookback period
        const metricData = await this.analyticsEngine.getMetricData(
          metric,
          lookbackPeriod
        );

        // Detect anomalies using statistical methods
        const detected = this.detectStatisticalAnomalies(
          metricData,
          sensitivity
        );

        if (detected.length > 0) {
          anomalies.push({
            metric,
            anomalies: detected,
            severity: this.calculateAnomalySeverity(detected),
            suggested_action: this.suggestAnomalyAction(metric, detected)
          });
        }
      }

      return {
        total_anomalies: anomalies.reduce((sum, a) => sum + a.anomalies.length, 0),
        metrics_affected: anomalies.length,
        anomalies,
        summary: this.generateAnomalySummary(anomalies),
        alerts: this.generateAnomalyAlerts(anomalies),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to detect anomalies:', error);
      throw new Error(`Anomaly detection failed: ${error.message}`);
    }
  }

  /**
   * Warm up metrics cache with recent data
   */
  private async warmUpMetricsCache(): Promise<void> {
    this.logger.info('Warming up metrics cache');
    
    // Pre-load commonly used metrics
    const commonMetrics = [
      'test_success_rate',
      'prompt_usage',
      'api_response_time',
      'system_load'
    ];

    for (const metric of commonMetrics) {
      try {
        const data = await this.collectMetricData(metric);
        this.metricsCache.set(metric, {
          data,
          timestamp: Date.now(),
          ttl: 300000 // 5 minutes
        });
      } catch (error) {
        this.logger.warn(`Failed to warm up metric ${metric}:`, error);
      }
    }
  }

  /**
   * Collect real-time metrics
   */
  private async collectRealTimeMetrics(): Promise<any> {
    return {
      active_users: Math.floor(Math.random() * 100),
      current_load: Math.random() * 100,
      queue_length: Math.floor(Math.random() * 50),
      response_time_ms: Math.random() * 500,
      error_rate: Math.random() * 5
    };
  }

  /**
   * Collect metric data (mock implementation)
   */
  private async collectMetricData(metric: string): Promise<any> {
    // Mock implementation - would query actual data sources
    return {
      metric,
      values: Array.from({ length: 24 }, () => Math.random() * 100),
      timestamps: Array.from({ length: 24 }, (_, i) => 
        new Date(Date.now() - (24 - i) * 3600000).toISOString()
      )
    };
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(type: string, input: any): string {
    return `${type}:${JSON.stringify(input)}`;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(cached: any): boolean {
    return cached && (Date.now() - cached.timestamp) < cached.ttl;
  }

  /**
   * Detect patterns in data
   */
  private detectPatterns(data: any[]): any[] {
    // Simple pattern detection
    const patterns = [];
    
    // Check for increasing trend
    const trend = data.slice(-10).reduce((acc, val, idx, arr) => {
      if (idx === 0) return 0;
      return acc + (val > arr[idx - 1] ? 1 : -1);
    }, 0);
    
    if (Math.abs(trend) > 5) {
      patterns.push({
        type: trend > 0 ? 'increasing' : 'decreasing',
        confidence: Math.abs(trend) / 10
      });
    }
    
    return patterns;
  }

  /**
   * Generate insights from analysis
   */
  private generateInsights(trend: any, patterns: any[]): string[] {
    const insights = [];
    
    if (trend.direction === 'increasing' && trend.rate > 0.1) {
      insights.push('Significant upward trend detected - consider scaling resources');
    }
    
    if (patterns.some(p => p.type === 'decreasing')) {
      insights.push('Declining pattern observed - investigate potential issues');
    }
    
    return insights;
  }

  /**
   * Generate forecast for metric
   */
  private async generateForecast(metric: string, historicalData: any[]): Promise<any> {
    // Simple linear forecast
    const lastValue = historicalData[historicalData.length - 1];
    const trend = (historicalData[historicalData.length - 1] - historicalData[0]) / historicalData.length;
    
    return {
      next_hour: lastValue + trend,
      next_day: lastValue + trend * 24,
      confidence: 0.7
    };
  }

  /**
   * Get historical resource usage
   */
  private async getHistoricalResourceUsage(resource: string): Promise<number[]> {
    // Mock implementation
    return Array.from({ length: 100 }, () => Math.random() * 100);
  }

  /**
   * Calculate capacity recommendations
   */
  private calculateCapacityRecommendations(prediction: any, resource: string): any[] {
    const recommendations = [];
    
    if (prediction.trend === 'increasing') {
      recommendations.push({
        action: 'scale_up',
        resource,
        target: Math.ceil(prediction.values[prediction.values.length - 1] * 1.2),
        urgency: 'medium'
      });
    }
    
    return recommendations;
  }

  /**
   * Generate resource alerts
   */
  private generateResourceAlerts(prediction: any, resource: string): any[] {
    const alerts = [];
    
    const maxPredicted = Math.max(...prediction.values);
    if (maxPredicted > 80) {
      alerts.push({
        level: 'warning',
        resource,
        message: `${resource} usage predicted to exceed 80%`,
        predicted_time: new Date(Date.now() + 3600000).toISOString()
      });
    }
    
    return alerts;
  }

  /**
   * Aggregate cost data
   */
  private async aggregateCostData(): Promise<any> {
    // Mock implementation
    return {
      total: 1234.56,
      period: 'month',
      change: 0.12,
      services: {
        compute: 456.78,
        storage: 234.56,
        api_calls: 543.22
      }
    };
  }

  /**
   * Calculate cost breakdown
   */
  private calculateCostBreakdown(costData: any, breakdown: string): any {
    // Mock implementation based on breakdown type
    if (breakdown === 'service') {
      return costData.services;
    }
    
    return {
      category1: costData.total * 0.4,
      category2: costData.total * 0.35,
      category3: costData.total * 0.25
    };
  }

  /**
   * Identify cost optimizations
   */
  private identifyCostOptimizations(costData: any): any[] {
    return [
      {
        type: 'unused_resources',
        potential_savings: 123.45,
        description: 'Remove unused test environments'
      },
      {
        type: 'right_sizing',
        potential_savings: 67.89,
        description: 'Optimize instance sizes based on usage'
      }
    ];
  }

  /**
   * Get top cost consumers
   */
  private getTopCostConsumers(costData: any): any[] {
    return [
      { name: 'Production API', cost: 456.78, percentage: 37 },
      { name: 'Test Environment', cost: 234.56, percentage: 19 },
      { name: 'Development', cost: 123.45, percentage: 10 }
    ];
  }

  /**
   * Generate cost recommendations
   */
  private generateCostRecommendations(costData: any, optimizations: any[]): string[] {
    const recommendations = [];
    
    if (optimizations.length > 0) {
      const totalSavings = optimizations.reduce((sum, opt) => sum + opt.potential_savings, 0);
      recommendations.push(`Implement identified optimizations to save $${totalSavings.toFixed(2)}/month`);
    }
    
    if (costData.change > 0.1) {
      recommendations.push('Costs increased by more than 10% - review recent changes');
    }
    
    return recommendations;
  }

  /**
   * Detect statistical anomalies
   */
  private detectStatisticalAnomalies(data: any, sensitivity: number): any[] {
    const anomalies = [];
    const threshold = 2 * (1 - sensitivity);
    
    // Simple z-score based anomaly detection
    const mean = data.values.reduce((a: number, b: number) => a + b, 0) / data.values.length;
    const stdDev = Math.sqrt(
      data.values.reduce((sq: number, n: number) => sq + Math.pow(n - mean, 2), 0) / data.values.length
    );
    
    data.values.forEach((value: number, index: number) => {
      const zScore = Math.abs((value - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          timestamp: data.timestamps[index],
          value,
          z_score: zScore,
          deviation: value - mean
        });
      }
    });
    
    return anomalies;
  }

  /**
   * Calculate anomaly severity
   */
  private calculateAnomalySeverity(anomalies: any[]): string {
    const maxZScore = Math.max(...anomalies.map((a: any) => a.z_score));
    
    if (maxZScore > 4) return 'critical';
    if (maxZScore > 3) return 'high';
    if (maxZScore > 2) return 'medium';
    return 'low';
  }

  /**
   * Suggest action for anomaly
   */
  private suggestAnomalyAction(metric: string, anomalies: any[]): string {
    if (metric.includes('error')) {
      return 'Investigate error spike immediately';
    }
    if (metric.includes('latency')) {
      return 'Check system performance and scaling';
    }
    return 'Monitor metric closely for further anomalies';
  }

  /**
   * Generate anomaly summary
   */
  private generateAnomalySummary(anomalies: any[]): string {
    if (anomalies.length === 0) {
      return 'No anomalies detected';
    }
    
    const critical = anomalies.filter(a => a.severity === 'critical').length;
    if (critical > 0) {
      return `${critical} critical anomalies detected requiring immediate attention`;
    }
    
    return `${anomalies.length} anomalies detected across monitored metrics`;
  }

  /**
   * Generate anomaly alerts
   */
  private generateAnomalyAlerts(anomalies: any[]): any[] {
    return anomalies
      .filter(a => a.severity === 'critical' || a.severity === 'high')
      .map(a => ({
        metric: a.metric,
        severity: a.severity,
        message: `Anomaly detected in ${a.metric}`,
        action: a.suggested_action
      }));
  }

  /**
   * Save metrics cache
   */
  private async saveMetricsCache(): Promise<void> {
    // Save important cached metrics for next startup
    this.logger.info('Saving metrics cache');
  }

  /**
   * Handle task requests from other agents
   */
  private async handleTaskRequest(message: AgentMessage): Promise<void> {
    try {
      const taskId = await this.submitTask({
        type: message.payload.type,
        description: message.payload.description,
        input: message.payload.input,
        context: message.payload.context,
        priority: message.payload.priority || 'medium',
        correlationId: message.correlationId,
        requesterAgent: message.from
      });

      this.sendMessage({
        to: message.from,
        type: 'task_response',
        payload: {
          status: 'accepted',
          taskId,
          message: 'Analytics task queued for processing'
        },
        correlationId: message.correlationId,
        priority: message.priority
      });

    } catch (error) {
      this.sendMessage({
        to: message.from,
        type: 'error',
        payload: {
          error: error.message,
          original_request: message.payload
        },
        correlationId: message.correlationId,
        priority: message.priority
      });
    }
  }

  /**
   * Handle coordination messages
   */
  private async handleCoordinationMessage(message: AgentMessage): Promise<void> {
    this.logger.info('Handling coordination message:', message.payload);

    switch (message.payload.action) {
      case 'status_request':
        this.sendMessage({
          to: message.from,
          type: 'status',
          payload: {
            ...this.getStats(),
            cache_size: this.metricsCache.size,
            cache_hits: 0 // Would track in production
          },
          correlationId: message.correlationId,
          priority: message.priority
        });
        break;

      case 'clear_cache':
        this.metricsCache.clear();
        this.sendMessage({
          to: message.from,
          type: 'coordination',
          payload: {
            action: 'cache_cleared',
            message: 'Metrics cache cleared successfully'
          },
          correlationId: message.correlationId,
          priority: message.priority
        });
        break;

      default:
        this.logger.warn('Unknown coordination action:', message.payload.action);
    }
  }
}