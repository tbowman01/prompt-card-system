import { EventEmitter } from 'events';
import { db } from '../../database/connection';
import { LoadTestResults } from './LoadTestingFramework';
import { performanceMonitor } from './PerformanceMonitor';
import { alertingSystem } from '../health/AlertingSystem';
import { LRUCache } from 'lru-cache';
import * as tf from '@tensorflow/tfjs-node';

export interface RegressionBaseline {
  id: string;
  scenarioId: string;
  metrics: PerformanceMetrics;
  timestamp: Date;
  version?: string;
  environment?: string;
  sampleSize: number;
  confidence: number;
}

export interface PerformanceMetrics {
  responseTime: {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    std: number;
  };
  throughput: {
    mean: number;
    std: number;
  };
  errorRate: number;
  availability: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    io: number;
  };
}

export interface RegressionAlert {
  id: string;
  scenarioId: string;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  degradation: number; // Percentage
  baseline: number;
  current: number;
  threshold: number;
  confidence: number;
  timestamp: Date;
  additionalContext: {
    trend: 'improving' | 'stable' | 'degrading';
    changePoints: number[];
    seasonality?: string;
    correlatedMetrics: string[];
  };
  recommendations: string[];
}

export interface RegressionThreshold {
  metric: string;
  warning: number; // Percentage change
  critical: number; // Percentage change
  method: 'absolute' | 'statistical' | 'adaptive';
  confidence: number; // Statistical confidence level
  minSampleSize: number;
}

export interface ChangePointDetection {
  timestamp: number;
  confidence: number;
  changeType: 'level' | 'trend' | 'variance';
  magnitude: number;
  metrics: string[];
}

export interface TrendAnalysis {
  metric: string;
  period: string;
  trend: 'improving' | 'stable' | 'degrading';
  slope: number;
  correlation: number;
  seasonality: {
    detected: boolean;
    period?: number;
    amplitude?: number;
  };
  forecast: {
    nextValue: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  };
}

class StatisticalAnalyzer {
  /**
   * Calculate statistical significance using Student's t-test
   */
  static tTest(baseline: number[], current: number[], alpha: number = 0.05): {
    significant: boolean;
    pValue: number;
    tStatistic: number;
    degreesOfFreedom: number;
  } {
    const n1 = baseline.length;
    const n2 = current.length;
    
    if (n1 < 2 || n2 < 2) {
      return { significant: false, pValue: 1, tStatistic: 0, degreesOfFreedom: 0 };
    }

    const mean1 = baseline.reduce((sum, val) => sum + val, 0) / n1;
    const mean2 = current.reduce((sum, val) => sum + val, 0) / n2;
    
    const var1 = baseline.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (n1 - 1);
    const var2 = current.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (n2 - 1);
    
    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    const standardError = Math.sqrt(pooledVar * (1/n1 + 1/n2));
    
    const tStatistic = (mean2 - mean1) / standardError;
    const degreesOfFreedom = n1 + n2 - 2;
    
    // Simplified p-value calculation (in production, use proper statistical library)
    const pValue = this.calculatePValue(Math.abs(tStatistic), degreesOfFreedom);
    
    return {
      significant: pValue < alpha,
      pValue,
      tStatistic,
      degreesOfFreedom
    };
  }

  /**
   * Detect change points in time series using CUSUM
   */
  static detectChangePoints(values: number[], threshold: number = 5): ChangePointDetection[] {
    if (values.length < 10) return [];
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    let cusum = 0;
    const changePoints: ChangePointDetection[] = [];
    
    for (let i = 1; i < values.length; i++) {
      cusum = Math.max(0, cusum + (values[i] - mean) / std - 0.5);
      
      if (cusum > threshold) {
        const magnitude = Math.abs(values[i] - mean) / std;
        changePoints.push({
          timestamp: i,
          confidence: Math.min(cusum / threshold, 1),
          changeType: this.classifyChange(values, i),
          magnitude,
          metrics: ['responseTime'] // Simplified
        });
        cusum = 0; // Reset after detection
      }
    }
    
    return changePoints;
  }

