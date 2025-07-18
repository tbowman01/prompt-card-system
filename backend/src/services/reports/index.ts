// Export all report-related services and types
export { ReportService, reportService } from './ReportService';
export { ReportGenerator } from './generators/ReportGenerator';
export { PDFExporter } from './exporters/PDFExporter';
export { ExcelExporter } from './exporters/ExcelExporter';
export { ReportTemplates } from './templates/ReportTemplates';
export { ReportIntegration, reportIntegration } from './ReportIntegration';

// Export types
export * from '../../types/reports';

// Initialize report templates on module load
import './templates/ReportTemplates';

console.log('📊 Report system initialized with advanced PDF/Excel generation capabilities');