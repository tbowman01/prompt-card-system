import { EventEmitter } from 'events';
import { PredictiveAnalytics } from './PredictiveAnalytics';
import { AnomalyDetector, anomalyDetector } from './AnomalyDetector';
import { CapacityPlanner, capacityPlanner } from './CapacityPlanner';
import { AnalyticsEngine } from './AnalyticsEngine';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';

export interface MLAnalyticsConfig {
  enablePredictiveAnalytics: boolean;
  enableAnomalyDetection: boolean;
  enableCapacityPlanning: boolean;
  autoTraining: {
    enabled: boolean;
    interval: number; // hours
    trainingData: {
      timeframeDays: number;
      minSamples: number;
    };
  };
  monitoring: {
    anomalyDetectionInterval: number; // milliseconds
    capacityPlanningInterval: number; // milliseconds
    performanceInterval: number; // milliseconds
  };
  alerting: {
    enableSlackIntegration: boolean;
    enableEmailAlerts: boolean;
    severityThresholds: {
      critical: number;
      high: number;
      medium: number;
    };
  };
  models: {
    retentionDays: number;
    maxModelsPerType: number;
    autoCleanup: boolean;
  };
}

export interface SystemHealthScore {
  overall: number; // 0-100
  components: {
    performance: number;
    capacity: number;
    anomalies: number;
    predictions: number;
  };
  trends: {
    improving: boolean;
    stable: boolean;
    degrading: boolean;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface MLAnalyticsSummary {
  timestamp: Date;
  systemHealth: SystemHealthScore;
  activePredictions: number;
  activeAnomalies: number;
  capacityAlerts: number;
  modelsTraining: number;
  uptime: number;
  performanceMetrics: {
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
    resourceUtilization: number;
  };
  insights: {
    topRisks: string[];
    optimizationOpportunities: string[];
    trendingMetrics: string[];
  };
}

export class MLAnalyticsCoordinator extends EventEmitter {
  private predictiveAnalytics: PredictiveAnalytics;
  private anomalyDetector: AnomalyDetector;
  private capacityPlanner: CapacityPlanner;
  private analyticsEngine: AnalyticsEngine;
  private performanceMonitor: PerformanceMonitor;
  
  private config: MLAnalyticsConfig;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private autoTrainingInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime: Date;
  
  constructor(config?: Partial<MLAnalyticsConfig>) {
    super();
    
    this.startTime = new Date();
    
    this.config = {
      enablePredictiveAnalytics: true,
      enableAnomalyDetection: true,
      enableCapacityPlanning: true,
      autoTraining: {
        enabled: true,
        interval: 24, // 24 hours
        trainingData: {
          timeframeDays: 30,
          minSamples: 100
        }
      },
      monitoring: {
        anomalyDetectionInterval: 30000, // 30 seconds
        capacityPlanningInterval: 300000, // 5 minutes
        performanceInterval: 5000 // 5 seconds
      },
      alerting: {
        enableSlackIntegration: false,
        enableEmailAlerts: false,
        severityThresholds: {
          critical: 0.9,
          high: 0.7,
          medium: 0.5
        }
      },
      models: {
        retentionDays: 30,
        maxModelsPerType: 5,
        autoCleanup: true
      },
      ...config
    };

    this.initializeServices();
  }

  /**
   * Initialize all ML analytics services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('ML Analytics Coordinator already initialized');
      return;
    }

    try {
      console.log('Initializing ML Analytics Coordinator...');

      // Initialize performance monitoring first
      this.performanceMonitor.startMonitoring(this.config.monitoring.performanceInterval);

      // Initialize anomaly detection if enabled
      if (this.config.enableAnomalyDetection) {
        await this.initializeAnomalyDetection();
      }

      // Initialize capacity planning if enabled
      if (this.config.enableCapacityPlanning) {
        await this.initializeCapacityPlanning();
      }

      // Initialize predictive analytics if enabled
      if (this.config.enablePredictiveAnalytics) {
        await this.initializePredictiveAnalytics();
      }

      // Start auto-training if enabled
      if (this.config.autoTraining.enabled) {
        this.startAutoTraining();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      this.isRunning = true;

      console.log('ML Analytics Coordinator initialized successfully');
      this.emit('initialized');

    } catch (error) {
      console.error('Failed to initialize ML Analytics Coordinator:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start all ML analytics services
   */
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      console.log('ML Analytics Coordinator already running');
      return;
    }

    try {
      console.log('Starting ML Analytics Coordinator services...');

      // Start anomaly detection
      if (this.config.enableAnomalyDetection) {
        this.anomalyDetector.startDetection(this.config.monitoring.anomalyDetectionInterval);
      }

      // Start capacity monitoring
      if (this.config.enableCapacityPlanning) {
        this.capacityPlanner.startMonitoring(this.config.monitoring.capacityPlanningInterval);
      }

      // Start performance monitoring
      this.performanceMonitor.startMonitoring(this.config.monitoring.performanceInterval);

      this.isRunning = true;
      
      console.log('ML Analytics Coordinator services started');
      this.emit('started');

    } catch (error) {
      console.error('Failed to start ML Analytics Coordinator:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop all ML analytics services
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('Stopping ML Analytics Coordinator services...');

      // Stop auto-training
      if (this.autoTrainingInterval) {
        clearInterval(this.autoTrainingInterval);
        this.autoTrainingInterval = null;
      }

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Stop anomaly detection
      this.anomalyDetector.stopDetection();

      // Stop capacity monitoring
      this.capacityPlanner.stopMonitoring();

      // Stop performance monitoring
      this.performanceMonitor.stopMonitoring();

      this.isRunning = false;
      
      console.log('ML Analytics Coordinator services stopped');
      this.emit('stopped');

    } catch (error) {
      console.error('Failed to stop ML Analytics Coordinator:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get comprehensive system health score
   */
  public async getSystemHealthScore(): Promise<SystemHealthScore> {
    try {
      // Get performance metrics
      const performanceStats = this.performanceMonitor.getPerformanceSummary();
      const performanceScore = this.calculatePerformanceScore(performanceStats);

      // Get capacity health
      const capacityAlerts = this.capacityPlanner.getCapacityAlerts();
      const capacityScore = this.calculateCapacityScore(capacityAlerts);

      // Get anomaly status
      const anomalyStats = this.anomalyDetector.getDetectionStats();
      const anomalyScore = this.calculateAnomalyScore(anomalyStats);

      // Get prediction confidence
      const predictionScore = await this.calculatePredictionScore();

      // Calculate overall score
      const overall = Math.round(
        (performanceScore * 0.3 + 
         capacityScore * 0.3 + 
         anomalyScore * 0.2 + 
         predictionScore * 0.2)
      );

      // Determine trends
      const trends = await this.analyzeTrends();

      // Determine risk level
      const riskLevel = this.determineRiskLevel(overall, anomalyStats, capacityAlerts);

      // Generate recommendations
      const recommendations = await this.generateHealthRecommendations(
        overall,
        performanceStats,
        capacityAlerts,
        anomalyStats
      );

      return {
        overall,
        components: {
          performance: performanceScore,
          capacity: capacityScore,
          anomalies: anomalyScore,
          predictions: predictionScore
        },
        trends,
        riskLevel,
        recommendations
      };

    } catch (error) {
      console.error('Error calculating system health score:', error);
      return {
        overall: 50,
        components: { performance: 50, capacity: 50, anomalies: 50, predictions: 50 },
        trends: { improving: false, stable: true, degrading: false },
        riskLevel: 'medium',
        recommendations: ['Unable to calculate system health - check ML analytics services']
      };
    }
  }

  /**
   * Get ML analytics summary
   */
  public async getAnalyticsSummary(): Promise<MLAnalyticsSummary> {
    const systemHealth = await this.getSystemHealthScore();
    const anomalyStats = this.anomalyDetector.getDetectionStats();
    const capacityAlerts = this.capacityPlanner.getCapacityAlerts();
    const performanceStats = this.performanceMonitor.getPerformanceSummary();

    // Get insights
    const insights = await this.generateInsights();

    return {
      timestamp: new Date(),
      systemHealth,
      activePredictions: 0, // Would track active predictions
      activeAnomalies: anomalyStats.activeAlerts,
      capacityAlerts: capacityAlerts.length,
      modelsTraining: 0, // Would track training status
      uptime: Date.now() - this.startTime.getTime(),
      performanceMetrics: {
        avgResponseTime: 0, // Would get from performance monitor
        errorRate: 0,
        throughput: 0,
        resourceUtilization: 0
      },
      insights
    };
  }

  /**
   * Update coordinator configuration
   */
  public updateConfig(newConfig: Partial<MLAnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('ML Analytics Coordinator configuration updated');
    this.emit('config_updated', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): MLAnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Get service status
   */
  public getStatus(): {
    isInitialized: boolean;
    isRunning: boolean;
    uptime: number;
    services: {
      predictiveAnalytics: boolean;
      anomalyDetection: boolean;
      capacityPlanning: boolean;
      performanceMonitoring: boolean;
    };
  } {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime.getTime(),
      services: {
        predictiveAnalytics: this.config.enablePredictiveAnalytics,
        anomalyDetection: this.config.enableAnomalyDetection && this.anomalyDetector['isRunning'],
        capacityPlanning: this.config.enableCapacityPlanning && this.capacityPlanner['isMonitoring'],
        performanceMonitoring: this.performanceMonitor['isMonitoring']
      }
    };
  }

  /**
   * Perform comprehensive system analysis
   */
  public async performSystemAnalysis(): Promise<{
    healthScore: SystemHealthScore;
    predictions: any[];
    anomalies: any[];
    capacityForecasts: any[];
    optimizationRecommendations: any[];
    actionPlan: string[];
  }> {
    console.log('Performing comprehensive system analysis...');

    try {
      const [
        healthScore,
        predictions,
        anomalies,
        capacityForecasts,
        optimizationRecommendations
      ] = await Promise.all([
        this.getSystemHealthScore(),
        this.getPredictions(),
        this.getAnomalies(),
        this.getCapacityForecasts(),
        this.getOptimizationRecommendations()
      ]);

      // Generate action plan
      const actionPlan = this.generateActionPlan(
        healthScore,
        anomalies,
        capacityForecasts,
        optimizationRecommendations
      );

      return {
        healthScore,
        predictions,
        anomalies,
        capacityForecasts,
        optimizationRecommendations,
        actionPlan
      };

    } catch (error) {
      console.error('Error performing system analysis:', error);
      throw error;
    }
  }

  // Private methods

  private initializeServices(): void {
    this.predictiveAnalytics = new PredictiveAnalytics();
    this.anomalyDetector = anomalyDetector;
    this.capacityPlanner = capacityPlanner;
    this.analyticsEngine = AnalyticsEngine.getInstance();
    this.performanceMonitor = new PerformanceMonitor();

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Anomaly detection events
    this.anomalyDetector.on('anomaly_detected', (anomaly) => {
      this.handleAnomalyDetected(anomaly);
    });

    this.anomalyDetector.on('alert_resolved', (alert) => {
      this.handleAlertResolved(alert);
    });

    // Performance monitoring events
    this.performanceMonitor.on('alert', (alert) => {
      this.handlePerformanceAlert(alert);
    });

    // Capacity planning events (would need to be implemented in CapacityPlanner)
    // this.capacityPlanner.on('capacity_alert', (alert) => {
    //   this.handleCapacityAlert(alert);
    // });
  }

  private async initializeAnomalyDetection(): Promise<void> {
    console.log('Initializing anomaly detection...');
    
    try {
      // Train initial models if needed
      const keyMetrics = ['cpu_usage', 'memory_usage', 'app_response_time', 'app_error_rate'];
      await this.anomalyDetector.trainAutoencoderModel(keyMetrics, 7);
      
      // Update statistical thresholds
      for (const metric of keyMetrics) {
        try {
          await this.anomalyDetector.updateStatisticalThresholds(metric, 7);
        } catch (error) {
          console.warn(`Failed to update thresholds for ${metric}:`, error.message);
        }
      }
      
      console.log('Anomaly detection initialized');
    } catch (error) {
      console.warn('Failed to fully initialize anomaly detection:', error.message);
    }
  }

  private async initializeCapacityPlanning(): Promise<void> {
    console.log('Initializing capacity planning...');
    
    try {
      // Capacity planner initializes itself
      console.log('Capacity planning initialized');
    } catch (error) {
      console.warn('Failed to initialize capacity planning:', error.message);
    }
  }

  private async initializePredictiveAnalytics(): Promise<void> {
    console.log('Initializing predictive analytics...');
    
    try {
      // Train initial models if needed
      const keyMetrics = ['cpu_usage', 'memory_usage', 'app_response_time'];
      
      for (const metric of keyMetrics) {
        try {
          await this.predictiveAnalytics.trainCapacityModel(metric, 30);
        } catch (error) {
          console.warn(`Failed to train capacity model for ${metric}:`, error.message);
        }
      }
      
      console.log('Predictive analytics initialized');
    } catch (error) {
      console.warn('Failed to fully initialize predictive analytics:', error.message);
    }
  }

  private startAutoTraining(): void {
    const intervalMs = this.config.autoTraining.interval * 60 * 60 * 1000; // Convert hours to ms
    
    this.autoTrainingInterval = setInterval(async () => {
      try {
        console.log('Starting auto-training cycle...');
        await this.predictiveAnalytics.autoRetrainModels();
        console.log('Auto-training cycle completed');
      } catch (error) {
        console.error('Error during auto-training:', error);
      }
    }, intervalMs);

    console.log(`Auto-training scheduled every ${this.config.autoTraining.interval} hours`);
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthScore = await this.getSystemHealthScore();
        
        // Emit health update
        this.emit('health_update', healthScore);
        
        // Check for critical issues
        if (healthScore.riskLevel === 'critical') {
          this.emit('critical_health_alert', healthScore);
        }
      } catch (error) {
        console.error('Error during health check:', error);
      }
    }, 60000); // Every minute
  }

  private calculatePerformanceScore(stats: any): number {
    if (stats.systemHealth === 'good') return 90;
    if (stats.systemHealth === 'warning') return 60;
    if (stats.systemHealth === 'critical') return 20;
    return 50;
  }

  private calculateCapacityScore(alerts: any[]): number {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
    
    if (criticalAlerts > 0) return 20;
    if (warningAlerts > 2) return 50;
    if (warningAlerts > 0) return 70;
    return 90;
  }

  private calculateAnomalyScore(stats: any): number {
    const { activeAlerts, detectionAccuracy, falsePositiveRate } = stats;
    
    let score = 90;
    
    // Penalize active alerts
    score -= Math.min(activeAlerts * 10, 50);
    
    // Adjust for accuracy
    score = score * detectionAccuracy;
    
    // Penalize false positives
    score -= falsePositiveRate * 20;
    
    return Math.max(Math.round(score), 0);
  }

  private async calculatePredictionScore(): Promise<number> {
    // Simplified prediction score - would calculate based on model confidence
    return 75;
  }

  private async analyzeTrends(): Promise<{ improving: boolean; stable: boolean; degrading: boolean }> {
    // Simplified trend analysis - would analyze historical health scores
    return { improving: false, stable: true, degrading: false };
  }

  private determineRiskLevel(
    overall: number,
    anomalyStats: any,
    capacityAlerts: any[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (overall < 30 || capacityAlerts.some(a => a.severity === 'critical')) {
      return 'critical';
    }
    if (overall < 50 || anomalyStats.activeAlerts > 3) {
      return 'high';
    }
    if (overall < 70 || anomalyStats.activeAlerts > 1) {
      return 'medium';
    }
    return 'low';
  }

  private async generateHealthRecommendations(
    overall: number,
    performanceStats: any,
    capacityAlerts: any[],
    anomalyStats: any
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (overall < 50) {
      recommendations.push('System health is poor - immediate action required');
    }
    
    if (capacityAlerts.length > 0) {
      recommendations.push('Address capacity alerts to prevent resource exhaustion');
    }
    
    if (anomalyStats.activeAlerts > 2) {
      recommendations.push('Investigate multiple active anomalies');
    }
    
    if (performanceStats.systemHealth === 'critical') {
      recommendations.push('Performance is critical - check system resources');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System health is good - continue monitoring');
    }
    
    return recommendations;
  }

  private async generateInsights(): Promise<{
    topRisks: string[];
    optimizationOpportunities: string[];
    trendingMetrics: string[];
  }> {
    return {
      topRisks: ['High memory utilization', 'Increasing response times'],
      optimizationOpportunities: ['CPU optimization possible', 'Cache hit rate improvements'],
      trendingMetrics: ['cpu_usage', 'memory_usage', 'response_time']
    };
  }

  private generateActionPlan(
    healthScore: any,
    anomalies: any[],
    capacityForecasts: any[],
    optimizations: any[]
  ): string[] {
    const actions: string[] = [];
    
    if (healthScore.riskLevel === 'critical') {
      actions.push('URGENT: Address critical system health issues');
    }
    
    if (anomalies.length > 0) {
      actions.push(`Investigate ${anomalies.length} active anomalies`);
    }
    
    if (optimizations.length > 0) {
      actions.push('Implement identified optimization opportunities');
    }
    
    actions.push('Continue monitoring system health trends');
    
    return actions;
  }

  private handleAnomalyDetected(anomaly: any): void {
    console.log(`Anomaly detected: ${anomaly.description}`);
    this.emit('anomaly', anomaly);
  }

  private handleAlertResolved(alert: any): void {
    console.log(`Alert resolved: ${alert.alert.id}`);
    this.emit('alert_resolved', alert);
  }

  private handlePerformanceAlert(alert: any): void {
    console.log(`Performance alert: ${alert.message}`);
    this.emit('performance_alert', alert);
  }

  // Simplified data getters (would be more comprehensive in real implementation)
  private async getPredictions(): Promise<any[]> { return []; }
  private async getAnomalies(): Promise<any[]> { 
    return this.anomalyDetector.getActiveAlerts(); 
  }
  private async getCapacityForecasts(): Promise<any[]> { 
    const forecasts = await this.capacityPlanner.generateCapacityForecast();
    return Array.from(forecasts.values()).flat();
  }
  private async getOptimizationRecommendations(): Promise<any[]> { 
    return Object.values(await this.capacityPlanner.generateOptimizationRecommendations()).flat();
  }
}

// Export singleton instance
export const mlAnalyticsCoordinator = new MLAnalyticsCoordinator();