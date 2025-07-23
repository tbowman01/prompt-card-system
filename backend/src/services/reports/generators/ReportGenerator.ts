import { AnalyticsEngine } from '../../analytics/AnalyticsEngine';
import { CostTracker } from '../../CostTracker';
import { 
  ReportData, 
  ReportTemplate, 
  ReportFilters, 
  ReportSection, 
  ReportSummary,
  ChartData,
  TableData,
  MetricData,
  ReportGenerationProgress
} from '../../../types/reports';
import { ReportTemplates } from '../templates/ReportTemplates';
import { Database } from 'better-sqlite3';
import { initializeDatabase } from '../../../database/connection';
import { LRUCache } from 'lru-cache';
import { performance } from 'perf_hooks';

export class ReportGenerator {
  private analyticsEngine: AnalyticsEngine;
  private costTracker: CostTracker;
  private db: any;
  private progressCallbacks: Map<string, (progress: ReportGenerationProgress) => void>;
  private templateCache: LRUCache<string, any>;
  private dataCache: LRUCache<string, any>;
  private performanceMetrics: Map<string, number[]>;

  constructor() {
    this.analyticsEngine = AnalyticsEngine.getInstance();
    this.costTracker = new CostTracker();
    this.initializeDb();
    this.progressCallbacks = new Map();
    
    // Initialize caching for better performance
    this.templateCache = new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 30 // 30 minutes
    });
    
    this.dataCache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 10 // 10 minutes
    });
    
    this.performanceMetrics = new Map();
  }

  private async initializeDb(): Promise<void> {
    this.db = await initializeDatabase();
  }

  async generateReport(
    templateId: string, 
    filters: ReportFilters = {},
    progressCallback?: (progress: ReportGenerationProgress) => void
  ): Promise<ReportData> {
    const startTime = Date.now();
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (progressCallback) {
      this.progressCallbacks.set(reportId, progressCallback);
    }

    try {
      // Get template
      const template = ReportTemplates.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      this.updateProgress(reportId, 'processing', 10, 'Loading template and filters', 6);

      // Generate report sections
      const sections: ReportSection[] = [];
      let currentStep = 1;

      for (const field of template.fields) {
        this.updateProgress(reportId, 'processing', 10 + (currentStep * 70 / template.fields.length), `Generating ${field.label}`, 6);
        
        const section = await this.generateSection(field, filters, template.type);
        if (section) {
          sections.push(section);
        }
        currentStep++;
      }

      this.updateProgress(reportId, 'processing', 85, 'Generating summary', 6);

      // Generate summary
      const summary = await this.generateSummary(sections, filters);

      this.updateProgress(reportId, 'processing', 95, 'Finalizing report', 6);

      // Calculate metadata
      const metadata = await this.calculateMetadata(filters);

      const report: ReportData = {
        id: reportId,
        template,
        title: `${template.name} - ${new Date().toLocaleDateString()}`,
        description: template.description,
        generatedAt: new Date(),
        filters,
        sections,
        summary,
        metadata: {
          ...metadata,
          generationTime: Date.now() - startTime
        }
      };

      this.updateProgress(reportId, 'completed', 100, 'Report generation completed', 6);

      return report;
    } catch (error) {
      this.updateProgress(reportId, 'failed', 0, `Report generation failed: ${error.message}`, 6);
      throw error;
    } finally {
      this.progressCallbacks.delete(reportId);
    }
  }

  private async generateSection(field: any, filters: ReportFilters, templateType: string): Promise<ReportSection | null> {
    const sectionId = `section_${field.key}_${Date.now()}`;
    
    switch (field.type) {
      case 'metric':
        return {
          id: sectionId,
          title: field.label,
          description: field.description,
          type: 'metrics',
          content: await this.generateMetricContent(field, filters),
          order: 1
        };
      
      case 'chart':
        return {
          id: sectionId,
          title: field.label,
          description: field.description,
          type: 'charts',
          content: await this.generateChartContent(field, filters),
          order: 2
        };
      
      case 'table':
        return {
          id: sectionId,
          title: field.label,
          description: field.description,
          type: 'tables',
          content: await this.generateTableContent(field, filters),
          order: 3
        };
      
      case 'insight':
        return {
          id: sectionId,
          title: field.label,
          description: field.description,
          type: 'insights',
          content: await this.generateInsightContent(field, filters),
          order: 4
        };
      
      default:
        return null;
    }
  }

  private async generateMetricContent(field: any, filters: ReportFilters): Promise<MetricData[]> {
    const metrics: MetricData[] = [];
    
    // Get analytics data
    const dashboardMetrics = await this.analyticsEngine.getDashboardMetrics();
    const costSummary = await this.costTracker.getCostSummary(filters.startDate, filters.endDate);

    // Based on field key, generate appropriate metrics
    switch (field.key) {
      case 'overview-metrics':
        metrics.push(
          {
            label: 'Total Tests',
            value: dashboardMetrics.historical.totalTests,
            unit: 'tests',
            status: 'good'
          },
          {
            label: 'Success Rate',
            value: (dashboardMetrics.historical.overallSuccessRate * 100).toFixed(1),
            unit: '%',
            status: dashboardMetrics.historical.overallSuccessRate > 0.8 ? 'good' : 'warning'
          },
          {
            label: 'Total Cost',
            value: costSummary.totalCost.toFixed(2),
            unit: 'USD',
            status: 'good'
          },
          {
            label: 'Avg Response Time',
            value: dashboardMetrics.historical.averageExecutionTime.toFixed(0),
            unit: 'ms',
            status: dashboardMetrics.historical.averageExecutionTime < 2000 ? 'good' : 'warning'
          }
        );
        break;

      case 'cost-overview':
        metrics.push(
          {
            label: 'Total Cost',
            value: costSummary.totalCost.toFixed(2),
            unit: 'USD',
            status: 'good'
          },
          {
            label: 'Total Tokens',
            value: costSummary.totalTokens.toLocaleString(),
            unit: 'tokens',
            status: 'good'
          },
          {
            label: 'Cost per Execution',
            value: costSummary.averageCostPerExecution.toFixed(4),
            unit: 'USD',
            status: 'good'
          },
          {
            label: 'Total Executions',
            value: costSummary.totalExecutions,
            unit: 'executions',
            status: 'good'
          }
        );
        break;

      case 'performance-overview':
        metrics.push(
          {
            label: 'Tests per Second',
            value: dashboardMetrics.realtime.testsPerSecond.toFixed(2),
            unit: 'tps',
            status: 'good'
          },
          {
            label: 'Average Response Time',
            value: dashboardMetrics.realtime.averageResponseTime.toFixed(0),
            unit: 'ms',
            status: dashboardMetrics.realtime.averageResponseTime < 2000 ? 'good' : 'warning'
          },
          {
            label: 'Error Rate',
            value: (dashboardMetrics.realtime.errorRate * 100).toFixed(1),
            unit: '%',
            status: dashboardMetrics.realtime.errorRate < 0.1 ? 'good' : 'warning'
          },
          {
            label: 'Active Tests',
            value: dashboardMetrics.realtime.activeTests,
            unit: 'tests',
            status: 'good'
          }
        );
        break;

      case 'roi-analysis':
        const roi = await this.costTracker.calculateROI(filters.startDate, filters.endDate);
        metrics.push(
          {
            label: 'Success Rate',
            value: roi.successRate.toFixed(1),
            unit: '%',
            status: roi.successRate > 80 ? 'good' : 'warning'
          },
          {
            label: 'Cost per Success',
            value: roi.averageCostPerSuccess.toFixed(4),
            unit: 'USD',
            status: 'good'
          },
          {
            label: 'Cost Efficiency',
            value: roi.costEfficiency.toFixed(2),
            unit: 'successes/USD',
            status: 'good'
          }
        );
        break;

      default:
        // Generic metrics fallback
        metrics.push(
          {
            label: 'Total Tests',
            value: dashboardMetrics.historical.totalTests,
            unit: 'tests',
            status: 'good'
          }
        );
    }

    return metrics;
  }

  private async generateChartContent(field: any, filters: ReportFilters): Promise<ChartData> {
    const dashboardMetrics = await this.analyticsEngine.getDashboardMetrics();
    const costSummary = await this.costTracker.getCostSummary(filters.startDate, filters.endDate);

    switch (field.key) {
      case 'cost-summary':
      case 'cost-by-model':
        return {
          labels: Object.keys(costSummary.costByModel),
          datasets: [{
            label: 'Cost by Model',
            data: Object.values(costSummary.costByModel),
            backgroundColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'
            ],
            borderWidth: 1
          }]
        };

      case 'performance-trends':
        return {
          labels: dashboardMetrics.trends.testsOverTime.map(t => 
            new Date(t.timestamp).toLocaleDateString()
          ),
          datasets: [{
            label: 'Tests Over Time',
            data: dashboardMetrics.trends.testsOverTime.map(t => t.count),
            borderColor: '#36A2EB',
            backgroundColor: 'rgba(54, 162, 235, 0.1)'
          }]
        };

      case 'cost-trends':
        const usageAnalytics = await this.costTracker.getUsageAnalytics(
          filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          filters.endDate || new Date().toISOString()
        );
        return {
          labels: usageAnalytics.costTrend.map(t => new Date(t.date).toLocaleDateString()),
          datasets: [{
            label: 'Daily Cost',
            data: usageAnalytics.costTrend.map(t => t.cost),
            borderColor: '#FF6384',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
          }]
        };

      case 'response-times':
        return {
          labels: dashboardMetrics.trends.performanceOverTime.map(t => 
            new Date(t.timestamp).toLocaleDateString()
          ),
          datasets: [{
            label: 'Average Response Time (ms)',
            data: dashboardMetrics.trends.performanceOverTime.map(t => t.avgTime),
            borderColor: '#FFCE56',
            backgroundColor: 'rgba(255, 206, 86, 0.1)',
          }]
        };

      default:
        return {
          labels: ['No Data'],
          datasets: [{
            label: 'No Data Available',
            data: [0],
            backgroundColor: '#cccccc'
          }]
        };
    }
  }

  private async generateTableContent(field: any, filters: ReportFilters): Promise<TableData> {
    const dashboardMetrics = await this.analyticsEngine.getDashboardMetrics();
    const costSummary = await this.costTracker.getCostSummary(filters.startDate, filters.endDate);

    switch (field.key) {
      case 'model-performance':
        const modelData = dashboardMetrics.historical.mostUsedModels.map(model => [
          model.model,
          model.count,
          costSummary.costByModel[model.model]?.toFixed(4) || '0.0000',
          costSummary.tokensByModel[model.model]?.toLocaleString() || '0',
          (costSummary.costByModel[model.model] / model.count).toFixed(6) || '0.000000'
        ]);

        return {
          headers: ['Model', 'Executions', 'Total Cost (USD)', 'Total Tokens', 'Cost per Execution'],
          rows: modelData,
          totalRows: modelData.length,
          sortable: true
        };

      case 'usage-patterns':
        const usageData = Object.entries(costSummary.costByModel).map(([model, cost]) => [
          model,
          cost.toFixed(4),
          costSummary.tokensByModel[model]?.toLocaleString() || '0',
          costSummary.executionsByModel[model] || 0,
          ((cost / costSummary.totalCost) * 100).toFixed(1) + '%'
        ]);

        return {
          headers: ['Model', 'Cost (USD)', 'Tokens', 'Executions', 'Cost %'],
          rows: usageData,
          totalRows: usageData.length,
          sortable: true
        };

      case 'detailed-results':
        // Get recent test results
        const recentResults = this.db.prepare(`
          SELECT 
            tr.id,
            tr.test_case_id,
            tr.execution_id,
            tr.model,
            tr.passed,
            tr.execution_time_ms,
            tr.created_at,
            ct.cost_usd
          FROM test_results tr
          LEFT JOIN cost_tracking ct ON tr.execution_id = ct.execution_id
          WHERE tr.created_at >= ?
          ORDER BY tr.created_at DESC
          LIMIT 50
        `).all(filters.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const resultData = recentResults.map(result => [
          result.id,
          result.test_case_id,
          result.model,
          result.passed ? 'Pass' : 'Fail',
          result.execution_time_ms + 'ms',
          '$' + (result.cost_usd || 0).toFixed(4),
          new Date(result.created_at).toLocaleString()
        ]);

        return {
          headers: ['ID', 'Test Case', 'Model', 'Status', 'Time', 'Cost', 'Date'],
          rows: resultData,
          totalRows: resultData.length,
          sortable: true,
          pagination: {
            page: 1,
            pageSize: 50,
            totalPages: Math.ceil(resultData.length / 50)
          }
        };

      default:
        return {
          headers: ['No Data'],
          rows: [['No data available']],
          totalRows: 0,
          sortable: false
        };
    }
  }

  private async generateInsightContent(field: any, filters: ReportFilters): Promise<any> {
    const insights = await this.analyticsEngine.generateInsights();
    const costRecommendations = await this.costTracker.generateOptimizationRecommendations(
      filters.startDate, filters.endDate
    );

    switch (field.key) {
      case 'key-insights':
        return {
          insights: insights.map(insight => ({
            title: insight.title,
            description: insight.description,
            severity: insight.severity,
            recommendations: insight.recommendations || []
          })),
          totalInsights: insights.length,
          criticalInsights: insights.filter(i => i.severity === 'critical').length
        };

      case 'cost-optimization':
        return {
          recommendations: costRecommendations.map(rec => ({
            title: rec.title,
            description: rec.description,
            estimatedSavings: rec.estimatedSavings,
            priority: rec.priority,
            actionRequired: rec.actionRequired
          })),
          totalRecommendations: costRecommendations.length,
          totalPotentialSavings: costRecommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0)
        };

      case 'recommendations':
        return {
          performance: insights.filter(i => i.title.toLowerCase().includes('performance')),
          cost: costRecommendations.filter(r => r.priority === 'high'),
          general: insights.filter(i => !i.title.toLowerCase().includes('performance'))
        };

      default:
        return {
          insights: [],
          recommendations: [],
          totalInsights: 0
        };
    }
  }

  private async generateSummary(sections: ReportSection[], filters: ReportFilters): Promise<ReportSummary> {
    const dashboardMetrics = await this.analyticsEngine.getDashboardMetrics();
    const costSummary = await this.costTracker.getCostSummary(filters.startDate, filters.endDate);

    const keyMetrics = [
      {
        label: 'Total Tests',
        value: dashboardMetrics.historical.totalTests,
        trend: 'stable' as const
      },
      {
        label: 'Success Rate',
        value: (dashboardMetrics.historical.overallSuccessRate * 100).toFixed(1) + '%',
        trend: 'up' as const
      },
      {
        label: 'Total Cost',
        value: '$' + costSummary.totalCost.toFixed(2),
        trend: 'stable' as const
      },
      {
        label: 'Avg Response Time',
        value: dashboardMetrics.historical.averageExecutionTime.toFixed(0) + 'ms',
        trend: 'down' as const
      }
    ];

    const insights = await this.analyticsEngine.generateInsights();
    const summaryInsights = insights.map(insight => ({
      title: insight.title,
      description: insight.description,
      severity: insight.severity,
      recommendations: insight.recommendations || []
    }));

    return {
      keyMetrics,
      insights: summaryInsights,
      generationTime: Date.now() - Date.now() // Will be set correctly by caller
    };
  }

  private async calculateMetadata(filters: ReportFilters): Promise<any> {
    const dashboardMetrics = await this.analyticsEngine.getDashboardMetrics();
    const costSummary = await this.costTracker.getCostSummary(filters.startDate, filters.endDate);

    return {
      totalExecutions: dashboardMetrics.historical.totalExecutions,
      totalCost: costSummary.totalCost,
      averagePerformance: dashboardMetrics.historical.averageExecutionTime,
      successRate: dashboardMetrics.historical.overallSuccessRate * 100
    };
  }

  private updateProgress(
    id: string, 
    status: ReportGenerationProgress['status'], 
    progress: number, 
    currentStep: string, 
    totalSteps: number
  ): void {
    const callback = this.progressCallbacks.get(id);
    if (callback) {
      callback({
        id,
        status,
        progress,
        currentStep,
        totalSteps,
        startTime: new Date()
      });
    }
  }
  
  /**
   * Get cached template
   */
  private async getCachedTemplate(templateId: string): Promise<any> {
    const cached = this.templateCache.get(templateId);
    if (cached) {
      return cached;
    }
    
    const template = ReportTemplates.getTemplate(templateId);
    if (template) {
      this.templateCache.set(templateId, template);
    }
    
    return template;
  }
  
  /**
   * Get cached analytics data
   */
  private async getCachedAnalyticsData(filters: ReportFilters): Promise<any> {
    const cacheKey = `analytics_${JSON.stringify(filters)}`;
    const cached = this.dataCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const data = await this.analyticsEngine.getDashboardMetrics();
    this.dataCache.set(cacheKey, data, { ttl: 1000 * 60 * 5 }); // 5 minutes
    
    return data;
  }
  
  /**
   * Get cached cost data
   */
  private async getCachedCostData(filters: ReportFilters): Promise<any> {
    const cacheKey = `cost_${JSON.stringify(filters)}`;
    const cached = this.dataCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const data = await this.costTracker.getCostSummary(filters.startDate, filters.endDate);
    this.dataCache.set(cacheKey, data, { ttl: 1000 * 60 * 5 }); // 5 minutes
    
    return data;
  }
  
  /**
   * Pre-load commonly used data
   */
  private async preloadCommonData(): Promise<void> {
    try {
      // Pre-load dashboard metrics
      const dashboardMetrics = await this.analyticsEngine.getDashboardMetrics();
      this.dataCache.set('dashboard_metrics', dashboardMetrics, { ttl: 1000 * 60 * 5 });
      
      // Pre-load cost summary
      const costSummary = await this.costTracker.getCostSummary();
      this.dataCache.set('cost_summary', costSummary, { ttl: 1000 * 60 * 5 });
      
      console.log('Common report data pre-loaded successfully');
    } catch (error) {
      console.warn('Failed to pre-load common data:', error.message);
    }
  }
  
  /**
   * Track performance metrics
   */
  private trackPerformance(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    // Log slow operations
    if (duration > 5000) { // 5 seconds
      console.warn(`Slow report operation: ${operation} took ${duration.toFixed(2)}ms`);
    }
  }
  
  /**
   * Get performance statistics
   */
  public getPerformanceStats(): Record<string, { avg: number; max: number; min: number; count: number }> {
    const stats: Record<string, { avg: number; max: number; min: number; count: number }> = {};
    
    for (const [operation, metrics] of this.performanceMetrics) {
      if (metrics.length > 0) {
        const avg = metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
        const max = Math.max(...metrics);
        const min = Math.min(...metrics);
        
        stats[operation] = {
          avg: Math.round(avg),
          max: Math.round(max),
          min: Math.round(min),
          count: metrics.length
        };
      }
    }
    
    return stats;
  }
  
  /**
   * Clear caches
   */
  public clearCaches(): void {
    this.templateCache.clear();
    this.dataCache.clear();
    this.performanceMetrics.clear();
    console.log('Report generator caches cleared');
  }
}