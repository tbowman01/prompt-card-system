import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';
import { Logger } from '../../utils/Logger';

export interface CollectorConfig {
  interval: number;
  batchSize: number;
  enableRealTime: boolean;
}

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  timestamp: number;
}

export interface CacheMetrics {
  hitRate: number;
  memoryUsage: number;
  evictionRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  timestamp: number;
}

export interface ApplicationMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  activeConnections: number;
  queueLength: number;
  timestamp: number;
}

export class MetricsCollector extends EventEmitter {
  private logger = Logger.getInstance();
  private isInitialized = false;
  private collectInterval?: NodeJS.Timeout;
  private metricsBuffer: any[] = [];
  
  // Baseline metrics for comparison
  private baselineMetrics: ResourceMetrics | null = null;
  private lastCollectionTime = 0;
  
  // Performance tracking
  private performanceMarks = new Map<string, number>();
  private requestMetrics = new Map<string, number[]>();

  constructor(private config: CollectorConfig) {
    super();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing metrics collector');
    
    // Establish baseline
    this.baselineMetrics = await this.collectResourceMetrics();
    this.lastCollectionTime = Date.now();
    
    if (this.config.enableRealTime) {
      this.startRealTimeCollection();
    }
    
    this.isInitialized = true;
    this.logger.info('Metrics collector initialized successfully');
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Shutting down metrics collector');
    
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
    }
    
    // Flush remaining metrics
    if (this.metricsBuffer.length > 0) {
      this.flushMetrics();
    }
    
