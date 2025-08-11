import { ReportGenerator } from './generators/ReportGenerator';
import { PDFExporter } from './exporters/PDFExporter';
import { ExcelExporter } from './exporters/ExcelExporter';
import { ReportTemplates } from './templates/ReportTemplates';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { CostTracker } from '../CostTracker';
import { 
  ReportData, 
  ReportTemplate, 
  ReportFilters, 
  ReportExportOptions, 
  ReportGenerationProgress,
  ReportSchedule
} from '../../types/reports';
import { Database } from 'better-sqlite3';
import { initializeDatabase } from '../../database/connection';
import { EventEmitter } from 'events';

export class ReportService extends EventEmitter {
  private reportGenerator: ReportGenerator;
  private pdfExporter: PDFExporter;
  private excelExporter: ExcelExporter;
  private db: any;
  private reportCache: Map<string, ReportData>;
  private generationQueue: Map<string, Promise<ReportData>>;
  private static instance: ReportService;

  public constructor() {
    super();
    this.reportGenerator = new ReportGenerator();
    this.pdfExporter = new PDFExporter();
    this.excelExporter = new ExcelExporter();
    this.reportCache = new Map();
    this.generationQueue = new Map();
    
    // Initialize database first, then set up tables
    this.initializeDb().then(() => {
      this.initializeDatabase();
    }).catch(error => {
      console.error('Failed to initialize ReportService database:', error);
    });
  }

  private async initializeDb(): Promise<void> {
    this.db = await initializeDatabase();
  }

  /**
   * Create test data for a prompt card
   */
  async createTestData(promptCardId: string): Promise<void> {
    // Implementation for creating test data
    console.log(`Creating test data for prompt card: ${promptCardId}`);
  }

