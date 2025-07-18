import { reportService } from './ReportService';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { CostTracker } from '../CostTracker';
import { ReportFilters } from '../../types/reports';

/**
 * Integration service that connects the reporting system with analytics and cost tracking
 */
export class ReportIntegration {
  private analyticsEngine: AnalyticsEngine;
  private costTracker: CostTracker;
  private static instance: ReportIntegration;

  private constructor() {
    this.analyticsEngine = AnalyticsEngine.getInstance();
    this.costTracker = new CostTracker();
    this.initializeIntegration();
  }

  public static getInstance(): ReportIntegration {
    if (!ReportIntegration.instance) {
      ReportIntegration.instance = new ReportIntegration();
    }
    return ReportIntegration.instance;
  }

  private initializeIntegration(): void {
    // Set up event listeners for automatic report generation
    this.setupEventListeners();
    
    // Schedule periodic cleanup
    setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000); // Every hour

    console.log('Report integration initialized');
  }

  private setupEventListeners(): void {
    // Note: AnalyticsEngine doesn't extend EventEmitter, so we'll handle events differently
    // In a real implementation, you would set up event listeners if these classes extended EventEmitter
    // For now, we'll handle integration through direct method calls

    // Listen for report service events
    reportService.on('reportGenerated', (event) => {
      console.log(`Report generated: ${event.reportId} in ${event.generationTime}ms`);
    });

    reportService.on('reportExported', (event) => {
      console.log(`Report exported: ${event.reportId} as ${event.format}`);
    });
  }

  /**
   * Generate comprehensive system health report
   */
  public async generateSystemHealthReport(filters: ReportFilters = {}): Promise<any> {
    try {
      const report = await reportService.generateReport('executive-summary', {
        ...filters,
        startDate: filters.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: filters.endDate || new Date().toISOString()
      });

      return {
        success: true,
        report,
        insights: await this.generateHealthInsights(report)
      };
    } catch (error) {
      console.error('Error generating system health report:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate detailed cost analysis report
   */
  public async generateCostAnalysisReport(filters: ReportFilters = {}): Promise<any> {
    try {
      const report = await reportService.generateReport('cost-analysis', {
        ...filters,
        startDate: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: filters.endDate || new Date().toISOString()
      });

      // Get additional cost recommendations
      const recommendations = await this.costTracker.generateOptimizationRecommendations(
        filters.startDate,
        filters.endDate
      );

      return {
        success: true,
        report,
        recommendations,
        potentialSavings: recommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0)
      };
    } catch (error) {
      console.error('Error generating cost analysis report:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate performance benchmark report
   */
  public async generatePerformanceReport(filters: ReportFilters = {}): Promise<any> {
    try {
      const report = await reportService.generateReport('performance-analysis', {
        ...filters,
        startDate: filters.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: filters.endDate || new Date().toISOString()
      });

      // Get performance insights
      const insights = await this.analyticsEngine.generateInsights();
      const performanceInsights = insights.filter(i => 
        i.title.toLowerCase().includes('performance') || 
        i.title.toLowerCase().includes('speed') ||
        i.title.toLowerCase().includes('latency')
      );

      return {
        success: true,
        report,
        performanceInsights,
        recommendations: this.generatePerformanceRecommendations(report)
      };
    } catch (error) {
      console.error('Error generating performance report:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate executive dashboard report
   */
  public async generateExecutiveDashboard(filters: ReportFilters = {}): Promise<any> {
    try {
      const [
        dashboardMetrics,
        costSummary,
        insights,
        roiAnalysis
      ] = await Promise.all([
        this.analyticsEngine.getDashboardMetrics(),
        this.costTracker.getCostSummary(filters.startDate, filters.endDate),
        this.analyticsEngine.generateInsights(),
        this.costTracker.calculateROI(filters.startDate, filters.endDate)
      ]);

      const executiveSummary = {
        timeframe: {
          start: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: filters.endDate || new Date().toISOString()
        },
        keyMetrics: {
          totalTests: dashboardMetrics.historical.totalTests,
          successRate: dashboardMetrics.historical.overallSuccessRate,
          totalCost: costSummary.totalCost,
          costPerSuccess: roiAnalysis.averageCostPerSuccess,
          averageResponseTime: dashboardMetrics.historical.averageExecutionTime,
          totalExecutions: dashboardMetrics.historical.totalExecutions
        },
        trends: {
          testVolume: dashboardMetrics.trends.testsOverTime,
          successRate: dashboardMetrics.trends.successRateOverTime,
          performance: dashboardMetrics.trends.performanceOverTime
        },
        insights: insights.map(insight => ({
          title: insight.title,
          description: insight.description,
          severity: insight.severity,
          impact: this.calculateInsightImpact(insight)
        })),
        recommendations: await this.generateExecutiveRecommendations(dashboardMetrics, costSummary, insights)
      };

      return {
        success: true,
        executiveSummary,
        detailedMetrics: {
          analytics: dashboardMetrics,
          cost: costSummary,
          roi: roiAnalysis
        }
      };
    } catch (error) {
      console.error('Error generating executive dashboard:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export report in multiple formats
   */
  public async exportReportMultiFormat(reportId: string, formats: string[] = ['pdf', 'excel']): Promise<any> {
    try {
      const exports = await Promise.all(
        formats.map(async (format) => {
          try {
            const buffer = await reportService.exportReport(reportId, format as any);
            return {
              format,
              success: true,
              size: buffer.length,
              filename: `report_${reportId}_${Date.now()}.${format}`
            };
          } catch (error) {
            return {
              format,
              success: false,
              error: error.message
            };
          }
        })
      );

      return {
        success: true,
        exports,
        totalSize: exports.reduce((sum, exp) => sum + (exp.size || 0), 0)
      };
    } catch (error) {
      console.error('Error exporting report in multiple formats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test report integration
   */
  public async testIntegration(): Promise<any> {
    try {
      console.log('Starting report integration test...');

      // Test 1: Generate a simple report
      const report = await reportService.generateReport('executive-summary', {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      });

      console.log('✓ Report generation test passed');

      // Test 2: Export report as PDF
      const pdfBuffer = await reportService.exportReport(report.id, 'pdf');
      console.log(`✓ PDF export test passed (${pdfBuffer.length} bytes)`);

      // Test 3: Export report as Excel
      const excelBuffer = await reportService.exportReport(report.id, 'excel');
      console.log(`✓ Excel export test passed (${excelBuffer.length} bytes)`);

      // Test 4: Test analytics integration
      const dashboardMetrics = await this.analyticsEngine.getDashboardMetrics();
      console.log(`✓ Analytics integration test passed (${dashboardMetrics.insights.length} insights)`);

      // Test 5: Test cost tracking integration
      const costSummary = await this.costTracker.getCostSummary();
      console.log(`✓ Cost tracking integration test passed ($${costSummary.totalCost.toFixed(2)} total cost)`);

      return {
        success: true,
        message: 'All integration tests passed',
        testResults: {
          reportGeneration: true,
          pdfExport: true,
          excelExport: true,
          analyticsIntegration: true,
          costTrackingIntegration: true
        },
        reportId: report.id,
        exportSizes: {
          pdf: pdfBuffer.length,
          excel: excelBuffer.length
        }
      };
    } catch (error) {
      console.error('Integration test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Private helper methods
  private async generateAlertReport(insight: any): Promise<void> {
    try {
      const report = await reportService.generateReport('executive-summary', {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      });

      console.log(`Alert report generated for critical insight: ${insight.title}`);
    } catch (error) {
      console.error('Error generating alert report:', error);
    }
  }

  private async generateCostAlert(alert: any): Promise<void> {
    try {
      const report = await reportService.generateReport('cost-analysis', {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      });

      console.log(`Cost alert report generated for budget alert: ${alert.name}`);
    } catch (error) {
      console.error('Error generating cost alert report:', error);
    }
  }

  private async generateHealthInsights(report: any): Promise<any[]> {
    const insights = [];

    // Analyze report metrics for health insights
    if (report.metadata.successRate < 80) {
      insights.push({
        type: 'warning',
        title: 'Low Success Rate',
        description: `Success rate is ${report.metadata.successRate.toFixed(1)}%, below recommended 80%`,
        recommendation: 'Review failing test cases and optimize assertions'
      });
    }

    if (report.metadata.averagePerformance > 5000) {
      insights.push({
        type: 'warning',
        title: 'High Response Time',
        description: `Average response time is ${report.metadata.averagePerformance.toFixed(0)}ms`,
        recommendation: 'Consider optimizing model configurations or scaling infrastructure'
      });
    }

    if (report.metadata.totalCost > 100) {
      insights.push({
        type: 'info',
        title: 'High Cost Usage',
        description: `Total cost is $${report.metadata.totalCost.toFixed(2)}`,
        recommendation: 'Review cost optimization recommendations'
      });
    }

    return insights;
  }

  private generatePerformanceRecommendations(report: any): any[] {
    const recommendations = [];

    // Analyze performance metrics and generate recommendations
    if (report.metadata.averagePerformance > 3000) {
      recommendations.push({
        priority: 'high',
        title: 'Optimize Response Time',
        description: 'Consider using faster models or implementing caching',
        impact: 'Could improve response time by 30-50%'
      });
    }

    if (report.metadata.totalExecutions > 10000) {
      recommendations.push({
        priority: 'medium',
        title: 'Implement Batching',
        description: 'Group similar test cases for batch processing',
        impact: 'Could reduce execution time by 20-30%'
      });
    }

    return recommendations;
  }

  private async generateExecutiveRecommendations(
    dashboardMetrics: any,
    costSummary: any,
    insights: any[]
  ): Promise<any[]> {
    const recommendations = [];

    // Cost optimization recommendations
    if (costSummary.totalCost > 50) {
      recommendations.push({
        category: 'cost',
        priority: 'high',
        title: 'Implement Cost Controls',
        description: 'Current spend is high, consider implementing budget alerts and cost optimization',
        estimatedSavings: costSummary.totalCost * 0.2
      });
    }

    // Performance recommendations
    if (dashboardMetrics.historical.averageExecutionTime > 2000) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        title: 'Optimize Test Execution',
        description: 'Average execution time is above optimal range',
        estimatedImprovement: '30-40% faster execution'
      });
    }

    // Quality recommendations
    if (dashboardMetrics.historical.overallSuccessRate < 0.85) {
      recommendations.push({
        category: 'quality',
        priority: 'high',
        title: 'Improve Test Quality',
        description: 'Success rate is below industry standards',
        estimatedImprovement: 'Increase success rate to 90%+'
      });
    }

    return recommendations;
  }

  private calculateInsightImpact(insight: any): string {
    switch (insight.severity) {
      case 'critical':
        return 'High impact on system performance and reliability';
      case 'high':
        return 'Moderate impact on system performance';
      case 'medium':
        return 'Low to moderate impact on system performance';
      case 'low':
        return 'Minimal impact on system performance';
      default:
        return 'Impact assessment not available';
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      await reportService.cleanup();
      console.log('Report integration cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const reportIntegration = ReportIntegration.getInstance();