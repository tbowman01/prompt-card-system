import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { OptimizationMetrics } from './ContinuousOptimizationMonitor';

export interface DashboardConfig {
  refreshInterval: number;
  retentionPeriod: number;
  maxDataPoints: number;
  enableRealTime: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'alert' | 'table' | 'gauge' | 'heatmap';
  title: string;
  description: string;
  dataSource: string;
  configuration: any;
  position: { x: number; y: number; width: number; height: number };
  refreshRate: number;
}

export interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  filters: any[];
  timeRange: { start: number; end: number };
}

export class DashboardManager extends EventEmitter {
  private logger = Logger.getInstance();
  private isInitialized = false;
  private currentMetrics?: OptimizationMetrics;
  private metricsHistory: OptimizationMetrics[] = [];
  
  // Dashboard layouts for different views
  private dashboardLayouts = new Map<string, DashboardLayout>();
  
  // Real-time connections
  private realtimeConnections = new Set<any>();
  
  private config: DashboardConfig = {
    refreshInterval: 5000, // 5 seconds
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxDataPoints: 10000,
    enableRealTime: true
  };

  constructor(config?: Partial<DashboardConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing dashboard manager');
    
    await this.setupDefaultDashboards();
    
    if (this.config.enableRealTime) {
      this.startRealTimeUpdates();
    }
    
    this.isInitialized = true;
    this.logger.info('Dashboard manager initialized successfully');
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Shutting down dashboard manager');
    
    // Close all real-time connections
    this.realtimeConnections.clear();
    
    this.isInitialized = false;
    this.logger.info('Dashboard manager shut down');
  }

