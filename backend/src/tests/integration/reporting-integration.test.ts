import request from 'supertest';
import assert from 'assert';
import app from '../../server';
import { ReportService } from '../../services/reports/ReportService';
import { ReportGenerator } from '../../services/reports/generators/ReportGenerator';
import { PDFExporter } from '../../services/reports/exporters/PDFExporter';
import { ExcelExporter } from '../../services/reports/exporters/ExcelExporter';
import fs from 'fs';
import path from 'path';

describe('Advanced Reporting System Integration Tests', () => {
  let reportService: ReportService;
  let reportGenerator: ReportGenerator;
  const testReportId = 'test-report-123';
  const testCardId = 'test-card-report-456';

  beforeEach(async () => {
    reportService = new ReportService();
    reportGenerator = new ReportGenerator();
    
    // Set up test data
    await reportService.createTestData(testCardId);
  });

  describe('Report Generation Integration', () => {
    it('should generate comprehensive test execution report', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'test_execution',
          cardId: testCardId,
          timeRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          },
          includeMetrics: true,
          includeCharts: true,
          includeAnalytics: true
        })
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('reportId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data.status).toBe('completed');
    });

    it('should generate performance analysis report', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'performance_analysis',
          cardId: testCardId,
          analysisType: 'comprehensive',
          includeRecommendations: true,
          includeBenchmarks: true
        })
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('reportId');
      expect(response.body.data).toHaveProperty('performanceMetrics');
      expect(response.body.data).toHaveProperty('recommendations');
    });

    it('should generate cost optimization report', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'cost_optimization',
          cardId: testCardId,
          includeCostBreakdown: true,
          includeOptimizationSuggestions: true,
          includeProjections: true
        })
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('reportId');
      expect(response.body.data).toHaveProperty('costAnalysis');
      expect(response.body.data).toHaveProperty('optimizationSuggestions');
    });
  });

  describe('Report Export Integration', () => {
    it('should export report to PDF format', async () => {
      // First generate a report
      const generateResponse = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'test_execution',
          cardId: testCardId,
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        })
        .expect(200);

      const reportId = generateResponse.body.data.reportId;

      // Export to PDF
      const exportResponse = await request(app)
        .post(`/api/reports/${reportId}/export`)
        .send({
          format: 'pdf',
          includeCharts: true,
          includeTableOfContents: true,
          theme: 'professional'
        })
        .expect(200);

      assert(exportResponse.body.success === true);
      expect(exportResponse.body.data).toHaveProperty('downloadUrl');
      expect(exportResponse.body.data).toHaveProperty('fileName');
      expect(exportResponse.body.data.fileName).toContain('.pdf');
    });

    it('should export report to Excel format', async () => {
      // First generate a report
      const generateResponse = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'performance_analysis',
          cardId: testCardId
        })
        .expect(200);

      const reportId = generateResponse.body.data.reportId;

      // Export to Excel
      const exportResponse = await request(app)
        .post(`/api/reports/${reportId}/export`)
        .send({
          format: 'excel',
          includeCharts: true,
          includeRawData: true,
          separateSheets: true
        })
        .expect(200);

      assert(exportResponse.body.success === true);
      expect(exportResponse.body.data).toHaveProperty('downloadUrl');
      expect(exportResponse.body.data).toHaveProperty('fileName');
      expect(exportResponse.body.data.fileName).toContain('.xlsx');
    });

    it('should export report to CSV format', async () => {
      // First generate a report
      const generateResponse = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'cost_optimization',
          cardId: testCardId
        })
        .expect(200);

      const reportId = generateResponse.body.data.reportId;

      // Export to CSV
      const exportResponse = await request(app)
        .post(`/api/reports/${reportId}/export`)
        .send({
          format: 'csv',
          includeHeaders: true,
          delimiter: ',',
          encoding: 'utf-8'
        })
        .expect(200);

      assert(exportResponse.body.success === true);
      expect(exportResponse.body.data).toHaveProperty('downloadUrl');
      expect(exportResponse.body.data).toHaveProperty('fileName');
      expect(exportResponse.body.data.fileName).toContain('.csv');
    });
  });

  describe('Scheduled Reports Integration', () => {
    it('should create and manage scheduled reports', async () => {
      const response = await request(app)
        .post('/api/reports/schedule')
        .send({
          name: 'Weekly Performance Report',
          type: 'performance_analysis',
          cardId: testCardId,
          schedule: {
            frequency: 'weekly',
            dayOfWeek: 'monday',
            time: '09:00',
            timezone: 'UTC'
          },
          format: 'pdf',
          recipients: ['test@example.com'],
          includeCharts: true
        })
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('scheduleId');
      expect(response.body.data).toHaveProperty('nextExecution');
    });

    it('should handle scheduled report execution', async () => {
      // Create a scheduled report
      const scheduleResponse = await request(app)
        .post('/api/reports/schedule')
        .send({
          name: 'Daily Cost Report',
          type: 'cost_optimization',
          cardId: testCardId,
          schedule: {
            frequency: 'daily',
            time: '08:00'
          },
          format: 'excel'
        })
        .expect(200);

      const scheduleId = scheduleResponse.body.data.scheduleId;

      // Trigger scheduled report execution
      const executeResponse = await request(app)
        .post(`/api/reports/schedule/${scheduleId}/execute`)
        .expect(200);

      assert(executeResponse.body.success === true);
      expect(executeResponse.body.data).toHaveProperty('reportId');
      expect(executeResponse.body.data).toHaveProperty('executionTime');
    });
  });

  describe('Report Templates Integration', () => {
    it('should create and use custom report templates', async () => {
      // Create custom template
      const templateResponse = await request(app)
        .post('/api/reports/templates')
        .send({
          name: 'Custom Performance Template',
          type: 'performance_analysis',
          sections: [
            {
              type: 'summary',
              title: 'Executive Summary',
              includeMetrics: true
            },
            {
              type: 'charts',
              title: 'Performance Trends',
              chartTypes: ['line', 'bar']
            },
            {
              type: 'table',
              title: 'Detailed Results',
              columns: ['timestamp', 'success_rate', 'response_time']
            }
          ],
          styling: {
            theme: 'corporate',
            colors: ['#1f77b4', '#ff7f0e', '#2ca02c']
          }
        })
        .expect(200);

      const templateId = templateResponse.body.data.templateId;

      // Use template to generate report
      const reportResponse = await request(app)
        .post('/api/reports/generate')
        .send({
          templateId,
          cardId: testCardId,
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        })
        .expect(200);

      assert(reportResponse.body.success === true);
      expect(reportResponse.body.data).toHaveProperty('reportId');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing card ID gracefully', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'test_execution',
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        })
        .expect(400);

      expect(response.body.error).toContain('Card ID is required');
    });

    it('should handle invalid report type', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'invalid_type',
          cardId: testCardId
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid report type');
    });

    it('should handle export failures gracefully', async () => {
      // Create a report first
      const generateResponse = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'test_execution',
          cardId: testCardId
        })
        .expect(200);

      const reportId = generateResponse.body.data.reportId;

      // Try to export with invalid format
      const exportResponse = await request(app)
        .post(`/api/reports/${reportId}/export`)
        .send({
          format: 'invalid_format'
        })
        .expect(400);

      expect(exportResponse.body.error).toContain('Invalid export format');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large dataset report generation', async () => {
      // Generate report with large dataset
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          type: 'comprehensive_analysis',
          cardId: testCardId,
          timeRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            end: new Date().toISOString()
          },
          includeAllMetrics: true,
          includeRawData: true
        })
        .expect(200);

      assert(response.body.success === true);
      expect(response.body.data).toHaveProperty('reportId');
      
      // Verify the report was generated successfully
      const statusResponse = await request(app)
        .get(`/api/reports/${response.body.data.reportId}/status`)
        .expect(200);

      expect(statusResponse.body.data.status).toMatch(/^(completed|processing)$/);
    });
  });
});