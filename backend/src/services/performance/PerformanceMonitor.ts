import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import * as os from 'os';
import LRU from 'lru-cache';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
    utilization: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    utilization: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
}

export interface ApplicationMetrics {
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  queueSize: number;
  cacheHitRate: number;
  databaseQueries: number;
  memoryLeaks: boolean;
}

export interface PerformanceAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]>;
  private alerts: Map<string, PerformanceAlert>;
  private thresholds: Map<string, { warning: number; critical: number }>;
  private cache: LRU<string, any>;
  private observer: PerformanceObserver | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private startTime: number;
  private lastSystemMetrics: SystemMetrics | null = null;

  constructor() {
    super();
    this.metrics = new Map();
    this.alerts = new Map();
    this.thresholds = new Map();
    this.startTime = Date.now();
    
    // Initialize cache for storing computed metrics
    this.cache = new LRU({
      max: 1000,
      ttl: 1000 * 60 * 5 // 5 minutes
    });
    
    // Set default thresholds
    this.setupDefaultThresholds();
    
    // Initialize performance observer
    this.initializePerformanceObserver();
  }

  /**
   * Start monitoring system and application performance
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Start collecting metrics at specified interval
    this.intervalId = setInterval(() => {
      this.collectSystemMetrics();
      this.collectApplicationMetrics();
      this.checkAlerts();
    }, intervalMs);

    // Start Node.js performance monitoring
    if (this.observer) {
      this.observer.observe({ entryTypes: ['measure', 'mark', 'navigation', 'resource'] });
    }

    console.log(`Performance monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.observer) {
      this.observer.disconnect();
    }

    console.log('Performance monitoring stopped');
  }

  /**
   * Record a custom metric
   */
  public recordMetric(name: string, value: number, unit: string = '', tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Keep only last 1000 metrics per name
    if (metricArray.length > 1000) {
      metricArray.shift();
    }

    // Check if this metric triggers an alert
    this.checkMetricThreshold(name, value);
    
    // Emit metric event
    this.emit('metric', metric);
  }

  /**
   * Get metrics for a specific name
   */
  public getMetrics(name: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(name) || [];
    return metrics.slice(-limit);
  }

  /**
   * Get all metric names
   */
  public getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get current system metrics
   */
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const cacheKey = 'system_metrics';
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const metrics = await this.collectSystemMetrics();
    this.cache.set(cacheKey, metrics, { ttl: 1000 * 10 }); // 10 seconds cache
    
    return metrics;
  }

  /**
   * Get current application metrics
   */
  public getApplicationMetrics(): ApplicationMetrics {
    const cacheKey = 'app_metrics';
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const metrics = this.collectApplicationMetrics();
    this.cache.set(cacheKey, metrics, { ttl: 1000 * 5 }); // 5 seconds cache
    
    return metrics;
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    systemHealth: 'good' | 'warning' | 'critical';
    uptime: number;
    totalMetrics: number;
    activeAlerts: number;
    topMetrics: { name: string; value: number; unit: string }[];
  } {
    const activeAlerts = this.getActiveAlerts();
    const systemHealth = this.determineSystemHealth(activeAlerts);
    const uptime = Date.now() - this.startTime;
    
    // Calculate top metrics by recent activity
    const topMetrics = this.getTopMetrics(5);
    
    return {
      systemHealth,
      uptime,
      totalMetrics: this.metrics.size,
      activeAlerts: activeAlerts.length,
      topMetrics
    };
  }

  /**
   * Set custom threshold for a metric
   */
  public setThreshold(metricName: string, warning: number, critical: number): void {
    this.thresholds.set(metricName, { warning, critical });
  }

  /**
   * Clear all metrics and alerts
   */
  public clear(): void {
    this.metrics.clear();
    this.alerts.clear();
    this.cache.clear();
    console.log('Performance metrics cleared');
  }

  /**
   * Get performance statistics
   */
  public getStatistics(): Record<string, { avg: number; max: number; min: number; count: number }> {
    const stats: Record<string, { avg: number; max: number; min: number; count: number }> = {};
    
    for (const [name, metrics] of this.metrics) {
      if (metrics.length > 0) {
        const values = metrics.map(m => m.value);
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        stats[name] = {
          avg: Math.round(avg * 100) / 100,
          max: Math.round(max * 100) / 100,
          min: Math.round(min * 100) / 100,
          count: metrics.length
        };
      }
    }
    
    return stats;
  }

  /**
   * Initialize performance observer
   */
  private initializePerformanceObserver(): void {
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(
            `nodejs_${entry.entryType}_${entry.name}`,
            entry.duration || 0,
            'ms',
            { type: entry.entryType }
          );
        }
      });
    } catch (error) {
      console.warn('Failed to initialize performance observer:', error.message);
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    const metrics: SystemMetrics = {
      cpu: {
        usage: Math.round(cpuUsage * 100),
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        cached: 0, // Not easily available in Node.js
        utilization: Math.round((usedMemory / totalMemory) * 100)
      },
      disk: {
        total: 0, // Would need additional library for disk metrics
        used: 0,
        free: 0,
        utilization: 0
      },
      network: {
        bytesIn: 0, // Would need additional library for network metrics
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      }
    };

    // Record individual metrics
    this.recordMetric('cpu_usage', metrics.cpu.usage, '%');
    this.recordMetric('memory_usage', metrics.memory.utilization, '%');
    this.recordMetric('memory_used', metrics.memory.used, 'bytes');
    this.recordMetric('memory_free', metrics.memory.free, 'bytes');
    
    this.lastSystemMetrics = metrics;
    return metrics;
  }

  /**
   * Collect application-specific metrics
   */
  private collectApplicationMetrics(): ApplicationMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const metrics: ApplicationMetrics = {
      requestsPerSecond: this.calculateRequestsPerSecond(),
      averageResponseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateErrorRate(),
      activeConnections: this.getActiveConnections(),
      queueSize: this.getQueueSize(),
      cacheHitRate: this.calculateCacheHitRate(),
      databaseQueries: this.getDatabaseQueries(),
      memoryLeaks: this.detectMemoryLeaks()
    };

    // Record individual metrics
    this.recordMetric('app_requests_per_second', metrics.requestsPerSecond, 'rps');
    this.recordMetric('app_response_time', metrics.averageResponseTime, 'ms');
    this.recordMetric('app_error_rate', metrics.errorRate, '%');
    this.recordMetric('app_active_connections', metrics.activeConnections, 'connections');
    this.recordMetric('app_queue_size', metrics.queueSize, 'items');
    this.recordMetric('app_cache_hit_rate', metrics.cacheHitRate, '%');
    this.recordMetric('nodejs_heap_used', memoryUsage.heapUsed, 'bytes');
    this.recordMetric('nodejs_heap_total', memoryUsage.heapTotal, 'bytes');
    this.recordMetric('nodejs_external', memoryUsage.external, 'bytes');
    this.recordMetric('nodejs_uptime', uptime, 'seconds');

    return metrics;
  }

  /**
   * Setup default performance thresholds
   */
  private setupDefaultThresholds(): void {
    this.thresholds.set('cpu_usage', { warning: 70, critical: 90 });
    this.thresholds.set('memory_usage', { warning: 80, critical: 95 });
    this.thresholds.set('app_response_time', { warning: 1000, critical: 5000 });
    this.thresholds.set('app_error_rate', { warning: 5, critical: 10 });
    this.thresholds.set('app_queue_size', { warning: 100, critical: 500 });
    this.thresholds.set('nodejs_heap_used', { warning: 1e9, critical: 2e9 }); // 1GB, 2GB
  }

  /**
   * Check if a metric exceeds thresholds
   */
  private checkMetricThreshold(metricName: string, value: number): void {
    const threshold = this.thresholds.get(metricName);
    if (!threshold) return;

    const alertId = `${metricName}_threshold`;
    const existingAlert = this.alerts.get(alertId);

    if (value >= threshold.critical) {
      if (!existingAlert || existingAlert.severity !== 'critical') {
        this.createAlert(alertId, 'critical', metricName, threshold.critical, value);
      }
    } else if (value >= threshold.warning) {
      if (!existingAlert || existingAlert.severity !== 'high') {
        this.createAlert(alertId, 'high', metricName, threshold.warning, value);
      }
    } else {
      // Value is below thresholds, resolve alert if it exists
      if (existingAlert && !existingAlert.resolved) {
        existingAlert.resolved = true;
        this.emit('alert_resolved', existingAlert);
      }
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(id: string, severity: PerformanceAlert['severity'], metric: string, threshold: number, currentValue: number): void {
    const alert: PerformanceAlert = {
      id,
      severity,
      metric,
      threshold,
      currentValue,
      message: `${metric} exceeded ${severity} threshold: ${currentValue} >= ${threshold}`,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.set(id, alert);
    this.emit('alert', alert);
  }

  /**
   * Check all active alerts
   */
  private checkAlerts(): void {
    // This method can be extended to perform more complex alert logic
    // For now, individual metric checks handle alert creation
  }

  /**
   * Calculate requests per second
   */
  private calculateRequestsPerSecond(): number {
    const requestMetrics = this.getMetrics('app_requests_per_second', 60);
    if (requestMetrics.length === 0) return 0;
    
    const recent = requestMetrics.slice(-10); // Last 10 measurements
    return recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    const responseMetrics = this.getMetrics('app_response_time', 60);
    if (responseMetrics.length === 0) return 0;
    
    const recent = responseMetrics.slice(-10);
    return recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const errorMetrics = this.getMetrics('app_error_rate', 60);
    if (errorMetrics.length === 0) return 0;
    
    const recent = errorMetrics.slice(-10);
    return recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
  }

  /**
   * Get active connections (placeholder)
   */
  private getActiveConnections(): number {
    // This would be implemented based on your WebSocket/HTTP server
    return 0;
  }

  /**
   * Get queue size (placeholder)
   */
  private getQueueSize(): number {
    // This would be implemented based on your queue system
    return 0;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const hitRate = this.cache.calculatedSize > 0 ? 
      (this.cache.calculatedSize - this.cache.size) / this.cache.calculatedSize * 100 : 0;
    return Math.round(hitRate * 100) / 100;
  }

  /**
   * Get database queries count (placeholder)
   */
  private getDatabaseQueries(): number {
    // This would be implemented based on your database connection pool
    return 0;
  }

  /**
   * Detect memory leaks
   */
  private detectMemoryLeaks(): boolean {
    const memoryMetrics = this.getMetrics('nodejs_heap_used', 30);
    if (memoryMetrics.length < 10) return false;
    
    // Simple memory leak detection: check if memory usage is consistently increasing
    const recent = memoryMetrics.slice(-10);
    const trend = recent.reduce((sum, metric, index) => {
      if (index === 0) return sum;
      return sum + (metric.value - recent[index - 1].value);
    }, 0);
    
    return trend > 0 && trend > recent[0].value * 0.1; // 10% increase trend
  }

  /**
   * Determine overall system health
   */
  private determineSystemHealth(alerts: PerformanceAlert[]): 'good' | 'warning' | 'critical' {
    if (alerts.some(alert => alert.severity === 'critical')) {
      return 'critical';
    }
    if (alerts.some(alert => alert.severity === 'high' || alert.severity === 'medium')) {
      return 'warning';
    }
    return 'good';
  }

  /**
   * Get top metrics by recent activity
   */
  private getTopMetrics(limit: number): { name: string; value: number; unit: string }[] {
    const topMetrics: { name: string; value: number; unit: string }[] = [];
    
    for (const [name, metrics] of this.metrics) {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        topMetrics.push({
          name,
          value: latest.value,
          unit: latest.unit
        });
      }
    }
    
    // Sort by value (descending) and take top N
    return topMetrics
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  /**
   * Export metrics to JSON
   */
  public exportMetrics(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      metrics: Object.fromEntries(this.metrics),
      alerts: Array.from(this.alerts.values()),
      thresholds: Object.fromEntries(this.thresholds),
      summary: this.getPerformanceSummary()
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();