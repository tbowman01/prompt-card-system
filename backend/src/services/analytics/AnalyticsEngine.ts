import { EventStore, AnalyticsEvent } from './EventStore';
import { initializeDatabase } from '../../database/connection';
import { Database } from 'better-sqlite3';
import { LRUCache } from 'lru-cache';
import { performance } from 'perf_hooks';

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'rate';
  description: string;
  unit?: string;
  labels?: string[];
}

export interface AnalyticsInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'comparison' | 'prediction';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  timestamp: Date;
  recommendations?: string[];
}

export interface MetricValue {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface DashboardMetrics {
  realtime: {
    activeTests: number;
    testsPerSecond: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
  };
  historical: {
    totalTests: number;
    totalExecutions: number;
    overallSuccessRate: number;
    averageExecutionTime: number;
    mostUsedModels: Array<{ model: string; count: number }>;
  };
  trends: {
    testsOverTime: Array<{ timestamp: Date; count: number }>;
    successRateOverTime: Array<{ timestamp: Date; rate: number }>;
    performanceOverTime: Array<{ timestamp: Date; avgTime: number }>;
  };
  insights: AnalyticsInsight[];
}

export class AnalyticsEngine {
  private eventStore: EventStore;
  private db: Database;
  private static instance: AnalyticsEngine;
  private queryCache: LRUCache<string, any>;
  private preparedStatements: Map<string, any>;
  private performanceMetrics: Map<string, number[]>;

  private constructor() {
    this.eventStore = EventStore.getInstance();
    this.db = initializeDatabase();
    
    // Initialize performance optimizations
    this.queryCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5 // 5 minutes cache
    });
    
    this.preparedStatements = new Map();
    this.performanceMetrics = new Map();
    
    // Pre-compile frequently used queries
    this.prepareOptimizedQueries();
    