    this.isInitialized = false;
    this.logger.info('Metrics collector shut down');
  }

  private startRealTimeCollection(): void {
    this.collectInterval = setInterval(async () => {
      try {
        await this.collectAllMetrics();
      } catch (error) {
        this.logger.error('Error collecting metrics', { error });
      }
    }, this.config.interval);
  }

  private async collectAllMetrics(): Promise<void> {
    const [resourceMetrics, cacheMetrics, appMetrics] = await Promise.all([
      this.collectResourceMetrics(),
      this.collectCacheMetrics(),
      this.collectApplicationMetrics()
    ]);

    const aggregatedMetrics = {
      timestamp: Date.now(),
      resource: resourceMetrics,
      cache: cacheMetrics,
      application: appMetrics
    };

    this.bufferMetrics(aggregatedMetrics);
    this.emit('metrics', aggregatedMetrics);
  }

  public async collectResourceMetrics(): Promise<ResourceMetrics> {
    const startTime = performance.now();
    
    // CPU usage
    const cpuUsage = await this.getCPUUsage();
    
    // Memory usage
    const memInfo = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = (totalMemory - freeMemory) / totalMemory;
    
    // Network and disk are more complex to measure
    // For now, we'll provide estimates or placeholders
    const networkLatency = await this.measureNetworkLatency();
    const diskUsage = await this.getDiskUsage();
    
    const metrics: ResourceMetrics = {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: networkLatency,
      timestamp: Date.now()
    };

    this.logger.debug('Resource metrics collected', {
      duration: performance.now() - startTime,
      metrics
    });

    return metrics;
  }

  public async collectCacheMetrics(): Promise<CacheMetrics> {
    // This would integrate with your actual cache implementation
    // For now, we'll simulate metrics
    const timestamp = Date.now();
    
    // Simulate cache statistics
    const totalRequests = this.getRandomBetween(1000, 5000);
    const hitRate = this.getRandomBetween(0.7, 0.95);
    const totalHits = Math.floor(totalRequests * hitRate);
    const totalMisses = totalRequests - totalHits;
    
    const metrics: CacheMetrics = {
      hitRate,
      memoryUsage: this.getRandomBetween(50, 200) * 1024 * 1024, // MB to bytes
      evictionRate: this.getRandomBetween(0.01, 0.05),
      totalRequests,
      totalHits,
      totalMisses,
      timestamp
    };

    return metrics;
  }

  public async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    const timestamp = Date.now();
    
    // Get request metrics from tracking
    const requestTimes = Array.from(this.requestMetrics.values()).flat();
    const averageResponseTime = requestTimes.length > 0 
      ? requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length
      : 0;

    const metrics: ApplicationMetrics = {
      requestCount: requestTimes.length,
      errorCount: 0, // Would be tracked separately
      averageResponseTime,
      activeConnections: this.getRandomBetween(10, 100),
      queueLength: this.getRandomBetween(0, 50),
      timestamp
    };

    // Clear request metrics after collection
    this.requestMetrics.clear();

    return metrics;
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = performance.now();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const timeDiff = performance.now() - startTime;
        
        // Calculate CPU usage percentage
        const totalUsage = currentUsage.user + currentUsage.system;
        const cpuPercent = (totalUsage / 1000) / timeDiff;
        
        resolve(Math.min(1, cpuPercent)); // Cap at 100%
      }, 100);
    });
  }

  private async measureNetworkLatency(): Promise<number> {
    // Simplified network latency measurement
    // In a real implementation, you might ping specific endpoints
    return this.getRandomBetween(10, 100); // ms
  }

  private async getDiskUsage(): Promise<number> {
    // Simplified disk usage measurement
    // In a real implementation, you would check actual disk statistics
    return this.getRandomBetween(0.3, 0.8); // 30-80% usage
  }

  private bufferMetrics(metrics: any): void {
    this.metricsBuffer.push(metrics);
    
    if (this.metricsBuffer.length >= this.config.batchSize) {
      this.flushMetrics();
    }
  }

  private flushMetrics(): void {
    if (this.metricsBuffer.length === 0) return;

    const batch = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    this.emit('batch', batch);
    
    this.logger.debug('Metrics batch flushed', { 
      batchSize: batch.length 
    });
  }

  // Performance tracking methods
  public markPerformanceStart(operation: string): void {
    this.performanceMarks.set(operation, performance.now());
  }

  public markPerformanceEnd(operation: string): number {
    const startTime = this.performanceMarks.get(operation);
    if (!startTime) {
      this.logger.warn('Performance mark not found', { operation });
      return 0;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(operation);
    
    // Store for aggregation
    if (!this.requestMetrics.has(operation)) {
      this.requestMetrics.set(operation, []);
    }
    this.requestMetrics.get(operation)!.push(duration);
    
    return duration;
  }

  public trackRequest(requestId: string, responseTime: number): void {
    if (!this.requestMetrics.has('requests')) {
      this.requestMetrics.set('requests', []);
    }
    this.requestMetrics.get('requests')!.push(responseTime);
  }

  public getMetricsSummary(): any {
    const now = Date.now();
    const timeSinceLastCollection = now - this.lastCollectionTime;
    
    return {
      isHealthy: this.isInitialized,
      timeSinceLastCollection,
      bufferedMetrics: this.metricsBuffer.length,
      activeOperations: this.performanceMarks.size,
      trackedRequestTypes: this.requestMetrics.size
    };
  }

  // Utility methods
  private getRandomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  public calculateMetricsDelta(current: ResourceMetrics, baseline?: ResourceMetrics): any {
    const base = baseline || this.baselineMetrics;
    if (!base) return null;

    return {
      cpu: current.cpu - base.cpu,
      memory: current.memory - base.memory,
      disk: current.disk - base.disk,
      network: current.network - base.network,
      timestamp: current.timestamp
    };
  }

  public detectAnomalies(metrics: ResourceMetrics): any[] {
    const anomalies: any[] = [];
    
    if (metrics.cpu > 0.9) {
      anomalies.push({
        type: 'high_cpu',
        severity: 'high',
        value: metrics.cpu,
        threshold: 0.9
      });
    }
    
    if (metrics.memory > 0.85) {
      anomalies.push({
        type: 'high_memory',
        severity: 'high',
        value: metrics.memory,
        threshold: 0.85
      });
    }
    
    if (metrics.network > 1000) {
      anomalies.push({
        type: 'high_latency',
        severity: 'medium',
        value: metrics.network,
        threshold: 1000
      });
    }
    
    return anomalies;
  }
}