  private async setupDefaultDashboards(): Promise<void> {
    // System Overview Dashboard
    const systemOverview: DashboardLayout = {
      id: 'system-overview',
      name: 'System Overview',
      description: 'High-level system performance and health metrics',
      widgets: [
        {
          id: 'response-time-gauge',
          type: 'gauge',
          title: 'Response Time',
          description: 'Average response time in milliseconds',
          dataSource: 'metrics.responseTime',
          configuration: {
            min: 0,
            max: 2000,
            thresholds: [
              { value: 500, color: 'green' },
              { value: 1000, color: 'yellow' },
              { value: 2000, color: 'red' }
            ]
          },
          position: { x: 0, y: 0, width: 6, height: 4 },
          refreshRate: 5000
        },
        {
          id: 'availability-gauge',
          type: 'gauge',
          title: 'Availability',
          description: 'System availability percentage',
          dataSource: 'metrics.availability',
          configuration: {
            min: 0.95,
            max: 1.0,
            format: 'percentage',
            thresholds: [
              { value: 0.99, color: 'green' },
              { value: 0.97, color: 'yellow' },
              { value: 0.95, color: 'red' }
            ]
          },
          position: { x: 6, y: 0, width: 6, height: 4 },
          refreshRate: 5000
        },
        {
          id: 'throughput-chart',
          type: 'chart',
          title: 'Throughput Trends',
          description: 'Requests per second over time',
          dataSource: 'metrics.throughput',
          configuration: {
            chartType: 'line',
            timeWindow: '1h',
            aggregation: 'average'
          },
          position: { x: 0, y: 4, width: 12, height: 6 },
          refreshRate: 10000
        },
        {
          id: 'error-rate-chart',
          type: 'chart',
          title: 'Error Rate',
          description: 'Error rate percentage over time',
          dataSource: 'metrics.errorRate',
          configuration: {
            chartType: 'area',
            timeWindow: '1h',
            format: 'percentage'
          },
          position: { x: 0, y: 10, width: 12, height: 6 },
          refreshRate: 10000
        }
      ],
      filters: [],
      timeRange: { start: Date.now() - 3600000, end: Date.now() }
    };

    // Performance Deep Dive Dashboard
    const performanceDeepDive: DashboardLayout = {
      id: 'performance-deep-dive',
      name: 'Performance Deep Dive',
      description: 'Detailed performance analysis and optimization metrics',
      widgets: [
        {
          id: 'response-time-percentiles',
          type: 'chart',
          title: 'Response Time Percentiles',
          description: 'P50, P95, P99 response times',
          dataSource: 'metrics.responseTimePercentiles',
          configuration: {
            chartType: 'multi-line',
            series: ['p50', 'p95', 'p99'],
            timeWindow: '4h'
          },
          position: { x: 0, y: 0, width: 12, height: 6 },
          refreshRate: 15000
        },
        {
          id: 'cache-performance',
          type: 'chart',
          title: 'Cache Performance',
          description: 'Cache hit rate and memory usage',
          dataSource: 'metrics.cache',
          configuration: {
            chartType: 'dual-axis',
            leftAxis: 'cacheHitRate',
            rightAxis: 'cacheMemoryUsage'
          },
          position: { x: 0, y: 6, width: 6, height: 6 },
          refreshRate: 10000
        },
        {
          id: 'resource-utilization',
          type: 'heatmap',
          title: 'Resource Utilization',
          description: 'CPU, Memory, Disk utilization heatmap',
          dataSource: 'metrics.resources',
          configuration: {
            metrics: ['cpuUtilization', 'memoryUtilization', 'diskUtilization'],
            timeWindow: '2h'
          },
          position: { x: 6, y: 6, width: 6, height: 6 },
          refreshRate: 20000
        }
      ],
      filters: [],
      timeRange: { start: Date.now() - 14400000, end: Date.now() }
    };

    // ML Models Dashboard
    const mlModelsDashboard: DashboardLayout = {
      id: 'ml-models',
      name: 'ML Models Performance',
      description: 'Machine learning model performance and optimization tracking',
      widgets: [
        {
          id: 'model-accuracy',
          type: 'gauge',
          title: 'Model Accuracy',
          description: 'Current model accuracy percentage',
          dataSource: 'metrics.modelAccuracy',
          configuration: {
            min: 0.7,
            max: 1.0,
            format: 'percentage'
          },
          position: { x: 0, y: 0, width: 4, height: 4 },
          refreshRate: 30000
        },
        {
          id: 'prediction-latency',
          type: 'gauge',
          title: 'Prediction Latency',
          description: 'Average ML prediction latency',
          dataSource: 'metrics.predictionLatency',
          configuration: {
            min: 0,
            max: 500,
            unit: 'ms'
          },
          position: { x: 4, y: 0, width: 4, height: 4 },
          refreshRate: 30000
        },
        {
          id: 'model-drift',
          type: 'gauge',
          title: 'Model Drift',
          description: 'Model drift detection score',
          dataSource: 'metrics.modelDrift',
          configuration: {
            min: 0,
            max: 1.0,
            thresholds: [
              { value: 0.3, color: 'green' },
              { value: 0.6, color: 'yellow' },
              { value: 1.0, color: 'red' }
            ]
          },
          position: { x: 8, y: 0, width: 4, height: 4 },
          refreshRate: 30000
        },
        {
          id: 'model-performance-trends',
          type: 'chart',
          title: 'Model Performance Trends',
          description: 'Accuracy and drift trends over time',
          dataSource: 'metrics.mlTrends',
          configuration: {
            chartType: 'dual-axis',
            leftAxis: 'accuracy',
            rightAxis: 'drift',
            timeWindow: '24h'
          },
          position: { x: 0, y: 4, width: 12, height: 8 },
          refreshRate: 60000
        }
      ],
      filters: [],
      timeRange: { start: Date.now() - 86400000, end: Date.now() }
    };

    // Cost Optimization Dashboard
    const costOptimizationDashboard: DashboardLayout = {
      id: 'cost-optimization',
      name: 'Cost Optimization',
      description: 'Cost tracking and optimization recommendations',
      widgets: [
        {
          id: 'cost-per-transaction',
          type: 'metric',
          title: 'Cost per Transaction',
          description: 'Average cost per transaction',
          dataSource: 'metrics.costPerTransaction',
          configuration: {
            format: 'currency',
            precision: 4
          },
          position: { x: 0, y: 0, width: 3, height: 2 },
          refreshRate: 60000
        },
        {
          id: 'revenue-impact',
          type: 'metric',
          title: 'Revenue Impact',
          description: 'Performance impact on revenue',
          dataSource: 'metrics.revenueImpact',
          configuration: {
            format: 'currency',
            showTrend: true
          },
          position: { x: 3, y: 0, width: 3, height: 2 },
          refreshRate: 60000
        },
        {
          id: 'optimization-savings',
          type: 'metric',
          title: 'Optimization Savings',
          description: 'Savings from applied optimizations',
          dataSource: 'calculated.optimizationSavings',
          configuration: {
            format: 'currency',
            showPercentage: true
          },
          position: { x: 6, y: 0, width: 3, height: 2 },
          refreshRate: 60000
        },
        {
          id: 'roi-gauge',
          type: 'gauge',
          title: 'Optimization ROI',
          description: 'Return on investment for optimizations',
          dataSource: 'calculated.roi',
          configuration: {
            min: 0,
            max: 500,
            format: 'percentage'
          },
          position: { x: 9, y: 0, width: 3, height: 2 },
          refreshRate: 60000
        },
        {
          id: 'cost-breakdown',
          type: 'chart',
          title: 'Cost Breakdown',
          description: 'Cost distribution by component',
          dataSource: 'metrics.costBreakdown',
          configuration: {
            chartType: 'pie',
            categories: ['compute', 'storage', 'network', 'ml']
          },
          position: { x: 0, y: 2, width: 6, height: 6 },
          refreshRate: 300000
        },
        {
          id: 'cost-trends',
          type: 'chart',
          title: 'Cost Trends',
          description: 'Cost trends over time',
          dataSource: 'metrics.costTrends',
          configuration: {
            chartType: 'area',
            timeWindow: '7d',
            aggregation: 'daily'
          },
          position: { x: 6, y: 2, width: 6, height: 6 },
          refreshRate: 300000
        }
      ],
      filters: [],
      timeRange: { start: Date.now() - 7 * 86400000, end: Date.now() }
    };

    // Edge Performance Dashboard
    const edgePerformanceDashboard: DashboardLayout = {
      id: 'edge-performance',
      name: 'Edge Performance',
      description: 'Geographic performance and edge optimization metrics',
      widgets: [
        {
          id: 'global-latency-map',
          type: 'heatmap',
          title: 'Global Latency Map',
          description: 'Latency by geographic region',
          dataSource: 'metrics.edgeLatency',
          configuration: {
            mapType: 'world',
            metric: 'latency',
            colorScale: 'green-red'
          },
          position: { x: 0, y: 0, width: 12, height: 8 },
          refreshRate: 30000
        },
        {
          id: 'edge-availability',
          type: 'table',
          title: 'Edge Node Availability',
          description: 'Availability by edge location',
          dataSource: 'metrics.edgeAvailability',
          configuration: {
            columns: ['region', 'availability', 'latency', 'load'],
            sortBy: 'availability',
            sortOrder: 'desc'
          },
          position: { x: 0, y: 8, width: 6, height: 6 },
          refreshRate: 60000
        },
        {
          id: 'data-transfer-costs',
          type: 'chart',
          title: 'Data Transfer Costs',
          description: 'Data transfer costs by region',
          dataSource: 'metrics.dataTransferCost',
          configuration: {
            chartType: 'bar',
            groupBy: 'region',
            timeWindow: '24h'
          },
          position: { x: 6, y: 8, width: 6, height: 6 },
          refreshRate: 60000
        }
      ],
      filters: [],
      timeRange: { start: Date.now() - 86400000, end: Date.now() }
    };

    // Store all dashboards
    this.dashboardLayouts.set('system-overview', systemOverview);
    this.dashboardLayouts.set('performance-deep-dive', performanceDeepDive);
    this.dashboardLayouts.set('ml-models', mlModelsDashboard);
    this.dashboardLayouts.set('cost-optimization', costOptimizationDashboard);
    this.dashboardLayouts.set('edge-performance', edgePerformanceDashboard);

    this.logger.info('Default dashboards created', { 
      count: this.dashboardLayouts.size 
    });
  }

