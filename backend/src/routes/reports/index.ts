import { Router } from 'express';
import { reportService } from '../../services/reports/ReportService';
import { ReportFilters, ReportExportOptions } from '../../types/reports';

const router = Router();

// Generate report
router.post('/generate/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const filters: ReportFilters = req.body.filters || {};
    const options = req.body.options || {};

    const report = await reportService.generateReport(templateId, filters, options);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export report
router.post('/export/:reportId/:format', async (req, res) => {
  try {
    const { reportId, format } = req.params;
    const exportOptions: ReportExportOptions = {
      format: format as any,
      includeCharts: req.body.includeCharts !== false,
      includeRawData: req.body.includeRawData === true,
      compression: req.body.compression === true,
      customizations: req.body.customizations
    };

    const exportBuffer = await reportService.exportReport(reportId, format as any, exportOptions);
    
    // Set appropriate headers
    const filename = `report_${reportId}_${Date.now()}.${format}`;
    const contentType = getContentType(format);
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', exportBuffer.length);
    
    res.send(exportBuffer);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get templates
router.get('/templates', async (req, res) => {
  try {
    const { type } = req.query;
    
    let templates;
    if (type) {
      templates = reportService.getTemplatesByType(type as any);
    } else {
      templates = reportService.getTemplates();
    }
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific template
router.get('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = reportService.getTemplate(templateId);
    
    if (!template) {
      res.status(404).json({
        success: false,
        error: 'Template not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create custom template
router.post('/templates', async (req, res) => {
  try {
    const templateData = req.body;
    const template = await reportService.createCustomTemplate(templateData);
    
    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get report history
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const filters = {
      templateId: req.query.templateId as string,
      userId: req.query.userId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const result = await reportService.getReportHistory(limit, offset, filters);
    
    res.json({
      success: true,
      data: result.reports,
      pagination: {
        total: result.total,
        limit,
        offset,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting report history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific report
router.get('/history/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await reportService.getReportById(reportId);
    
    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error getting report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete report
router.delete('/history/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const deleted = await reportService.deleteReport(reportId);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Schedule management
router.post('/schedules', async (req, res) => {
  try {
    const scheduleData = req.body;
    const schedule = await reportService.createSchedule(scheduleData);
    
    res.status(201).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/schedules', async (req, res) => {
  try {
    const schedules = await reportService.getSchedules();
    
    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Error getting schedules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Execute scheduled reports (typically called by cron job)
router.post('/schedules/execute', async (req, res) => {
  try {
    await reportService.executeScheduledReports();
    
    res.json({
      success: true,
      message: 'Scheduled reports executed'
    });
  } catch (error) {
    console.error('Error executing scheduled reports:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Real-time report generation progress (WebSocket endpoint would be better)
router.get('/progress/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // This is a simplified implementation
    // In a real application, you'd use WebSocket or Server-Sent Events
    res.json({
      success: true,
      data: {
        id: reportId,
        status: 'completed',
        progress: 100,
        currentStep: 'Report generation completed',
        totalSteps: 6
      }
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analytics endpoint for report metrics
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get report generation analytics
    const analytics = {
      totalReports: 0,
      reportsByTemplate: {},
      reportsByFormat: {},
      averageGenerationTime: 0,
      mostPopularTemplate: null,
      recentActivity: []
    };
    
    // This would be implemented with actual analytics queries
    // For now, return mock data
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        service: 'Report Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        templates: reportService.getTemplates().length,
        cacheSize: 0 // Would implement actual cache size
      }
    });
  } catch (error) {
    console.error('Error checking health:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to get content type based on format
function getContentType(format: string): string {
  switch (format.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

export { router as reportRoutes };