  /**
   * Calculate Mann-Kendall trend test
   */
  static mannKendallTrend(values: number[]): {
    trend: 'improving' | 'stable' | 'degrading';
    slope: number;
    significance: number;
  } {
    const n = values.length;
    if (n < 4) {
      return { trend: 'stable', slope: 0, significance: 0 };
    }

    let s = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        s += Math.sign(values[j] - values[i]);
      }
    }

    const variance = n * (n - 1) * (2 * n + 5) / 18;
    const z = s / Math.sqrt(variance);
    
    // Calculate Theil-Sen slope estimator
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        slopes.push((values[j] - values[i]) / (j - i));
      }
    }
    slopes.sort((a, b) => a - b);
    const slope = slopes[Math.floor(slopes.length / 2)];

    const significance = Math.abs(z);
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    
    if (significance > 1.96) { // 95% confidence
      trend = slope > 0 ? 'degrading' : 'improving';
    }

    return { trend, slope, significance };
  }

  /**
   * Detect seasonality using FFT
   */
  static detectSeasonality(values: number[]): {
    detected: boolean;
    period?: number;
    amplitude?: number;
    confidence: number;
  } {
    if (values.length < 24) {
      return { detected: false, confidence: 0 };
    }

    // Simplified seasonality detection
    // In production, use proper FFT implementation
    const autocorrelations: number[] = [];
    const maxLag = Math.min(values.length / 3, 48);
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      for (let i = lag; i < values.length; i++) {
        correlation += values[i] * values[i - lag];
      }
      autocorrelations.push(correlation / (values.length - lag));
    }

    // Find peaks in autocorrelation
    const peaks: { lag: number; value: number }[] = [];
    for (let i = 1; i < autocorrelations.length - 1; i++) {
      if (autocorrelations[i] > autocorrelations[i - 1] && 
          autocorrelations[i] > autocorrelations[i + 1]) {
        peaks.push({ lag: i + 1, value: autocorrelations[i] });
      }
    }

    if (peaks.length === 0) {
      return { detected: false, confidence: 0 };
    }

    const strongestPeak = peaks.reduce((max, peak) => 
      peak.value > max.value ? peak : max);

    const threshold = Math.max(...autocorrelations) * 0.3;
    const detected = strongestPeak.value > threshold;

    return {
      detected,
      period: detected ? strongestPeak.lag : undefined,
      amplitude: detected ? strongestPeak.value : undefined,
      confidence: detected ? strongestPeak.value / Math.max(...autocorrelations) : 0
    };
  }

  private static calculatePValue(tStat: number, df: number): number {
    // Simplified p-value calculation
    // In production, use proper statistical library
    const t = Math.abs(tStat);
    if (df >= 30) {
      // Approximate with normal distribution for large df
      return 2 * (1 - this.normalCDF(t));
    }
    
    // Simplified approximation for small df
    const p = 1 / (1 + t * t / df);
    return 2 * Math.pow(p, df / 2);
  }

  private static normalCDF(x: number): number {
    // Approximation of normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private static erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private static classifyChange(values: number[], index: number): 'level' | 'trend' | 'variance' {
    const before = values.slice(Math.max(0, index - 5), index);
    const after = values.slice(index, Math.min(values.length, index + 5));
    
    if (before.length < 2 || after.length < 2) return 'level';
    
    const meanBefore = before.reduce((sum, val) => sum + val, 0) / before.length;
    const meanAfter = after.reduce((sum, val) => sum + val, 0) / after.length;
    const varBefore = before.reduce((sum, val) => sum + Math.pow(val - meanBefore, 2), 0) / before.length;
    const varAfter = after.reduce((sum, val) => sum + Math.pow(val - meanAfter, 2), 0) / after.length;
    
    const levelChange = Math.abs(meanAfter - meanBefore);
    const varianceChange = Math.abs(varAfter - varBefore);
    
    if (varianceChange > levelChange * 2) return 'variance';
    return 'level';
  }
}

export class PerformanceRegressionDetector extends EventEmitter {
  private baselines: Map<string, RegressionBaseline> = new Map();
  private thresholds: Map<string, RegressionThreshold> = new Map();
  private cache: LRUCache<string, any>;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private neuralModel: tf.LayersModel | null = null;
  private trainingData: Array<{ features: number[]; label: number }> = [];

  constructor() {
    super();
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 15 // 15 minutes
    });
    
    this.setupDefaultThresholds();
    this.initializeNeuralModel();
    this.loadBaselinesFromDatabase();
  }

  /**
   * Start automated regression monitoring
   */
  startMonitoring(intervalMinutes: number = 15): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.performRegressionCheck().catch(error => {
        console.error('Regression monitoring failed:', error);
        this.emit('monitoringError', error);
      });
    }, intervalMinutes * 60 * 1000);

    console.log(`Performance regression monitoring started (${intervalMinutes}min interval)`);
    this.emit('monitoringStarted', { intervalMinutes });
  }

  /**
   * Stop automated monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Performance regression monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Analyze load test results for regressions
   */
  async analyzeResults(scenarioId: string, results: LoadTestResults): Promise<RegressionAlert[]> {
    const baseline = this.baselines.get(scenarioId);
    if (!baseline) {
      console.log(`No baseline found for scenario: ${scenarioId}`);
      return [];
    }

    const alerts: RegressionAlert[] = [];
    const currentMetrics = this.extractMetrics(results);

    // Analyze each metric
    const metricsToAnalyze = [
      { key: 'responseTime.p95', current: currentMetrics.responseTime.p95, baseline: baseline.metrics.responseTime.p95 },
      { key: 'responseTime.mean', current: currentMetrics.responseTime.mean, baseline: baseline.metrics.responseTime.mean },
      { key: 'throughput.mean', current: currentMetrics.throughput.mean, baseline: baseline.metrics.throughput.mean },
      { key: 'errorRate', current: currentMetrics.errorRate, baseline: baseline.metrics.errorRate }
    ];

    for (const metric of metricsToAnalyze) {
      const threshold = this.thresholds.get(metric.key);
      if (!threshold) continue;

      const regression = await this.detectRegression(metric.key, metric.current, metric.baseline, threshold);
      if (regression) {
        alerts.push(regression);
      }
    }

    // Perform trend analysis
    const trendAnalysis = await this.analyzeTrends(scenarioId);
    if (trendAnalysis && trendAnalysis.trend === 'degrading') {
      alerts.push({
        id: `trend-${scenarioId}-${Date.now()}`,
        scenarioId,
        metric: 'trend',
        severity: 'medium',
        degradation: Math.abs(trendAnalysis.slope) * 100,
        baseline: 0,
        current: trendAnalysis.slope,
        threshold: 0.1,
        confidence: trendAnalysis.correlation,
        timestamp: new Date(),
        additionalContext: {
          trend: trendAnalysis.trend,
          changePoints: [],
          correlatedMetrics: []
        },
        recommendations: [
          'Performance trend is degrading over time',
          'Consider investigating recent changes or increased load',
          'Monitor system resources for potential bottlenecks'
        ]
      });
    }

    // Use neural model for anomaly detection
    if (this.neuralModel) {
      const anomalyScore = await this.detectAnomalies(currentMetrics);
      if (anomalyScore > 0.8) {
        alerts.push({
          id: `anomaly-${scenarioId}-${Date.now()}`,
          scenarioId,
          metric: 'anomaly',
          severity: 'high',
          degradation: anomalyScore * 100,
          baseline: 0.5,
          current: anomalyScore,
          threshold: 0.8,
          confidence: anomalyScore,
          timestamp: new Date(),
          additionalContext: {
            trend: 'stable',
            changePoints: [],
            correlatedMetrics: []
          },
          recommendations: [
            'Neural network detected performance anomaly',
            'Current metrics deviate significantly from learned patterns',
            'Investigate system changes or unusual load patterns'
          ]
        });
      }
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }

    this.emit('regressionAnalysisComplete', { scenarioId, alerts, currentMetrics, baseline });
    return alerts;
  }

  /**
   * Set or update baseline for a scenario
   */
  async setBaseline(scenarioId: string, results: LoadTestResults, options?: {
    version?: string;
    environment?: string;
    confidence?: number;
  }): Promise<void> {
    const metrics = this.extractMetrics(results);
    const baseline: RegressionBaseline = {
      id: `${scenarioId}-${Date.now()}`,
      scenarioId,
      metrics,
      timestamp: new Date(),
      version: options?.version,
      environment: options?.environment || process.env.NODE_ENV || 'unknown',
      sampleSize: results.summary.totalRequests,
      confidence: options?.confidence || 0.95
    };

    this.baselines.set(scenarioId, baseline);
    await this.saveBaseline(baseline);
    
    // Add to training data for neural model
    this.addTrainingData(metrics);
    
    this.emit('baselineUpdated', baseline);
    console.log(`Baseline updated for scenario: ${scenarioId}`);
  }

  /**
   * Configure regression thresholds
   */
  setThreshold(metric: string, threshold: RegressionThreshold): void {
    this.thresholds.set(metric, threshold);
    this.emit('thresholdUpdated', { metric, threshold });
  }

  /**
   * Get all baselines
   */
  getBaselines(): RegressionBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Get regression alerts for a time period
   */
  async getRegressionAlerts(period?: { start: Date; end: Date }): Promise<RegressionAlert[]> {
    try {
      let query = 'SELECT * FROM regression_alerts ORDER BY timestamp DESC';
      const params: any[] = [];

      if (period) {
        query = 'SELECT * FROM regression_alerts WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC';
        params.push(period.start.toISOString(), period.end.toISOString());
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as any[];
      
      return rows.map(row => ({
        ...JSON.parse(row.alert_data),
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      console.error('Failed to fetch regression alerts:', error);
      return [];
    }
  }

  /**
   * Generate regression report
   */
  async generateRegressionReport(scenarioId: string, period: { start: Date; end: Date }): Promise<{
    summary: {
      totalAlerts: number;
      criticalAlerts: number;
      mostAffectedMetrics: string[];
      overallTrend: 'improving' | 'stable' | 'degrading';
    };
    alerts: RegressionAlert[];
    trends: TrendAnalysis[];
    recommendations: string[];
  }> {
    const alerts = await this.getRegressionAlerts(period);
    const scenarioAlerts = alerts.filter(a => a.scenarioId === scenarioId);
    
    const trends = await this.analyzeTrends(scenarioId, period);
    
    const summary = {
      totalAlerts: scenarioAlerts.length,
      criticalAlerts: scenarioAlerts.filter(a => a.severity === 'critical').length,
      mostAffectedMetrics: this.getMostAffectedMetrics(scenarioAlerts),
      overallTrend: trends?.trend || 'stable' as 'improving' | 'stable' | 'degrading'
    };

    const recommendations = this.generateRecommendations(scenarioAlerts, trends);

    return {
      summary,
      alerts: scenarioAlerts,
      trends: trends ? [trends] : [],
      recommendations
    };
  }

  /**
   * Train neural model for anomaly detection
   */
  async trainNeuralModel(): Promise<void> {
    if (this.trainingData.length < 100) {
      console.log('Insufficient training data for neural model');
      return;
    }

    console.log('Training neural model for anomaly detection...');
    
    const features = this.trainingData.map(d => d.features);
    const labels = this.trainingData.map(d => d.label);
    
    const xs = tf.tensor2d(features);
    const ys = tf.tensor1d(labels);
    
    // Create autoencoder for anomaly detection
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [features[0].length], units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: features[0].length, activation: 'linear' })
      ]
    });
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    await model.fit(xs, xs, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0
    });
    
    this.neuralModel = model;
    console.log('Neural model training completed');
    
    xs.dispose();
    ys.dispose();
  }

  /**
   * Private methods
   */
  private async performRegressionCheck(): Promise<void> {
    console.log('Performing automated regression check...');
    
    // Get recent performance data
    const recentMetrics = await this.getRecentMetrics();
    
    for (const [scenarioId, baseline] of this.baselines) {
      const currentMetrics = recentMetrics.get(scenarioId);
      if (!currentMetrics) continue;
      
      // Mock LoadTestResults for compatibility
      const mockResults: LoadTestResults = {
        scenario: { id: scenarioId } as any,
        summary: { totalRequests: 100 } as any,
        metrics: {
          responseTime: currentMetrics.responseTime,
          throughput: currentMetrics.throughput,
          errorRate: currentMetrics.errorRate
        } as any,
        timeline: [],
        errors: [],
        thresholdResults: [],
        recommendations: []
      };
      
      await this.analyzeResults(scenarioId, mockResults);
    }
  }

  private async detectRegression(
    metricKey: string,
    current: number,
    baseline: number,
    threshold: RegressionThreshold
  ): Promise<RegressionAlert | null> {
    let degradation = 0;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // Calculate degradation based on metric type
    if (metricKey.includes('responseTime') || metricKey.includes('errorRate')) {
      degradation = ((current - baseline) / baseline) * 100;
    } else if (metricKey.includes('throughput')) {
      degradation = ((baseline - current) / baseline) * 100;
    }
    
    // Determine if regression occurred
    const isRegression = Math.abs(degradation) > threshold.warning;
    if (!isRegression) return null;
    
    // Determine severity
    if (Math.abs(degradation) > threshold.critical) {
      severity = 'critical';
    } else if (Math.abs(degradation) > threshold.warning * 1.5) {
      severity = 'high';
    } else {
      severity = 'medium';
    }
    
    return {
      id: `regression-${metricKey}-${Date.now()}`,
      scenarioId: metricKey.split('.')[0],
      metric: metricKey,
      severity,
      degradation: Math.abs(degradation),
      baseline,
      current,
      threshold: threshold.warning,
      confidence: 0.95,
      timestamp: new Date(),
      additionalContext: {
        trend: degradation > 0 ? 'degrading' : 'improving',
        changePoints: [],
        correlatedMetrics: []
      },
      recommendations: this.getMetricRecommendations(metricKey, degradation)
    };
  }

  private async analyzeTrends(scenarioId: string, period?: { start: Date; end: Date }): Promise<TrendAnalysis | null> {
    try {
      // Get historical data
      const historicalData = await this.getHistoricalData(scenarioId, period);
      if (historicalData.length < 10) return null;
      
      const values = historicalData.map(d => d.value);
      const trend = StatisticalAnalyzer.mannKendallTrend(values);
      const seasonality = StatisticalAnalyzer.detectSeasonality(values);
      
      // Simple forecast (last value + trend)
      const lastValue = values[values.length - 1];
      const forecast = {
        nextValue: lastValue + trend.slope,
        confidence: trend.significance / 10,
        upperBound: lastValue + trend.slope * 1.2,
        lowerBound: lastValue + trend.slope * 0.8
      };
      
      return {
        metric: scenarioId,
        period: period ? `${period.start.toISOString()}-${period.end.toISOString()}` : 'recent',
        trend: trend.trend,
        slope: trend.slope,
        correlation: trend.significance / 10,
        seasonality,
        forecast
      };
    } catch (error) {
      console.error('Failed to analyze trends:', error);
      return null;
    }
  }

  private async detectAnomalies(metrics: PerformanceMetrics): Promise<number> {
    if (!this.neuralModel) return 0;
    
    try {
      const features = this.metricsToFeatures(metrics);
      const input = tf.tensor2d([features]);
      const reconstruction = this.neuralModel.predict(input) as tf.Tensor;
      
      // Calculate reconstruction error
      const error = tf.losses.meanSquaredError(input, reconstruction);
      const errorValue = await error.data();
      
      input.dispose();
      reconstruction.dispose();
      error.dispose();
      
      // Normalize error to 0-1 scale
      return Math.min(errorValue[0] * 10, 1);
    } catch (error) {
      console.error('Anomaly detection failed:', error);
      return 0;
    }
  }

  private async sendAlert(alert: RegressionAlert): Promise<void> {
    // Save to database
    try {
      const stmt = db.prepare(`
        INSERT INTO regression_alerts 
        (scenario_id, metric, severity, degradation, timestamp, alert_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        alert.scenarioId,
        alert.metric,
        alert.severity,
        alert.degradation,
        alert.timestamp.toISOString(),
        JSON.stringify(alert)
      );
    } catch (error) {
      console.error('Failed to save regression alert:', error);
    }
    
    // Send to alerting system
    await alertingSystem.sendAlert({
      id: alert.id,
      type: 'performance_regression',
      severity: alert.severity,
      title: `Performance Regression Detected: ${alert.metric}`,
      message: `${alert.metric} degraded by ${alert.degradation.toFixed(1)}% (${alert.current} vs baseline ${alert.baseline})`,
      timestamp: alert.timestamp,
      metadata: {
        scenarioId: alert.scenarioId,
        metric: alert.metric,
        degradation: alert.degradation,
        recommendations: alert.recommendations
      }
    });
    
    this.emit('regressionAlert', alert);
  }

  private extractMetrics(results: LoadTestResults): PerformanceMetrics {
    return {
      responseTime: {
        mean: results.metrics.responseTime.avg,
        p50: results.metrics.responseTime.p50,
        p95: results.metrics.responseTime.p95,
        p99: results.metrics.responseTime.p99,
        std: 0 // Would calculate from raw data
      },
      throughput: {
        mean: results.metrics.throughput.avg,
        std: 0 // Would calculate from timeline data
      },
      errorRate: results.metrics.errorRate,
      availability: 100 - results.metrics.errorRate,
      resourceUsage: {
        cpu: 0, // Would get from system metrics
        memory: 0,
        io: 0
      }
    };
  }

  private setupDefaultThresholds(): void {
    this.setThreshold('responseTime.p95', {
      metric: 'responseTime.p95',
      warning: 20, // 20% increase
      critical: 50, // 50% increase
      method: 'statistical',
      confidence: 0.95,
      minSampleSize: 30
    });
    
    this.setThreshold('responseTime.mean', {
      metric: 'responseTime.mean',
      warning: 15,
      critical: 40,
      method: 'statistical',
      confidence: 0.95,
      minSampleSize: 30
    });
    
    this.setThreshold('throughput.mean', {
      metric: 'throughput.mean',
      warning: 15, // 15% decrease
      critical: 30, // 30% decrease
      method: 'statistical',
      confidence: 0.95,
      minSampleSize: 30
    });
    
    this.setThreshold('errorRate', {
      metric: 'errorRate',
      warning: 100, // 100% increase (double)
      critical: 300, // 300% increase (4x)
      method: 'absolute',
      confidence: 0.95,
      minSampleSize: 10
    });
  }

  private async initializeNeuralModel(): Promise<void> {
    // Initialize with a simple autoencoder
    // In production, load pre-trained model or train with historical data
    try {
      this.neuralModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [8], units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 4, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'linear' })
        ]
      });
      
      this.neuralModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError'
      });
    } catch (error) {
      console.error('Failed to initialize neural model:', error);
    }
  }

  private async loadBaselinesFromDatabase(): Promise<void> {
    try {
      const stmt = db.prepare('SELECT * FROM regression_baselines ORDER BY timestamp DESC');
      const rows = stmt.all() as any[];
      
      for (const row of rows) {
        const baseline = JSON.parse(row.baseline_data);
        baseline.timestamp = new Date(row.timestamp);
        this.baselines.set(baseline.scenarioId, baseline);
      }
      
      console.log(`Loaded ${rows.length} baselines from database`);
    } catch (error) {
      console.error('Failed to load baselines:', error);
    }
  }

  private async saveBaseline(baseline: RegressionBaseline): Promise<void> {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO regression_baselines 
        (scenario_id, timestamp, baseline_data)
        VALUES (?, ?, ?)
      `);
      
      stmt.run(
        baseline.scenarioId,
        baseline.timestamp.toISOString(),
        JSON.stringify(baseline)
      );
    } catch (error) {
      console.error('Failed to save baseline:', error);
    }
  }

  private addTrainingData(metrics: PerformanceMetrics): void {
    const features = this.metricsToFeatures(metrics);
    this.trainingData.push({
      features,
      label: 0 // Normal performance (for autoencoder)
    });
    
    // Keep only recent training data
    if (this.trainingData.length > 10000) {
      this.trainingData = this.trainingData.slice(-5000);
    }
  }

  private metricsToFeatures(metrics: PerformanceMetrics): number[] {
    return [
      metrics.responseTime.mean,
      metrics.responseTime.p95,
      metrics.responseTime.p99,
      metrics.throughput.mean,
      metrics.errorRate,
      metrics.availability,
      metrics.resourceUsage.cpu,
      metrics.resourceUsage.memory
    ];
  }

  private async getRecentMetrics(): Promise<Map<string, PerformanceMetrics>> {
    // Mock implementation - would get from performance monitor
    const metrics = new Map<string, PerformanceMetrics>();
    
    // This would typically fetch recent performance data
    // For now, return empty map
    return metrics;
  }

  private async getHistoricalData(scenarioId: string, period?: { start: Date; end: Date }): Promise<Array<{ timestamp: Date; value: number }>> {
    // Mock implementation - would fetch from database
    return [];
  }

  private getMostAffectedMetrics(alerts: RegressionAlert[]): string[] {
    const metricCounts = new Map<string, number>();
    
    alerts.forEach(alert => {
      const count = metricCounts.get(alert.metric) || 0;
      metricCounts.set(alert.metric, count + 1);
    });
    
    return Array.from(metricCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([metric]) => metric);
  }

  private generateRecommendations(alerts: RegressionAlert[], trends?: TrendAnalysis): string[] {
    const recommendations = new Set<string>();
    
    if (alerts.some(a => a.metric.includes('responseTime'))) {
      recommendations.add('Consider optimizing database queries and adding caching');
      recommendations.add('Review recent code changes that might affect response times');
    }
    
    if (alerts.some(a => a.metric.includes('throughput'))) {
      recommendations.add('Investigate resource bottlenecks (CPU, memory, I/O)');
      recommendations.add('Consider horizontal scaling or load balancing improvements');
    }
    
    if (alerts.some(a => a.metric.includes('errorRate'))) {
      recommendations.add('Review error logs for patterns and implement better error handling');
      recommendations.add('Check system dependencies and external service availability');
    }
    
    if (trends?.trend === 'degrading') {
      recommendations.add('Performance is degrading over time - schedule maintenance review');
      recommendations.add('Monitor for memory leaks or resource accumulation issues');
    }
    
    if (alerts.some(a => a.severity === 'critical')) {
      recommendations.add('CRITICAL: Immediate investigation required for production stability');
    }
    
    return Array.from(recommendations);
  }

  private getMetricRecommendations(metricKey: string, degradation: number): string[] {
    const recommendations = [];
    
    if (metricKey.includes('responseTime')) {
      recommendations.push('Response time degradation detected');
      if (degradation > 50) {
        recommendations.push('SEVERE: Response time increased by >50% - immediate action required');
      }
      recommendations.push('Check database performance and query optimization');
      recommendations.push('Review caching strategies and hit rates');
    } else if (metricKey.includes('throughput')) {
      recommendations.push('Throughput degradation detected');
      recommendations.push('Monitor system resources (CPU, memory, I/O)');
      recommendations.push('Consider scaling or load balancing adjustments');
    } else if (metricKey.includes('errorRate')) {
      recommendations.push('Error rate increase detected');
      recommendations.push('Review application logs for error patterns');
      recommendations.push('Check external dependencies and service health');
    }
    
    return recommendations;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring();
    
    if (this.neuralModel) {
      this.neuralModel.dispose();
    }
    
    this.cache.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const performanceRegressionDetector = new PerformanceRegressionDetector();