  public async updateMetrics(metrics: OptimizationMetrics): Promise<void> {
    this.currentMetrics = metrics;
    this.metricsHistory.push(metrics);
    
    // Cleanup old metrics
    this.cleanupMetricsHistory();
    
    // Broadcast to real-time connections
    if (this.config.enableRealTime) {
      this.broadcastMetricsUpdate(metrics);
    }
    
    this.emit('metrics-updated', metrics);
  }

  private startRealTimeUpdates(): void {
    setInterval(() => {
      if (this.currentMetrics) {
        this.broadcastMetricsUpdate(this.currentMetrics);
      }
    }, this.config.refreshInterval);
  }

  private broadcastMetricsUpdate(metrics: OptimizationMetrics): void {
    const updateData = {
      type: 'metrics-update',
      timestamp: Date.now(),
      data: metrics
    };

    this.realtimeConnections.forEach(connection => {
      try {
        // This would send data via WebSocket in a real implementation
        connection.send(JSON.stringify(updateData));
      } catch (error) {
        this.logger.warn('Failed to send real-time update', { error });
        this.realtimeConnections.delete(connection);
      }
    });
  }

  public getDashboard(dashboardId: string): DashboardLayout | undefined {
    return this.dashboardLayouts.get(dashboardId);
  }

  public getAllDashboards(): DashboardLayout[] {
    return Array.from(this.dashboardLayouts.values());
  }

