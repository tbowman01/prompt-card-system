import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import { AnalyticsEngine } from './AnalyticsEngine';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { EventStore } from './EventStore';

export interface AnomalyModel {
  id: string;
  name: string;
  algorithm: 'isolation_forest' | 'autoencoder' | 'statistical' | 'ensemble';
  model?: tf.LayersModel;
  parameters: Record<string, any>;
  trainedAt: Date;
  accuracy: number;
  features: string[];
  isActive: boolean;
}

export interface AnomalyAlert {
  id: string;
  timestamp: Date;
  metric: string;
  value: number;
  expectedRange: { min: number; max: number };
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  context: {
    relatedMetrics: Record<string, number>;
    historicalComparison: {
      lastHour: number;
      lastDay: number;
      lastWeek: number;
    };
    patterns: string[];
  };
  recommendations: string[];
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface DetectionConfig {
  sensitivity: 'low' | 'medium' | 'high';
  windowSize: number; // minutes
  minSamples: number;
  alertThreshold: number;
  cooldownPeriod: number; // minutes
  enabledAlgorithms: string[];
  metricWeights: Record<string, number>;
}

export interface StatisticalThresholds {
  metric: string;
  mean: number;
  stdDev: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
  sampleSize: number;
  lastUpdated: Date;
}

export class AnomalyDetector extends EventEmitter {
  private models: Map<string, AnomalyModel>;
  private alerts: Map<string, AnomalyAlert>;
  private cache: LRUCache<string, any>;
  private config: DetectionConfig;
  private statisticalThresholds: Map<string, StatisticalThresholds>;
  private isRunning: boolean = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private analyticsEngine: AnalyticsEngine;
  private performanceMonitor: PerformanceMonitor;
  private eventStore: EventStore;
  private alertHistory: AnomalyAlert[] = [];

  constructor(config?: Partial<DetectionConfig>) {
    super();
    
    this.models = new Map();
    this.alerts = new Map();
    this.statisticalThresholds = new Map();
    this.alertHistory = [];
    
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5 // 5 minutes
    });

    this.config = {
      sensitivity: 'medium',
      windowSize: 10,
      minSamples: 30,
      alertThreshold: 0.7,
      cooldownPeriod: 15,
      enabledAlgorithms: ['autoencoder', 'statistical'],
      metricWeights: {
        'cpu_usage': 1.0,
        'memory_usage': 1.0,
        'app_response_time': 1.2,
        'app_error_rate': 1.5,
        'app_queue_size': 0.8
      },
      ...config
    };

    this.analyticsEngine = AnalyticsEngine.getInstance();
    this.performanceMonitor = new PerformanceMonitor();
    this.eventStore = EventStore.getInstance();