    // Set up database optimizations
    this.optimizeDatabase();
  }

  public static getInstance(): AnalyticsEngine {
    if (!AnalyticsEngine.instance) {
      AnalyticsEngine.instance = new AnalyticsEngine();
    }
    return AnalyticsEngine.instance;
  }

  // Event recording methods
  public async recordTestExecution(
    testCaseId: string,
    executionId: string,
    model: string,
    passed: boolean,
    executionTime: number,
    metadata: any = {}
  ): Promise<void> {
    await this.eventStore.recordEvent({
      event_type: 'test_execution',
      entity_id: testCaseId,
      entity_type: 'test_case',
      data: {
        execution_id: executionId,
        model,
        passed,
        execution_time: executionTime,
        ...metadata
      },
      timestamp: new Date(),
      session_id: executionId
    });
  }

  public async recordBatchExecution(
    promptCardId: string,
    executionId: string,
    model: string,
    totalTests: number,
    passedTests: number,
    executionTime: number,
    metadata: any = {}
  ): Promise<void> {
    await this.eventStore.recordEvent({
      event_type: 'batch_execution',
      entity_id: promptCardId,
      entity_type: 'prompt_card',
      data: {
        execution_id: executionId,
        model,
        total_tests: totalTests,
        passed_tests: passedTests,
        failed_tests: totalTests - passedTests,
        execution_time: executionTime,
        success_rate: passedTests / totalTests,
        ...metadata
      },
      timestamp: new Date(),
      session_id: executionId
    });
  }

  public async recordModelUsage(
    model: string,
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost?: number;
    }
  ): Promise<void> {
    await this.eventStore.recordEvent({
      event_type: 'model_usage',
      entity_id: model,
      entity_type: 'model',
      data: usage,
      timestamp: new Date()
    });
  }

  public async recordSystemMetrics(
    metrics: {
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      networkLatency: number;
      queueSize: number;
    }
  ): Promise<void> {
    await this.eventStore.recordEvent({
      event_type: 'system_metrics',
      entity_id: 'system',
      entity_type: 'system',
      data: metrics,
      timestamp: new Date()
    });
  }

  // Metrics calculation methods
  public async calculateRealtimeMetrics(): Promise<DashboardMetrics['realtime']> {
    const cacheKey = 'realtime_metrics';
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const startTime = performance.now();
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Get recent test executions
    const recentTests = await this.eventStore.getEvents({
      event_type: 'test_execution',
      start_time: oneMinuteAgo,
      end_time: now
    });

    // Get currently running tests from database
    const activeTestsQuery = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM test_results
      WHERE created_at >= datetime('now', '-5 minutes')
      AND execution_id NOT IN (
        SELECT DISTINCT execution_id 
        FROM test_results 
        WHERE created_at >= datetime('now', '-5 minutes')
        GROUP BY execution_id
        HAVING COUNT(*) > 1
      )
    `);
    const activeTests = activeTestsQuery.get()?.count || 0;

    const testsPerSecond = recentTests.length / 60;
    const passedTests = recentTests.filter(t => t.data.passed).length;
    const successRate = recentTests.length > 0 ? passedTests / recentTests.length : 0;
    const averageResponseTime = recentTests.length > 0 
      ? recentTests.reduce((sum, t) => sum + t.data.execution_time, 0) / recentTests.length 
      : 0;
    const errorRate = 1 - successRate;

    const result = {
      activeTests,
      testsPerSecond,
      successRate,
      averageResponseTime,
      errorRate
    };
    
    // Cache result with shorter TTL for real-time data
    this.queryCache.set(cacheKey, result, { ttl: 1000 * 30 }); // 30 seconds
    
    // Track performance
    const executionTime = performance.now() - startTime;
    this.trackQueryPerformance('calculateRealtimeMetrics', executionTime);
    
    return result;
  }

  public async calculateHistoricalMetrics(): Promise<DashboardMetrics['historical']> {
    const cacheKey = 'historical_metrics';
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const startTime = performance.now();
    // Get total tests from database
    const totalTestsQuery = this.db.prepare(`SELECT COUNT(*) as count FROM test_results`);
    const totalTests = totalTestsQuery.get()?.count || 0;

    // Get total executions (unique execution_ids)
    const totalExecutionsQuery = this.db.prepare(`
      SELECT COUNT(DISTINCT execution_id) as count FROM test_results
    `);
    const totalExecutions = totalExecutionsQuery.get()?.count || 0;

    // Get overall success rate
    const successRateQuery = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed
      FROM test_results
    `);
    const successData = successRateQuery.get();
    const overallSuccessRate = successData && successData.total > 0 
      ? successData.passed / successData.total 
      : 0;

    // Get average execution time
    const avgTimeQuery = this.db.prepare(`
      SELECT AVG(execution_time_ms) as avg_time FROM test_results
    `);
    const avgTime = avgTimeQuery.get()?.avg_time || 0;

    // Get most used models from events
    const modelUsageEvents = await this.eventStore.getEvents({
      event_type: 'test_execution',
      limit: 10000
    });

    const modelCounts = modelUsageEvents.reduce((acc, event) => {
      const model = event.data.model;
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedModels = Object.entries(modelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([model, count]) => ({ model, count }));

    const result = {
      totalTests,
      totalExecutions,
      overallSuccessRate,
      averageExecutionTime: avgTime,
      mostUsedModels
    };
    
    // Cache result with longer TTL for historical data
    this.queryCache.set(cacheKey, result, { ttl: 1000 * 60 * 10 }); // 10 minutes
    
    // Track performance
    const executionTime = performance.now() - startTime;
    this.trackQueryPerformance('calculateHistoricalMetrics', executionTime);
    
    return result;
  }

  public async calculateTrends(
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    limit: number = 30
  ): Promise<DashboardMetrics['trends']> {
    const cacheKey = `trends_${period}_${limit}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const startTime = performance.now();
    const now = new Date();
    const startTime = new Date();
    
    switch (period) {
      case 'hour':
        startTime.setHours(now.getHours() - limit);
        break;
      case 'day':
        startTime.setDate(now.getDate() - limit);
        break;
      case 'week':
        startTime.setDate(now.getDate() - (limit * 7));
        break;
      case 'month':
        startTime.setMonth(now.getMonth() - limit);
        break;
    }

    // Get test execution events for the period
    const events = await this.eventStore.getEvents({
      event_type: 'test_execution',
      start_time: startTime,
      end_time: now
    });

    // Group events by time period
    const timeGroups = this.groupEventsByTime(events, period);

    const testsOverTime = timeGroups.map(group => ({
      timestamp: group.timestamp,
      count: group.events.length
    }));

    const successRateOverTime = timeGroups.map(group => ({
      timestamp: group.timestamp,
      rate: group.events.length > 0 
        ? group.events.filter(e => e.data.passed).length / group.events.length 
        : 0
    }));

    const performanceOverTime = timeGroups.map(group => ({
      timestamp: group.timestamp,
      avgTime: group.events.length > 0
        ? group.events.reduce((sum, e) => sum + e.data.execution_time, 0) / group.events.length
        : 0
    }));

    const result = {
      testsOverTime,
      successRateOverTime,
      performanceOverTime
    };
    
    // Cache result with appropriate TTL based on period
    const ttl = period === 'hour' ? 1000 * 60 * 5 : 1000 * 60 * 30; // 5 or 30 minutes
    this.queryCache.set(cacheKey, result, { ttl });
    
    // Track performance
    const executionTime = performance.now() - startTime;
    this.trackQueryPerformance('calculateTrends', executionTime);
    
    return result;
  }

  public async generateInsights(): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Performance insight
    const recentPerformance = await this.calculateTrends('hour', 24);
    const avgPerformance = recentPerformance.performanceOverTime
      .reduce((sum, p) => sum + p.avgTime, 0) / recentPerformance.performanceOverTime.length;
    
    if (avgPerformance > 5000) { // 5 seconds
      insights.push({
        id: 'performance_degradation',
        type: 'anomaly',
        title: 'Performance Degradation Detected',
        description: `Average response time has increased to ${avgPerformance.toFixed(0)}ms`,
        severity: 'high',
        data: { avgPerformance },
        timestamp: new Date(),
        recommendations: [
          'Check system resources',
          'Optimize slow queries',
          'Consider scaling infrastructure'
        ]
      });
    }

    // Success rate insight
    const recentSuccess = await this.calculateTrends('hour', 24);
    const avgSuccessRate = recentSuccess.successRateOverTime
      .reduce((sum, s) => sum + s.rate, 0) / recentSuccess.successRateOverTime.length;
    
    if (avgSuccessRate < 0.8) { // Less than 80% success rate
      insights.push({
        id: 'low_success_rate',
        type: 'anomaly',
        title: 'Low Success Rate Detected',
        description: `Test success rate has dropped to ${(avgSuccessRate * 100).toFixed(1)}%`,
        severity: 'critical',
        data: { avgSuccessRate },
        timestamp: new Date(),
        recommendations: [
          'Review failing test cases',
          'Check assertion logic',
          'Validate model configurations'
        ]
      });
    }

    // Usage trend insight
    const usageTrend = await this.calculateTrends('day', 7);
    const recentUsage = usageTrend.testsOverTime.slice(-3).reduce((sum, t) => sum + t.count, 0);
    const previousUsage = usageTrend.testsOverTime.slice(-6, -3).reduce((sum, t) => sum + t.count, 0);
    
    if (recentUsage > previousUsage * 1.5) {
      insights.push({
        id: 'usage_spike',
        type: 'trend',
        title: 'Usage Spike Detected',
        description: `Test execution volume has increased by ${((recentUsage / previousUsage - 1) * 100).toFixed(1)}%`,
        severity: 'medium',
        data: { recentUsage, previousUsage },
        timestamp: new Date(),
        recommendations: [
          'Monitor system capacity',
          'Consider auto-scaling',
          'Review resource allocation'
        ]
      });
    }

    return insights;
  }

  public async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [realtime, historical, trends, insights] = await Promise.all([
      this.calculateRealtimeMetrics(),
      this.calculateHistoricalMetrics(),
      this.calculateTrends(),
      this.generateInsights()
    ]);

    return {
      realtime,
      historical,
      trends,
      insights
    };
  }

  private groupEventsByTime(
    events: AnalyticsEvent[],
    period: 'hour' | 'day' | 'week' | 'month'
  ): Array<{ timestamp: Date; events: AnalyticsEvent[] }> {
    const groups = new Map<string, AnalyticsEvent[]>();

    events.forEach(event => {
      const timestamp = new Date(event.timestamp);
      let key: string;

      switch (period) {
        case 'hour':
          key = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}-${timestamp.getHours()}`;
          break;
        case 'day':
          key = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}`;
          break;
        case 'week':
          const weekStart = new Date(timestamp);
          weekStart.setDate(timestamp.getDate() - timestamp.getDay());
          key = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
          break;
        case 'month':
          key = `${timestamp.getFullYear()}-${timestamp.getMonth()}`;
          break;
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    });

    return Array.from(groups.entries())
      .map(([key, events]) => {
        const parts = key.split('-').map(Number);
        let timestamp: Date;
        
        switch (period) {
          case 'hour':
            timestamp = new Date(parts[0], parts[1], parts[2], parts[3]);
            break;
          case 'day':
            timestamp = new Date(parts[0], parts[1], parts[2]);
            break;
          case 'week':
            timestamp = new Date(parts[0], parts[1], parts[2]);
            break;
          case 'month':
            timestamp = new Date(parts[0], parts[1]);
            break;
          default:
            timestamp = new Date();
        }

        return { timestamp, events };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  /**
   * Prepare optimized SQL queries for better performance
   */
  private prepareOptimizedQueries(): void {
    // Optimized query for active tests with indexes
    this.preparedStatements.set('activeTests', this.db.prepare(`
      SELECT COUNT(*) as count
      FROM test_results
      WHERE created_at >= datetime('now', '-5 minutes')
      AND execution_id NOT IN (
        SELECT DISTINCT execution_id 
        FROM test_results 
        WHERE created_at >= datetime('now', '-5 minutes')
        GROUP BY execution_id
        HAVING COUNT(*) > 1
      )
    `));
    
    // Optimized query for total tests with covering index
    this.preparedStatements.set('totalTests', this.db.prepare(`
      SELECT COUNT(*) as count FROM test_results
    `));
    
    // Optimized query for total executions using distinct
    this.preparedStatements.set('totalExecutions', this.db.prepare(`
      SELECT COUNT(DISTINCT execution_id) as count FROM test_results
    `));
    
    // Optimized query for success rate with index hint
    this.preparedStatements.set('successRate', this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed
      FROM test_results
      WHERE created_at >= ?
    `));
    
    // Optimized query for average execution time
    this.preparedStatements.set('avgExecutionTime', this.db.prepare(`
      SELECT AVG(execution_time_ms) as avg_time 
      FROM test_results
      WHERE execution_time_ms > 0
    `));
  }
  
  /**
   * Optimize database settings for performance
   */
  private optimizeDatabase(): void {
    // Set WAL mode for better concurrent performance
    this.db.pragma('journal_mode = WAL');
    
    // Optimize memory usage
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = memory');
    
    // Optimize synchronous mode for better performance
    this.db.pragma('synchronous = NORMAL');
    
    // Enable query planner optimization
    this.db.pragma('optimize');
    
    // Create additional performance indexes
    this.createPerformanceIndexes();
  }
  
  /**
   * Create additional indexes for better query performance
   */
  private createPerformanceIndexes(): void {
    try {
      // Composite index for time-based queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_test_results_created_at_passed 
        ON test_results(created_at, passed);
      `);
      
      // Composite index for execution time analysis
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_test_results_execution_time 
        ON test_results(execution_time_ms, created_at) 
        WHERE execution_time_ms > 0;
      `);
      
      // Index for model performance analysis
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_test_results_model_performance 
        ON test_results(model, passed, execution_time_ms);
      `);
      
      // Covering index for execution ID queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_test_results_execution_id_covering 
        ON test_results(execution_id, created_at, passed);
      `);
      
      console.log('Performance indexes created successfully');
    } catch (error) {
      console.warn('Some performance indexes already exist:', error.message);
    }
  }
  
  /**
   * Track query performance for optimization
   */
  private trackQueryPerformance(queryName: string, executionTime: number): void {
    if (!this.performanceMetrics.has(queryName)) {
      this.performanceMetrics.set(queryName, []);
    }
    
    const metrics = this.performanceMetrics.get(queryName)!;
    metrics.push(executionTime);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    // Log slow queries
    if (executionTime > 100) {
      console.warn(`Slow query detected: ${queryName} took ${executionTime.toFixed(2)}ms`);
    }
  }
  
  /**
   * Get query performance statistics
   */
  public getQueryPerformanceStats(): Record<string, { avg: number; max: number; min: number; count: number }> {
    const stats: Record<string, { avg: number; max: number; min: number; count: number }> = {};
    
    for (const [queryName, metrics] of this.performanceMetrics) {
      if (metrics.length > 0) {
        const avg = metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
        const max = Math.max(...metrics);
        const min = Math.min(...metrics);
        
        stats[queryName] = {
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
   * Clear cache and performance metrics
   */
  public clearCache(): void {
    this.queryCache.clear();
    this.performanceMetrics.clear();
    console.log('Analytics cache and performance metrics cleared');
  }
  
  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; max: number; hitRate: number } {
    return {
      size: this.queryCache.size,
      max: this.queryCache.max,
      hitRate: this.queryCache.calculatedSize > 0 ? 
        (this.queryCache.calculatedSize - this.queryCache.size) / this.queryCache.calculatedSize : 0
    };
  }
}