  public async getWidgetData(dashboardId: string, widgetId: string, timeRange?: { start: number; end: number }): Promise<any> {
    const dashboard = this.dashboardLayouts.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) {
      throw new Error(`Widget not found: ${widgetId}`);
    }

    const range = timeRange || dashboard.timeRange;
    const relevantMetrics = this.metricsHistory.filter(m => 
      m.timestamp >= range.start && m.timestamp <= range.end
    );

    return this.processWidgetData(widget, relevantMetrics);
  }

  private processWidgetData(widget: DashboardWidget, metrics: OptimizationMetrics[]): any {
    const dataSource = widget.dataSource;
    
    switch (widget.type) {
      case 'gauge':
        return this.processGaugeData(dataSource, metrics);
      case 'chart':
        return this.processChartData(dataSource, metrics, widget.configuration);
      case 'metric':
        return this.processMetricData(dataSource, metrics);
      case 'table':
        return this.processTableData(dataSource, metrics, widget.configuration);
      case 'heatmap':
        return this.processHeatmapData(dataSource, metrics, widget.configuration);
      default:
        return { value: null, timestamp: Date.now() };
    }
  }

  private processGaugeData(dataSource: string, metrics: OptimizationMetrics[]): any {
    if (metrics.length === 0) return { value: 0, timestamp: Date.now() };
    
    const latest = metrics[metrics.length - 1];
    const value = this.extractMetricValue(dataSource, latest);
    
    return {
      value,
      timestamp: latest.timestamp,
      trend: metrics.length > 1 ? this.calculateTrend(dataSource, metrics.slice(-10)) : 0
    };
  }

  private processChartData(dataSource: string, metrics: OptimizationMetrics[], config: any): any {
    const points = metrics.map(m => ({
      timestamp: m.timestamp,
      value: this.extractMetricValue(dataSource, m)
    }));

    return {
      points,
      aggregation: config.aggregation || 'none',
      chartType: config.chartType || 'line',
      timeWindow: config.timeWindow || '1h'
    };
  }

  private processMetricData(dataSource: string, metrics: OptimizationMetrics[]): any {
    if (metrics.length === 0) return { value: 0, timestamp: Date.now() };
    
    const latest = metrics[metrics.length - 1];
    const value = this.extractMetricValue(dataSource, latest);
    const previousValue = metrics.length > 1 ? 
      this.extractMetricValue(dataSource, metrics[metrics.length - 2]) : value;
    
    return {
      value,
      previousValue,
      change: value - previousValue,
      changePercent: previousValue !== 0 ? ((value - previousValue) / previousValue) * 100 : 0,
      timestamp: latest.timestamp
    };
  }

  private processTableData(dataSource: string, metrics: OptimizationMetrics[], config: any): any {
    // For table data, we typically show the latest data structured as rows
    if (metrics.length === 0) return { rows: [] };
    
    const latest = metrics[metrics.length - 1];
    const data = this.extractMetricValue(dataSource, latest);
    
    if (typeof data === 'object' && data !== null) {
      const rows = Object.entries(data).map(([key, value]) => ({
        key,
        value,
        timestamp: latest.timestamp
      }));
      
      return {
        rows,
        columns: config.columns || ['key', 'value'],
        sortBy: config.sortBy,
        sortOrder: config.sortOrder || 'asc'
      };
    }
    
    return { rows: [] };
  }

  private processHeatmapData(dataSource: string, metrics: OptimizationMetrics[], config: any): any {
    const timeWindow = config.timeWindow || '1h';
    const windowMs = this.parseTimeWindow(timeWindow);
    const relevantMetrics = metrics.filter(m => 
      Date.now() - m.timestamp <= windowMs
    );
    
    const heatmapData = relevantMetrics.map(m => {
      const value = this.extractMetricValue(dataSource, m);
      return {
        timestamp: m.timestamp,
        data: value
      };
    });
    
    return {
      data: heatmapData,
      metrics: config.metrics || [],
      timeWindow,
      colorScale: config.colorScale || 'blue-red'
    };
  }

  private extractMetricValue(dataSource: string, metrics: OptimizationMetrics): any {
    const path = dataSource.split('.');
    let value: any = metrics;
    
    for (const part of path) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }
    
    return value;
  }

  private calculateTrend(dataSource: string, metrics: OptimizationMetrics[]): number {
    if (metrics.length < 2) return 0;
    
    const values = metrics.map(m => this.extractMetricValue(dataSource, m)).filter(v => v !== null);
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    
    return first !== 0 ? ((last - first) / first) * 100 : 0;
  }

  private parseTimeWindow(timeWindow: string): number {
    const unit = timeWindow.slice(-1);
    const value = parseInt(timeWindow.slice(0, -1));
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000; // Default to 1 hour
    }
  }

  private cleanupMetricsHistory(): void {
    const maxAge = Date.now() - this.config.retentionPeriod;
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > maxAge);
    
    if (this.metricsHistory.length > this.config.maxDataPoints) {
      this.metricsHistory = this.metricsHistory.slice(-this.config.maxDataPoints);
    }
  }

  public addRealtimeConnection(connection: any): void {
    this.realtimeConnections.add(connection);
    
    // Send current metrics immediately
    if (this.currentMetrics) {
      try {
        connection.send(JSON.stringify({
          type: 'initial-data',
          data: this.currentMetrics
        }));
      } catch (error) {
        this.logger.warn('Failed to send initial data', { error });
      }
    }
  }

  public removeRealtimeConnection(connection: any): void {
    this.realtimeConnections.delete(connection);
  }

  public getMetricsHistory(limit?: number): OptimizationMetrics[] {
    return limit ? this.metricsHistory.slice(-limit) : this.metricsHistory;
  }

  public getCurrentMetrics(): OptimizationMetrics | undefined {
    return this.currentMetrics;
  }

  public getDashboardSummary(): any {
    return {
      totalDashboards: this.dashboardLayouts.size,
      availableDashboards: Array.from(this.dashboardLayouts.keys()),
      realtimeConnections: this.realtimeConnections.size,
      metricsHistorySize: this.metricsHistory.length,
      lastUpdate: this.currentMetrics?.timestamp
    };
  }
}