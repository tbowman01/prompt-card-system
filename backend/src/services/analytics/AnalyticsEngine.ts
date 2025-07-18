import { EventStore, AnalyticsEvent } from './EventStore';
import { initializeDatabase } from '../../database/connection';
import { Database } from 'better-sqlite3';

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

  private constructor() {
    this.eventStore = EventStore.getInstance();
    this.db = initializeDatabase();
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

    return {
      activeTests,
      testsPerSecond,
      successRate,
      averageResponseTime,
      errorRate
    };
  }

  public async calculateHistoricalMetrics(): Promise<DashboardMetrics['historical']> {
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

    return {
      totalTests,
      totalExecutions,
      overallSuccessRate,
      averageExecutionTime: avgTime,
      mostUsedModels
    };
  }

  public async calculateTrends(
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    limit: number = 30
  ): Promise<DashboardMetrics['trends']> {
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

    return {
      testsOverTime,
      successRateOverTime,
      performanceOverTime
    };
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
}