  public static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  private initializeDatabase(): void {
    // Report history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS report_history (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        filters TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        generation_time INTEGER,
        total_executions INTEGER,
        total_cost REAL,
        success_rate REAL,
        file_path TEXT,
        file_size INTEGER,
        export_format TEXT,
        created_by TEXT,
        status TEXT DEFAULT 'completed'
      )
    `);

    // Report schedules table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS report_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        template_id TEXT NOT NULL,
        filters TEXT,
        frequency TEXT NOT NULL,
        recipients TEXT,
        export_format TEXT NOT NULL,
        next_execution DATETIME,
        last_execution DATETIME,
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Report exports table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS report_exports (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        format TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER,
        download_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (report_id) REFERENCES report_history(id) ON DELETE CASCADE
      )
    `);

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_report_history_template_id ON report_history(template_id);
      CREATE INDEX IF NOT EXISTS idx_report_history_generated_at ON report_history(generated_at);
      CREATE INDEX IF NOT EXISTS idx_report_schedules_next_execution ON report_schedules(next_execution);
      CREATE INDEX IF NOT EXISTS idx_report_exports_report_id ON report_exports(report_id);
    `);

    console.log('Report service database initialized');
  }

  // Report Generation Methods
  public async generateReport(
    templateId: string,
    filters: ReportFilters = {},
    options: { saveToHistory?: boolean; userId?: string } = {}
  ): Promise<ReportData> {
    const cacheKey = this.generateCacheKey(templateId, filters);
    
    // Check cache first
    if (this.reportCache.has(cacheKey)) {
      const cachedReport = this.reportCache.get(cacheKey)!;
      // Return cached report if it's less than 30 minutes old
      if (Date.now() - cachedReport.generatedAt.getTime() < 30 * 60 * 1000) {
        return cachedReport;
      }
    }

    // Check if generation is already in progress
    if (this.generationQueue.has(cacheKey)) {
      return this.generationQueue.get(cacheKey)!;
    }

    // Generate new report
    const generationPromise = this.generateReportInternal(templateId, filters, options);
    this.generationQueue.set(cacheKey, generationPromise);

    try {
      const report = await generationPromise;
      
      // Cache the report
      this.reportCache.set(cacheKey, report);
      
      // Save to history if requested
      if (options.saveToHistory !== false) {
        await this.saveReportToHistory(report, options.userId);
      }
      
      return report;
    } finally {
      this.generationQueue.delete(cacheKey);
    }
  }

  private async generateReportInternal(
    templateId: string,
    filters: ReportFilters,
    options: { userId?: string }
  ): Promise<ReportData> {
    // Validate template
    const template = ReportTemplates.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Generate report with progress tracking
    const report = await this.reportGenerator.generateReport(
      templateId,
      filters,
      (progress) => {
        this.emit('reportProgress', progress);
      }
    );

    // Emit completion event
    this.emit('reportGenerated', {
      reportId: report.id,
      templateId,
      filters,
      userId: options.userId,
      generationTime: report.metadata.generationTime
    });

    return report;
  }

  // Export Methods
  public async exportReport(
    reportId: string,
    format: 'pdf' | 'excel' | 'json' | 'csv',
    options: ReportExportOptions = { format, includeCharts: true, includeRawData: false }
  ): Promise<Buffer> {
    // Get report from cache or history
    const report = await this.getReportById(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    let exportBuffer: Buffer;

    switch (format) {
      case 'pdf':
        exportBuffer = await this.pdfExporter.exportToPDF(report, options);
        break;
      case 'excel':
        exportBuffer = await this.excelExporter.exportToExcel(report, options);
        break;
      case 'json':
        exportBuffer = Buffer.from(JSON.stringify(report, null, 2));
        break;
      case 'csv':
        exportBuffer = await this.exportToCSV(report);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Save export record
    await this.saveExportRecord(reportId, format, exportBuffer.length);

    // Emit export event
    this.emit('reportExported', {
      reportId,
      format,
      fileSize: exportBuffer.length,
      timestamp: new Date()
    });

    return exportBuffer;
  }

  private async exportToCSV(report: ReportData): Promise<Buffer> {
    const csvLines: string[] = [];
    
    // Add header
    csvLines.push('Report,Template,Generated,Section,Type,Data');
    
    // Add report metadata
    csvLines.push(`"${report.title}","${report.template.name}","${report.generatedAt.toISOString()}","Metadata","Info","Total Executions: ${report.metadata.totalExecutions}"`);
    csvLines.push(`"${report.title}","${report.template.name}","${report.generatedAt.toISOString()}","Metadata","Info","Total Cost: $${report.metadata.totalCost.toFixed(2)}"`);
    csvLines.push(`"${report.title}","${report.template.name}","${report.generatedAt.toISOString()}","Metadata","Info","Success Rate: ${report.metadata.successRate.toFixed(1)}%"`);
    
    // Add section data
    for (const section of report.sections) {
      if (section.type === 'tables' && section.content?.rows) {
        const tableData = section.content as any;
        
        // Add table headers
        const headers = tableData.headers.map((h: string) => `"${h}"`).join(',');
        csvLines.push(`"${report.title}","${report.template.name}","${report.generatedAt.toISOString()}","${section.title}","TableHeader","${headers}"`);
        
        // Add table rows
        tableData.rows.forEach((row: any[]) => {
          const rowData = row.map((cell: any) => `"${cell}"`).join(',');
          csvLines.push(`"${report.title}","${report.template.name}","${report.generatedAt.toISOString()}","${section.title}","TableRow","${rowData}"`);
        });
      }
    }
    
    return Buffer.from(csvLines.join('\n'));
  }

  // Template Methods
  public getTemplates(): ReportTemplate[] {
    return ReportTemplates.getAllTemplates();
  }

  public getTemplate(templateId: string): ReportTemplate | undefined {
    return ReportTemplates.getTemplate(templateId);
  }

  public getTemplatesByType(type: ReportTemplate['type']): ReportTemplate[] {
    return ReportTemplates.getTemplatesByType(type);
  }

  public async createCustomTemplate(template: ReportTemplate): Promise<ReportTemplate> {
    const errors = ReportTemplates.validateTemplate(template);
    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }

    ReportTemplates.addCustomTemplate(template);
    
    // Emit template created event
    this.emit('templateCreated', {
      templateId: template.id,
      templateName: template.name,
      timestamp: new Date()
    });

    return template;
  }

  // Report History Methods
  public async getReportHistory(
    limit: number = 50,
    offset: number = 0,
    filters: { templateId?: string; userId?: string; startDate?: string; endDate?: string } = {}
  ): Promise<{ reports: any[]; total: number }> {
    let query = `
      SELECT * FROM report_history 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.templateId) {
      query += ` AND template_id = ?`;
      params.push(filters.templateId);
    }

    if (filters.userId) {
      query += ` AND created_by = ?`;
      params.push(filters.userId);
    }

    if (filters.startDate) {
      query += ` AND generated_at >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND generated_at <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY generated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const reports = this.db.prepare(query).all(...params);
    
    // Get total count
    const countQuery = query.replace(/SELECT \* FROM/, 'SELECT COUNT(*) as count FROM').replace(/ORDER BY.*$/, '');
    const totalResult = this.db.prepare(countQuery).get(...params.slice(0, -2)) as any;
    const total = totalResult?.count || 0;

    return { reports, total };
  }

  public async getReportById(reportId: string): Promise<ReportData | null> {
    // Check cache first
    const cacheKey = Array.from(this.reportCache.keys()).find(key => 
      this.reportCache.get(key)?.id === reportId
    );
    if (cacheKey) {
      return this.reportCache.get(cacheKey)!;
    }

    // Check database
    const record = this.db.prepare(`
      SELECT * FROM report_history WHERE id = ?
    `).get(reportId);

    if (!record) {
      return null;
    }

    // Reconstruct report data (this is a simplified version)
    // In a real implementation, you might want to store the full report data
    const template = ReportTemplates.getTemplate(record.template_id);
    if (!template) {
      return null;
    }

    const filters = record.filters ? JSON.parse(record.filters) : {};
    
    // Regenerate report (this could be optimized by storing the full report)
    return await this.generateReport(record.template_id, filters, { saveToHistory: false });
  }

  public async deleteReport(reportId: string): Promise<boolean> {
    const result = this.db.prepare(`
      DELETE FROM report_history WHERE id = ?
    `).run(reportId);

    if (result.changes > 0) {
      // Remove from cache
      const cacheKey = Array.from(this.reportCache.keys()).find(key => 
        this.reportCache.get(key)?.id === reportId
      );
      if (cacheKey) {
        this.reportCache.delete(cacheKey);
      }

      this.emit('reportDeleted', { reportId, timestamp: new Date() });
      return true;
    }

    return false;
  }

  // Schedule Methods
  public async createSchedule(schedule: Omit<ReportSchedule, 'id'>): Promise<ReportSchedule> {
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullSchedule: ReportSchedule = {
      id: scheduleId,
      ...schedule
    };

    this.db.prepare(`
      INSERT INTO report_schedules 
      (id, name, template_id, filters, frequency, recipients, export_format, next_execution, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scheduleId,
      schedule.name,
      schedule.templateId,
      JSON.stringify(schedule.filters),
      schedule.frequency,
      JSON.stringify(schedule.recipients),
      schedule.format,
      schedule.nextExecution.toISOString(),
      schedule.enabled ? 1 : 0
    );

    this.emit('scheduleCreated', { scheduleId, scheduleName: schedule.name, timestamp: new Date() });
    
    return fullSchedule;
  }

  public async getSchedules(): Promise<ReportSchedule[]> {
    const schedules = this.db.prepare(`
      SELECT * FROM report_schedules ORDER BY created_at DESC
    `).all();

    return schedules.map(schedule => ({
      id: schedule.id,
      name: schedule.name,
      templateId: schedule.template_id,
      filters: schedule.filters ? JSON.parse(schedule.filters) : {},
      frequency: schedule.frequency,
      recipients: schedule.recipients ? JSON.parse(schedule.recipients) : [],
      format: schedule.export_format,
      nextExecution: new Date(schedule.next_execution),
      lastExecution: schedule.last_execution ? new Date(schedule.last_execution) : undefined,
      enabled: Boolean(schedule.enabled)
    }));
  }

  public async executeScheduledReports(): Promise<void> {
    const now = new Date();
    const dueSchedules = this.db.prepare(`
      SELECT * FROM report_schedules 
      WHERE enabled = 1 AND next_execution <= ?
    `).all(now.toISOString());

    for (const schedule of dueSchedules) {
      try {
        const filters = schedule.filters ? JSON.parse(schedule.filters) : {};
        const report = await this.generateReport(schedule.template_id, filters, { saveToHistory: true });
        
        const exportBuffer = await this.exportReport(report.id, schedule.export_format);
        
        // In a real implementation, you would send the report to recipients
        // For now, we just log the execution
        console.log(`Executed scheduled report: ${schedule.name}`);
        
        // Update schedule
        const nextExecution = this.calculateNextExecution(schedule.frequency, now);
        this.db.prepare(`
          UPDATE report_schedules 
          SET last_execution = ?, next_execution = ?
          WHERE id = ?
        `).run(now.toISOString(), nextExecution.toISOString(), schedule.id);
        
        this.emit('scheduleExecuted', {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          reportId: report.id,
          timestamp: now
        });
      } catch (error) {
        console.error(`Failed to execute scheduled report ${schedule.name}:`, error);
        this.emit('scheduleExecutionFailed', {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          error: error.message,
          timestamp: now
        });
      }
    }
  }

  // Utility Methods
  private generateCacheKey(templateId: string, filters: ReportFilters): string {
    return `${templateId}:${JSON.stringify(filters)}`;
  }

  private async saveReportToHistory(report: ReportData, userId?: string): Promise<void> {
    this.db.prepare(`
      INSERT INTO report_history 
      (id, template_id, title, description, filters, generated_at, generation_time, 
       total_executions, total_cost, success_rate, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.template.id,
      report.title,
      report.description,
      JSON.stringify(report.filters),
      report.generatedAt.toISOString(),
      report.metadata.generationTime,
      report.metadata.totalExecutions,
      report.metadata.totalCost,
      report.metadata.successRate,
      userId || 'system',
      'completed'
    );
  }

  private async saveExportRecord(reportId: string, format: string, fileSize: number): Promise<void> {
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.db.prepare(`
      INSERT INTO report_exports (id, report_id, format, file_size)
      VALUES (?, ?, ?, ?)
    `).run(exportId, reportId, format, fileSize);
  }

  private calculateNextExecution(frequency: string, fromDate: Date): Date {
    const next = new Date(fromDate);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      default:
        next.setDate(next.getDate() + 1);
    }
    
    return next;
  }

  // Cleanup Methods
  public async cleanup(): Promise<void> {
    // Clear old cache entries
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, report] of this.reportCache.entries()) {
      if (report.generatedAt.getTime() < oneHourAgo) {
        this.reportCache.delete(key);
      }
    }

    // Clean up old export records
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.db.prepare(`
      DELETE FROM report_exports 
      WHERE created_at < ?
    `).run(thirtyDaysAgo.toISOString());

    console.log('Report service cleanup completed');
  }
}

// Export singleton instance
export const reportService = ReportService.getInstance();