    // Initialize default models
    this.initializeModels();
  }

  /**
   * Start real-time anomaly detection
   */
  public startDetection(intervalMs: number = 30000): void {
    if (this.isRunning) {
      console.log('Anomaly detection already running');
      return;
    }

    this.isRunning = true;
    
    console.log(`Starting anomaly detection with ${intervalMs}ms interval`);
    
    this.detectionInterval = setInterval(async () => {
      try {
        await this.performDetection();
      } catch (error) {
        console.error('Error during anomaly detection:', error);
        this.emit('error', error);
      }
    }, intervalMs);

    // Start performance monitoring if not already running
    this.performanceMonitor.startMonitoring(5000);

    this.emit('detection_started');
  }

  /**
   * Stop anomaly detection
   */
  public stopDetection(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    console.log('Anomaly detection stopped');
    this.emit('detection_stopped');
  }

  /**
   * Train autoencoder model for anomaly detection
   */
  public async trainAutoencoderModel(
    metrics: string[],
    trainingDays: number = 7
  ): Promise<AnomalyModel> {
    console.log(`Training autoencoder model for metrics: ${metrics.join(', ')}`);

    // Collect training data
    const trainingData = await this.collectTrainingData(metrics, trainingDays);
    
    if (trainingData.length < this.config.minSamples) {
      throw new Error(`Insufficient training data: ${trainingData.length} samples`);
    }

    // Normalize data
    const { normalizedData, normalizationParams } = this.normalizeData(trainingData);

    // Create autoencoder model
    const inputDim = metrics.length;
    const model = this.createAutoencoderModel(inputDim);

    // Prepare training tensors
    const xTrain = tf.tensor2d(normalizedData);
    const splitIndex = Math.floor(normalizedData.length * 0.8);
    const xTrainSplit = xTrain.slice([0, 0], [splitIndex, -1]);
    const xVal = xTrain.slice([splitIndex, 0], [-1, -1]);

    // Train model
    const history = await model.fit(xTrainSplit, xTrainSplit, {
      epochs: 50,
      batchSize: 32,
      validationData: [xVal, xVal],
      shuffle: true,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}`);
          }
        }
      }
    });

    // Calculate reconstruction threshold
    const predictions = model.predict(xVal) as tf.Tensor;
    const reconstructionErrors = await this.calculateReconstructionErrors(xVal, predictions);
    const threshold = this.calculateThreshold(reconstructionErrors);

    // Evaluate model
    const finalLoss = history.history.loss[history.history.loss.length - 1] as number;
    const accuracy = Math.max(0, 1 - finalLoss);

    // Create model object
    const anomalyModel: AnomalyModel = {
      id: `autoencoder_${metrics.join('_')}_${Date.now()}`,
      name: `Autoencoder Anomaly Detection - ${metrics.join(', ')}`,
      algorithm: 'autoencoder',
      model,
      parameters: {
        threshold,
        normalizationParams,
        reconstructionErrorStats: {
          mean: reconstructionErrors.reduce((sum, e) => sum + e, 0) / reconstructionErrors.length,
          std: this.calculateStandardDeviation(reconstructionErrors)
        }
      },
      trainedAt: new Date(),
      accuracy,
      features: metrics,
      isActive: true
    };

    // Store model
    this.models.set(anomalyModel.id, anomalyModel);

    // Clean up tensors
    xTrain.dispose();
    xTrainSplit.dispose();
    xVal.dispose();
    predictions.dispose();

    console.log(`Autoencoder model trained with accuracy: ${accuracy.toFixed(4)}, threshold: ${threshold.toFixed(4)}`);
    
    return anomalyModel;
  }

  /**
   * Update statistical thresholds for a metric
   */
  public async updateStatisticalThresholds(
    metric: string,
    windowDays: number = 7
  ): Promise<StatisticalThresholds> {
    console.log(`Updating statistical thresholds for ${metric}`);

    // Get historical data
    const historicalData = await this.getHistoricalData(metric, windowDays);
    
    if (historicalData.length < this.config.minSamples) {
      throw new Error(`Insufficient data for ${metric}: ${historicalData.length} samples`);
    }

    // Calculate statistics
    const values = historicalData.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Set confidence based on sensitivity
    const confidenceMap = { low: 2.0, medium: 2.5, high: 3.0 };
    const confidence = confidenceMap[this.config.sensitivity];

    const thresholds: StatisticalThresholds = {
      metric,
      mean,
      stdDev,
      upperBound: mean + (confidence * stdDev),
      lowerBound: mean - (confidence * stdDev),
      confidence,
      sampleSize: values.length,
      lastUpdated: new Date()
    };

    this.statisticalThresholds.set(metric, thresholds);

    console.log(`Statistical thresholds updated for ${metric}: [${thresholds.lowerBound.toFixed(2)}, ${thresholds.upperBound.toFixed(2)}]`);
    
    return thresholds;
  }

  /**
   * Detect anomalies in current data
   */
  public async detectAnomalies(metrics?: string[]): Promise<AnomalyAlert[]> {
    const targetMetrics = metrics || Object.keys(this.config.metricWeights);
    const alerts: AnomalyAlert[] = [];

    // Get current metric values
    const currentData = await this.getCurrentMetricValues(targetMetrics);
    
    if (Object.keys(currentData).length === 0) {
      return alerts;
    }

    // Run enabled detection algorithms
    for (const algorithm of this.config.enabledAlgorithms) {
      try {
        const algorithmAlerts = await this.runDetectionAlgorithm(
          algorithm,
          currentData,
          targetMetrics
        );
        alerts.push(...algorithmAlerts);
      } catch (error) {
        console.error(`Error running ${algorithm} detection:`, error);
      }
    }

    // Deduplicate and prioritize alerts
    const uniqueAlerts = this.deduplicateAlerts(alerts);

    // Store new alerts
    for (const alert of uniqueAlerts) {
      this.alerts.set(alert.id, alert);
      this.alertHistory.push(alert);
      
      // Emit alert event
      this.emit('anomaly_detected', alert);
      
      // Auto-acknowledge low severity alerts
      if (alert.severity === 'low') {
        setTimeout(() => this.acknowledgeAlert(alert.id), 5 * 60 * 1000); // 5 minutes
      }
    }

    return uniqueAlerts;
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string, userId?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    this.emit('alert_acknowledged', { alert, userId });
    
    return true;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string, userId?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.emit('alert_resolved', { alert, userId });
    
    return true;
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): AnomalyAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        // Sort by severity then timestamp
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  /**
   * Get detection statistics
   */
  public getDetectionStats(): {
    totalAlerts: number;
    activeAlerts: number;
    alertsByseverity: Record<string, number>;
    detectionAccuracy: number;
    falsePositiveRate: number;
    modelCount: number;
    lastDetection: Date | null;
  } {
    const alerts = Array.from(this.alerts.values());
    const activeAlerts = alerts.filter(a => !a.resolved);
    
    const alertsByseverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate accuracy (simplified - would need labeled data for real accuracy)
    const acknowledgedAlerts = alerts.filter(a => a.acknowledged);
    const accuracy = alerts.length > 0 ? acknowledgedAlerts.length / alerts.length : 0;

    // Estimate false positive rate
    const resolvedQuickly = alerts.filter(a => 
      a.resolved && a.resolvedAt && 
      (a.resolvedAt.getTime() - a.timestamp.getTime()) < 300000 // 5 minutes
    );
    const falsePositiveRate = alerts.length > 0 ? resolvedQuickly.length / alerts.length : 0;

    const lastDetection = alerts.length > 0 
      ? new Date(Math.max(...alerts.map(a => a.timestamp.getTime())))
      : null;

    return {
      totalAlerts: alerts.length,
      activeAlerts: activeAlerts.length,
      alertsByseverity,
      detectionAccuracy: accuracy,
      falsePositiveRate,
      modelCount: this.models.size,
      lastDetection
    };
  }

  /**
   * Update detection configuration
   */
  public updateConfig(newConfig: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Anomaly detection configuration updated');
    this.emit('config_updated', this.config);
  }

  /**
   * Export detection data
   */
  public exportData(): {
    config: DetectionConfig;
    models: any[];
    alerts: AnomalyAlert[];
    thresholds: StatisticalThresholds[];
    stats: any;
  } {
    return {
      config: this.config,
      models: Array.from(this.models.values()).map(m => ({
        ...m,
        model: undefined // Don't export TensorFlow models
      })),
      alerts: this.alertHistory,
      thresholds: Array.from(this.statisticalThresholds.values()),
      stats: this.getDetectionStats()
    };
  }

  // Private methods

  private async initializeModels(): Promise<void> {
    try {
      // Initialize statistical thresholds for key metrics
      const keyMetrics = Object.keys(this.config.metricWeights);
      
      for (const metric of keyMetrics) {
        try {
          await this.updateStatisticalThresholds(metric);
        } catch (error) {
          console.warn(`Failed to initialize thresholds for ${metric}:`, error.message);
        }
      }

      // Train initial autoencoder model if enabled
      if (this.config.enabledAlgorithms.includes('autoencoder')) {
        try {
          await this.trainAutoencoderModel(keyMetrics);
        } catch (error) {
          console.warn('Failed to train initial autoencoder model:', error.message);
        }
      }

    } catch (error) {
      console.error('Error initializing anomaly detection models:', error);
    }
  }

  private createAutoencoderModel(inputDim: number): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // Encoder
        tf.layers.dense({
          inputShape: [inputDim],
          units: Math.max(8, Math.floor(inputDim * 0.8)),
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({
          units: Math.max(4, Math.floor(inputDim * 0.5)),
          activation: 'relu'
        }),
        tf.layers.dense({
          units: Math.max(2, Math.floor(inputDim * 0.3)),
          activation: 'relu'
        }),
        // Decoder
        tf.layers.dense({
          units: Math.max(4, Math.floor(inputDim * 0.5)),
          activation: 'relu'
        }),
        tf.layers.dense({
          units: Math.max(8, Math.floor(inputDim * 0.8)),
          activation: 'relu'
        }),
        tf.layers.dense({
          units: inputDim,
          activation: 'linear'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return model;
  }

  private async performDetection(): Promise<void> {
    const alerts = await this.detectAnomalies();
    
    // Update cache with detection results
    this.cache.set('last_detection', {
      timestamp: new Date(),
      alertCount: alerts.length,
      alerts: alerts.map(a => ({ id: a.id, severity: a.severity, metric: a.metric }))
    });

    // Clean up old alerts (keep only last 1000)
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    // Clean up resolved alerts from active alerts map
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && 
          (Date.now() - alert.timestamp.getTime()) > 24 * 60 * 60 * 1000) { // 24 hours
        this.alerts.delete(id);
      }
    }
  }

  private async runDetectionAlgorithm(
    algorithm: string,
    currentData: Record<string, number>,
    metrics: string[]
  ): Promise<AnomalyAlert[]> {
    switch (algorithm) {
      case 'statistical':
        return this.runStatisticalDetection(currentData, metrics);
      case 'autoencoder':
        return this.runAutoencoderDetection(currentData, metrics);
      case 'ensemble':
        return this.runEnsembleDetection(currentData, metrics);
      default:
        console.warn(`Unknown detection algorithm: ${algorithm}`);
        return [];
    }
  }

  private async runStatisticalDetection(
    currentData: Record<string, number>,
    metrics: string[]
  ): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    for (const metric of metrics) {
      const value = currentData[metric];
      if (value === undefined) continue;

      const thresholds = this.statisticalThresholds.get(metric);
      if (!thresholds) continue;

      // Check if value is outside thresholds
      if (value > thresholds.upperBound || value < thresholds.lowerBound) {
        const deviation = Math.max(
          Math.abs(value - thresholds.upperBound),
          Math.abs(value - thresholds.lowerBound)
        );
        
        const severity = this.calculateSeverity(deviation, thresholds.stdDev);
        const confidence = Math.min(deviation / thresholds.stdDev, 1.0);

        // Check cooldown period
        if (this.isInCooldown(metric)) continue;

        const alert: AnomalyAlert = {
          id: `stat_${metric}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          timestamp: new Date(),
          metric,
          value,
          expectedRange: {
            min: thresholds.lowerBound,
            max: thresholds.upperBound
          },
          severity,
          confidence,
          description: `${metric} value ${value.toFixed(2)} is outside expected range [${thresholds.lowerBound.toFixed(2)}, ${thresholds.upperBound.toFixed(2)}]`,
          context: {
            relatedMetrics: { ...currentData },
            historicalComparison: await this.getHistoricalComparison(metric),
            patterns: ['statistical_outlier']
          },
          recommendations: this.generateRecommendations(metric, value, 'statistical'),
          acknowledged: false,
          resolved: false
        };

        alerts.push(alert);
      }
    }

    return alerts;
  }

  private async runAutoencoderDetection(
    currentData: Record<string, number>,
    metrics: string[]
  ): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    // Find suitable autoencoder model
    const model = this.findAutoencoderModel(metrics);
    if (!model || !model.model) return alerts;

    try {
      // Prepare input data
      const inputVector = model.features.map(feature => currentData[feature] || 0);
      const { normalizedVector } = this.normalizeVector(inputVector, model.parameters.normalizationParams);

      // Get reconstruction
      const inputTensor = tf.tensor2d([normalizedVector]);
      const reconstruction = model.model.predict(inputTensor) as tf.Tensor;
      const reconstructedVector = await reconstruction.data();

      // Calculate reconstruction error
      const reconstructionError = this.calculateReconstructionError(
        normalizedVector,
        Array.from(reconstructedVector)
      );

      // Check against threshold
      const threshold = model.parameters.threshold;
      
      if (reconstructionError > threshold) {
        // Determine which metrics contributed most to the anomaly
        const contributingMetrics = this.identifyContributingMetrics(
          normalizedVector,
          Array.from(reconstructedVector),
          model.features
        );

        for (const { metric, contribution } of contributingMetrics) {
          if (contribution > 0.3 && !this.isInCooldown(metric)) { // 30% contribution threshold
            const value = currentData[metric];
            const severity = this.calculateSeverity(reconstructionError, threshold);
            const confidence = Math.min(reconstructionError / threshold, 1.0);

            const alert: AnomalyAlert = {
              id: `ae_${metric}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              timestamp: new Date(),
              metric,
              value,
              expectedRange: { min: 0, max: 0 }, // Autoencoder doesn't provide explicit ranges
              severity,
              confidence,
              description: `Autoencoder detected anomaly in ${metric} (reconstruction error: ${reconstructionError.toFixed(4)})`,
              context: {
                relatedMetrics: { ...currentData },
                historicalComparison: await this.getHistoricalComparison(metric),
                patterns: ['autoencoder_anomaly', `contribution_${(contribution * 100).toFixed(1)}%`]
              },
              recommendations: this.generateRecommendations(metric, value, 'autoencoder'),
              acknowledged: false,
              resolved: false
            };

            alerts.push(alert);
          }
        }
      }

      // Cleanup tensors
      inputTensor.dispose();
      reconstruction.dispose();

    } catch (error) {
      console.error('Error in autoencoder detection:', error);
    }

    return alerts;
  }

  private async runEnsembleDetection(
    currentData: Record<string, number>,
    metrics: string[]
  ): Promise<AnomalyAlert[]> {
    // Run both statistical and autoencoder detection
    const [statAlerts, aeAlerts] = await Promise.all([
      this.runStatisticalDetection(currentData, metrics),
      this.runAutoencoderDetection(currentData, metrics)
    ]);

    // Combine and weigh results
    const combinedAlerts: AnomalyAlert[] = [];
    const metricAlerts = new Map<string, AnomalyAlert[]>();

    // Group alerts by metric
    [...statAlerts, ...aeAlerts].forEach(alert => {
      if (!metricAlerts.has(alert.metric)) {
        metricAlerts.set(alert.metric, []);
      }
      metricAlerts.get(alert.metric)!.push(alert);
    });

    // Create ensemble alerts
    for (const [metric, alerts] of metricAlerts.entries()) {
      if (alerts.length > 1) {
        // Multiple algorithms detected anomaly - high confidence
        const avgConfidence = alerts.reduce((sum, a) => sum + a.confidence, 0) / alerts.length;
        const maxSeverity = alerts.reduce((max, a) => {
          const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
          return severityOrder[a.severity] > severityOrder[max.severity] ? a : max;
        });

        const ensembleAlert: AnomalyAlert = {
          ...maxSeverity,
          id: `ensemble_${metric}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          confidence: Math.min(avgConfidence * 1.2, 1.0), // Boost confidence for ensemble
          description: `Multiple algorithms detected anomaly in ${metric}`,
          context: {
            ...maxSeverity.context,
            patterns: [...new Set(alerts.flatMap(a => a.context.patterns)), 'ensemble_detection']
          }
        };

        combinedAlerts.push(ensembleAlert);
      } else {
        // Single algorithm detection
        combinedAlerts.push(alerts[0]);
      }
    }

    return combinedAlerts;
  }

  // Additional helper methods...

  private async collectTrainingData(metrics: string[], days: number): Promise<number[][]> {
    // Implementation to collect training data for specified metrics and time period
    return [];
  }

  private normalizeData(data: number[][]): { normalizedData: number[][]; normalizationParams: any } {
    // Implementation for data normalization
    return { normalizedData: data, normalizationParams: {} };
  }

  private normalizeVector(vector: number[], params: any): { normalizedVector: number[] } {
    // Implementation for vector normalization
    return { normalizedVector: vector };
  }

  private async calculateReconstructionErrors(original: tf.Tensor, reconstructed: tf.Tensor): Promise<number[]> {
    // Implementation for calculating reconstruction errors
    return [];
  }

  private calculateThreshold(errors: number[]): number {
    // Use 95th percentile as threshold
    const sorted = errors.sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async getHistoricalData(metric: string, days: number): Promise<any[]> {
    // Implementation to get historical data for a metric
    return [];
  }

  private async getCurrentMetricValues(metrics: string[]): Promise<Record<string, number>> {
    // Implementation to get current metric values
    return {};
  }

  private calculateSeverity(deviation: number, reference: number): AnomalyAlert['severity'] {
    const ratio = deviation / reference;
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  private isInCooldown(metric: string): boolean {
    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => 
        alert.metric === metric && 
        !alert.resolved &&
        (Date.now() - alert.timestamp.getTime()) < (this.config.cooldownPeriod * 60 * 1000)
      );
    return recentAlerts.length > 0;
  }

  private async getHistoricalComparison(metric: string): Promise<{ lastHour: number; lastDay: number; lastWeek: number }> {
    // Implementation to get historical comparison data
    return { lastHour: 0, lastDay: 0, lastWeek: 0 };
  }

  private generateRecommendations(metric: string, value: number, algorithm: string): string[] {
    const recommendations: string[] = [];
    
    recommendations.push(`Investigate ${metric} anomaly detected by ${algorithm}`);
    recommendations.push('Check system logs for related events');
    recommendations.push('Monitor related metrics for cascading effects');
    
    if (metric.includes('cpu') || metric.includes('memory')) {
      recommendations.push('Consider scaling resources if pattern persists');
    }
    
    if (metric.includes('response_time')) {
      recommendations.push('Check for database query performance issues');
      recommendations.push('Review application bottlenecks');
    }
    
    return recommendations;
  }

  private deduplicateAlerts(alerts: AnomalyAlert[]): AnomalyAlert[] {
    // Remove duplicate alerts for the same metric within a short time window
    const seen = new Set<string>();
    const unique: AnomalyAlert[] = [];
    
    for (const alert of alerts.sort((a, b) => b.confidence - a.confidence)) {
      const key = `${alert.metric}_${Math.floor(alert.timestamp.getTime() / (5 * 60 * 1000))}`; // 5-minute windows
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(alert);
      }
    }
    
    return unique;
  }

  private findAutoencoderModel(metrics: string[]): AnomalyModel | null {
    const candidates = Array.from(this.models.values())
      .filter(model => 
        model.algorithm === 'autoencoder' && 
        model.isActive &&
        metrics.every(m => model.features.includes(m))
      )
      .sort((a, b) => b.accuracy - a.accuracy);

    return candidates[0] || null;
  }

  private calculateReconstructionError(original: number[], reconstructed: number[]): number {
    let sumSquaredDiff = 0;
    for (let i = 0; i < original.length; i++) {
      sumSquaredDiff += Math.pow(original[i] - reconstructed[i], 2);
    }
    return Math.sqrt(sumSquaredDiff / original.length);
  }

  private identifyContributingMetrics(
    original: number[],
    reconstructed: number[],
    features: string[]
  ): Array<{ metric: string; contribution: number }> {
    const contributions: Array<{ metric: string; contribution: number }> = [];
    
    let totalError = 0;
    const errors = original.map((val, idx) => {
      const error = Math.abs(val - reconstructed[idx]);
      totalError += error;
      return error;
    });

    features.forEach((feature, idx) => {
      const contribution = totalError > 0 ? errors[idx] / totalError : 0;
      contributions.push({ metric: feature, contribution });
    });

    return contributions.sort((a, b) => b.contribution - a.contribution);
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetector();