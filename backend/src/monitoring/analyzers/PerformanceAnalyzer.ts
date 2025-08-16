import { EventEmitter } from 'events';
import { Logger } from '../../utils/Logger';

export interface PerformanceMetrics {
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  availability: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  concurrentUsers: number;
  timestamp: number;
}

export interface PerformanceAnomaly {
  type: 'response_time' | 'error_rate' | 'throughput' | 'availability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  threshold: number;
  description: string;
  timestamp: number;
  impact: number;
}

export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  changeRate: number;
  confidence: number;
  timespan: number;
}

export class PerformanceAnalyzer extends EventEmitter {
  private logger = Logger.getInstance();
  private isInitialized = false;
  
  // Performance baselines
  private baselines = {
    responseTime: 200, // ms
    errorRate: 0.01, // 1%
    availability: 0.999, // 99.9%
    throughput: 1000 // requests/minute
  };
  
  // Historical data for trend analysis
  private performanceHistory: PerformanceMetrics[] = [];
  private anomalyHistory: PerformanceAnomaly[] = [];
  
  // Statistical analysis
  private statisticalThresholds = {
    responseTime: { warning: 500, critical: 1000 },
    errorRate: { warning: 0.05, critical: 0.1 },
    availability: { warning: 0.99, critical: 0.95 },
    throughput: { warning: 500, critical: 200 }
  };

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing performance analyzer');
    
    // Load historical data if available
    await this.loadHistoricalData();
    
    // Calculate dynamic baselines
    this.calculateDynamicBaselines();
    
    this.isInitialized = true;
    this.logger.info('Performance analyzer initialized successfully');
  }

  public async collect(): Promise<PerformanceMetrics> {
    const timestamp = Date.now();
    
    // Simulate performance metrics collection
    // In a real implementation, this would integrate with monitoring systems
    const metrics: PerformanceMetrics = {
      averageResponseTime: this.generateRealisticResponseTime(),
      requestsPerSecond: this.generateRealisticThroughput(),
      errorRate: this.generateRealisticErrorRate(),
      availability: this.generateRealisticAvailability(),
      p50ResponseTime: this.generatePercentileResponseTime(0.5),
      p95ResponseTime: this.generatePercentileResponseTime(0.95),
      p99ResponseTime: this.generatePercentileResponseTime(0.99),
      throughput: this.generateRealisticThroughput() * 60, // Convert to per minute
      concurrentUsers: this.generateRealisticConcurrentUsers(),
      timestamp
    };

    // Store for trend analysis
    this.performanceHistory.push(metrics);
    this.cleanupHistory();

    // Analyze for anomalies
    const anomalies = this.detectAnomalies(metrics);
    if (anomalies.length > 0) {
      anomalies.forEach(anomaly => {
        this.anomalyHistory.push(anomaly);
        this.emit('anomaly', anomaly);
      });
    }

    return metrics;
  }

  private generateRealisticResponseTime(): number {
    // Generate response time with some variance and occasional spikes
    const baseTime = 150;
    const variance = Math.random() * 100;
    const spike = Math.random() < 0.05 ? Math.random() * 500 : 0; // 5% chance of spike
    
    return baseTime + variance + spike;
  }

  private generateRealisticThroughput(): number {
    // Generate throughput with daily patterns
    const hour = new Date().getHours();
    const baseThroughput = 50; // requests per second
    
    // Peak hours simulation (9 AM - 5 PM)
    const peakMultiplier = (hour >= 9 && hour <= 17) ? 2.0 : 0.5;
    const variance = Math.random() * 0.5 + 0.75; // 75% - 125% variance
    
    return Math.floor(baseThroughput * peakMultiplier * variance);
  }

  private generateRealisticErrorRate(): number {
    // Generate error rate with occasional bursts
    const baseErrorRate = 0.005; // 0.5%
    const burst = Math.random() < 0.02 ? Math.random() * 0.05 : 0; // 2% chance of error burst
    
    return Math.min(baseErrorRate + burst, 0.5); // Cap at 50%
  }

  private generateRealisticAvailability(): number {
    // High availability with rare dips
    const baseAvailability = 0.9995;
    const dip = Math.random() < 0.001 ? Math.random() * 0.1 : 0; // 0.1% chance of availability dip
    
    return Math.max(baseAvailability - dip, 0.8); // Never go below 80%
  }

  private generatePercentileResponseTime(percentile: number): number {
    const baseResponse = this.generateRealisticResponseTime();
    
    // Percentiles are typically higher than average
    const multiplier = percentile === 0.5 ? 1.0 : 
                     percentile === 0.95 ? 2.5 : 
                     percentile === 0.99 ? 4.0 : 1.0;
    
    return baseResponse * multiplier;
  }

  private generateRealisticConcurrentUsers(): number {
    const hour = new Date().getHours();
    const baseUsers = 100;
    
    // Peak hours simulation
    const peakMultiplier = (hour >= 9 && hour <= 17) ? 3.0 : 0.3;
    const variance = Math.random() * 0.4 + 0.8; // 80% - 120% variance
    
    return Math.floor(baseUsers * peakMultiplier * variance);
  }

  public detectAnomalies(metrics: PerformanceMetrics): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    const timestamp = Date.now();

    // Response time anomalies
    if (metrics.averageResponseTime > this.statisticalThresholds.responseTime.critical) {
      anomalies.push({
        type: 'response_time',
        severity: 'critical',
        value: metrics.averageResponseTime,
        threshold: this.statisticalThresholds.responseTime.critical,
        description: `Critical response time: ${metrics.averageResponseTime.toFixed(2)}ms`,
        timestamp,
        impact: this.calculateImpact('response_time', metrics.averageResponseTime)
      });
    } else if (metrics.averageResponseTime > this.statisticalThresholds.responseTime.warning) {
      anomalies.push({
        type: 'response_time',
        severity: 'high',
        value: metrics.averageResponseTime,
        threshold: this.statisticalThresholds.responseTime.warning,
        description: `High response time: ${metrics.averageResponseTime.toFixed(2)}ms`,
        timestamp,
        impact: this.calculateImpact('response_time', metrics.averageResponseTime)
      });
    }

    // Error rate anomalies
    if (metrics.errorRate > this.statisticalThresholds.errorRate.critical) {
      anomalies.push({
        type: 'error_rate',
        severity: 'critical',
        value: metrics.errorRate,
        threshold: this.statisticalThresholds.errorRate.critical,
        description: `Critical error rate: ${(metrics.errorRate * 100).toFixed(2)}%`,
        timestamp,
        impact: this.calculateImpact('error_rate', metrics.errorRate)
      });
    } else if (metrics.errorRate > this.statisticalThresholds.errorRate.warning) {
      anomalies.push({
        type: 'error_rate',
        severity: 'high',
        value: metrics.errorRate,
        threshold: this.statisticalThresholds.errorRate.warning,
        description: `High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`,
        timestamp,
        impact: this.calculateImpact('error_rate', metrics.errorRate)
      });
    }

    // Availability anomalies
    if (metrics.availability < this.statisticalThresholds.availability.critical) {
      anomalies.push({
        type: 'availability',
        severity: 'critical',
        value: metrics.availability,
        threshold: this.statisticalThresholds.availability.critical,
        description: `Critical availability: ${(metrics.availability * 100).toFixed(2)}%`,
        timestamp,
        impact: this.calculateImpact('availability', metrics.availability)
      });
    } else if (metrics.availability < this.statisticalThresholds.availability.warning) {
      anomalies.push({
        type: 'availability',
        severity: 'high',
        value: metrics.availability,
        threshold: this.statisticalThresholds.availability.warning,
        description: `Low availability: ${(metrics.availability * 100).toFixed(2)}%`,
        timestamp,
        impact: this.calculateImpact('availability', metrics.availability)
      });
    }

    // Throughput anomalies
    if (metrics.requestsPerSecond < this.statisticalThresholds.throughput.critical) {
      anomalies.push({
        type: 'throughput',
        severity: 'critical',
        value: metrics.requestsPerSecond,
        threshold: this.statisticalThresholds.throughput.critical,
        description: `Critical low throughput: ${metrics.requestsPerSecond.toFixed(1)} req/s`,
        timestamp,
        impact: this.calculateImpact('throughput', metrics.requestsPerSecond)
      });
    } else if (metrics.requestsPerSecond < this.statisticalThresholds.throughput.warning) {
      anomalies.push({
        type: 'throughput',
        severity: 'medium',
        value: metrics.requestsPerSecond,
        threshold: this.statisticalThresholds.throughput.warning,
        description: `Low throughput: ${metrics.requestsPerSecond.toFixed(1)} req/s`,
        timestamp,
        impact: this.calculateImpact('throughput', metrics.requestsPerSecond)
      });
    }

    return anomalies;
  }

  private calculateImpact(metricType: string, value: number): number {
    // Calculate business impact score (0-1)
    switch (metricType) {
      case 'response_time':
        return Math.min(value / 2000, 1); // Max impact at 2 seconds
      case 'error_rate':
        return Math.min(value / 0.1, 1); // Max impact at 10% error rate
      case 'availability':
        return Math.min((1 - value) / 0.1, 1); // Max impact at 90% availability
      case 'throughput':
        return Math.min((1000 - value) / 1000, 1); // Max impact when throughput approaches 0
      default:
        return 0.5;
    }
  }

  public async analyzeTrends(metrics: any[]): Promise<PerformanceTrend[]> {
    if (metrics.length < 5) {
      return []; // Need at least 5 data points for meaningful trend analysis
    }

    const trends: PerformanceTrend[] = [];
    const metricsToAnalyze = ['responseTime', 'errorRate', 'availability', 'throughput'];

    for (const metricName of metricsToAnalyze) {
      const trend = this.calculateTrend(metrics, metricName);
      if (trend) {
        trends.push(trend);
      }
    }

    return trends;
  }

  private calculateTrend(metrics: any[], metricName: string): PerformanceTrend | null {
    const values = metrics.map(m => {
      switch (metricName) {
        case 'responseTime': return m.metrics?.responseTime || m.averageResponseTime;
        case 'errorRate': return m.metrics?.errorRate || m.errorRate;
        case 'availability': return m.metrics?.availability || m.availability;
        case 'throughput': return m.metrics?.throughput || m.requestsPerSecond;
        default: return 0;
      }
    }).filter(v => v !== undefined && v !== null);

    if (values.length < 3) return null;

    // Simple linear regression to determine trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const totalSumSquares = values.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const residualSumSquares = values.reduce((sum, yi, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    
    // Determine trend direction
    let direction: 'improving' | 'degrading' | 'stable' = 'stable';
    if (Math.abs(slope) > 0.1) { // Threshold for significant change
      if (metricName === 'responseTime' || metricName === 'errorRate') {
        direction = slope > 0 ? 'degrading' : 'improving';
      } else if (metricName === 'availability' || metricName === 'throughput') {
        direction = slope > 0 ? 'improving' : 'degrading';
      }
    }

    return {
      metric: metricName,
      direction,
      changeRate: slope,
      confidence: rSquared,
      timespan: metrics.length
    };
  }

  public async generateInsights(metrics: any[]): Promise<any> {
    const trends = await this.analyzeTrends(metrics);
    const recentAnomalies = this.anomalyHistory.filter(a => 
      Date.now() - a.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    const insights = {
      summary: {
        totalDataPoints: metrics.length,
        analysisTimespan: metrics.length > 0 ? 
          metrics[metrics.length - 1].timestamp - metrics[0].timestamp : 0,
        trendsDetected: trends.length,
        anomaliesLast24h: recentAnomalies.length
      },
      trends: trends.map(trend => ({
        metric: trend.metric,
        direction: trend.direction,
        confidence: `${(trend.confidence * 100).toFixed(1)}%`,
        significance: trend.confidence > 0.7 ? 'high' : 
                     trend.confidence > 0.4 ? 'medium' : 'low'
      })),
      topIssues: recentAnomalies
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 5)
        .map(anomaly => ({
          type: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description,
          impact: `${(anomaly.impact * 100).toFixed(1)}%`
        })),
      recommendations: this.generateInsightRecommendations(trends, recentAnomalies)
    };

    return insights;
  }

  private generateInsightRecommendations(trends: PerformanceTrend[], anomalies: PerformanceAnomaly[]): string[] {
    const recommendations: string[] = [];

    // Trend-based recommendations
    trends.forEach(trend => {
      if (trend.direction === 'degrading' && trend.confidence > 0.6) {
        switch (trend.metric) {
          case 'responseTime':
            recommendations.push('Consider optimizing database queries and implementing caching');
            break;
          case 'errorRate':
            recommendations.push('Review recent deployments and implement additional error handling');
            break;
          case 'availability':
            recommendations.push('Investigate infrastructure stability and implement redundancy');
            break;
          case 'throughput':
            recommendations.push('Scale application instances and optimize bottlenecks');
            break;
        }
      }
    });

    // Anomaly-based recommendations
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      recommendations.push('Immediate attention required for critical performance issues');
    }

    const highImpactAnomalies = anomalies.filter(a => a.impact > 0.7);
    if (highImpactAnomalies.length > 0) {
      recommendations.push('Focus on high-impact performance optimizations');
    }

    return recommendations;
  }

  private calculateDynamicBaselines(): void {
    if (this.performanceHistory.length < 10) return;

    const recent = this.performanceHistory.slice(-20); // Last 20 measurements
    
    this.baselines = {
      responseTime: this.calculatePercentile(recent.map(m => m.averageResponseTime), 0.95),
      errorRate: this.calculatePercentile(recent.map(m => m.errorRate), 0.95),
      availability: this.calculatePercentile(recent.map(m => m.availability), 0.05), // 5th percentile for availability
      throughput: this.calculatePercentile(recent.map(m => m.requestsPerSecond), 0.05) // 5th percentile for throughput
    };

    this.logger.debug('Updated dynamic baselines', this.baselines);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(percentile * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private async loadHistoricalData(): Promise<void> {
    // In a real implementation, this would load from persistent storage
    this.logger.debug('Loading historical performance data');
  }

  private cleanupHistory(): void {
    const maxHistorySize = 1000;
    const maxAnomalyHistory = 500;
    
    if (this.performanceHistory.length > maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-maxHistorySize);
    }
    
    if (this.anomalyHistory.length > maxAnomalyHistory) {
      this.anomalyHistory = this.anomalyHistory.slice(-maxAnomalyHistory);
    }
  }

  public getPerformanceSummary(): any {
    const recent = this.performanceHistory.slice(-10);
    if (recent.length === 0) return null;

    const latest = recent[recent.length - 1];
    const average = {
      responseTime: recent.reduce((sum, m) => sum + m.averageResponseTime, 0) / recent.length,
      errorRate: recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length,
      availability: recent.reduce((sum, m) => sum + m.availability, 0) / recent.length,
      throughput: recent.reduce((sum, m) => sum + m.requestsPerSecond, 0) / recent.length
    };

    return {
      latest,
      average,
      baselines: this.baselines,
      recentAnomalies: this.anomalyHistory.slice(-5)
    };
  }
}