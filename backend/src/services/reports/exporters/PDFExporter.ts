import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ReportData, ReportExportOptions, ChartData, TableData, MetricData } from '../../../types/reports';
import fs from 'fs';
import path from 'path';

export class PDFExporter {
  private chartRenderer: ChartJSNodeCanvas;
  private static readonly CHART_WIDTH = 800;
  private static readonly CHART_HEIGHT = 400;

  constructor() {
    this.chartRenderer = new ChartJSNodeCanvas({
      width: PDFExporter.CHART_WIDTH,
      height: PDFExporter.CHART_HEIGHT,
      backgroundColour: 'white'
    });
  }

  async exportToPDF(
    report: ReportData,
    options: ReportExportOptions = { format: 'pdf', includeCharts: true, includeRawData: false }
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: report.title,
        Author: 'Prompt Card System',
        Subject: report.description,
        Creator: 'Prompt Card System Report Generator',
        Producer: 'PDFKit',
        CreationDate: report.generatedAt
      }
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));

    try {
      await this.generatePDFContent(doc, report, options);
      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });
        doc.on('error', reject);
      });
    } catch (error) {
      doc.end();
      throw error;
    }
  }

  private async generatePDFContent(doc: PDFKit.PDFDocument, report: ReportData, options: ReportExportOptions): Promise<void> {
    // Cover page
    await this.generateCoverPage(doc, report, options);

    // Table of contents
    this.generateTableOfContents(doc, report);

    // Executive summary
    this.generateExecutiveSummary(doc, report);

    // Report sections
    for (const section of report.sections.sort((a, b) => a.order - b.order)) {
      await this.generateSection(doc, section, options);
    }

    // Appendices
    if (options.includeRawData) {
      this.generateAppendices(doc, report);
    }
  }

  private async generateCoverPage(doc: PDFKit.PDFDocument, report: ReportData, options: ReportExportOptions): Promise<void> {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Add logo if provided
    if (options.customizations?.logo) {
      try {
        const logoPath = path.resolve(options.customizations.logo);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 50, { width: 100 });
        }
      } catch (error) {
        console.warn('Could not load logo:', error.message);
      }
    }

    // Title
    doc.fontSize(28)
       .fillColor(options.customizations?.colors?.primary || '#2c3e50')
       .text(report.title, 50, 200, { align: 'center', width: pageWidth - 100 });

    // Subtitle
    doc.fontSize(16)
       .fillColor('#7f8c8d')
       .text(report.description, 50, 280, { align: 'center', width: pageWidth - 100 });

    // Generated date
    doc.fontSize(12)
       .fillColor('#34495e')
       .text(`Generated on: ${report.generatedAt.toLocaleDateString()}`, 50, 350, { align: 'center' });

    // Key metrics overview
    doc.fontSize(14)
       .fillColor('#2c3e50')
       .text('Key Metrics', 50, 400, { align: 'center' });

    const keyMetrics = report.summary.keyMetrics;
    const metricsPerRow = 2;
    const startY = 430;
    const columnWidth = (pageWidth - 100) / metricsPerRow;

    keyMetrics.forEach((metric, index) => {
      const row = Math.floor(index / metricsPerRow);
      const col = index % metricsPerRow;
      const x = 50 + (col * columnWidth);
      const y = startY + (row * 60);

      doc.fontSize(12)
         .fillColor('#7f8c8d')
         .text(metric.label, x, y, { width: columnWidth - 20, align: 'center' });

      doc.fontSize(18)
         .fillColor(options.customizations?.colors?.accent || '#3498db')
         .text(metric.value.toString(), x, y + 20, { width: columnWidth - 20, align: 'center' });
    });

    // Footer
    doc.fontSize(10)
       .fillColor('#95a5a6')
       .text('Confidential - Internal Use Only', 50, pageHeight - 80, { align: 'center' });

    doc.addPage();
  }

  private generateTableOfContents(doc: PDFKit.PDFDocument, report: ReportData): void {
    doc.fontSize(20)
       .fillColor('#2c3e50')
       .text('Table of Contents', 50, 50);

    let y = 100;
    doc.fontSize(12).fillColor('#34495e');

    // Executive Summary
    doc.text('Executive Summary', 70, y, { continued: true });
    doc.text('.'.repeat(50), { continued: true });
    doc.text('Page 3');
    y += 25;

    // Sections
    report.sections.forEach((section, index) => {
      doc.text(section.title, 70, y, { continued: true });
      doc.text('.'.repeat(50), { continued: true });
      doc.text(`Page ${4 + index}`);
      y += 20;
    });

    // Appendices
    if (report.sections.length > 0) {
      y += 20;
      doc.text('Appendices', 70, y, { continued: true });
      doc.text('.'.repeat(50), { continued: true });
      doc.text(`Page ${4 + report.sections.length}`);
    }

    doc.addPage();
  }

  private generateExecutiveSummary(doc: PDFKit.PDFDocument, report: ReportData): void {
    doc.fontSize(20)
       .fillColor('#2c3e50')
       .text('Executive Summary', 50, 50);

    doc.fontSize(12)
       .fillColor('#34495e')
       .text(report.description, 50, 90, { width: 500 });

    // Key metrics
    doc.fontSize(16)
       .fillColor('#2c3e50')
       .text('Key Performance Indicators', 50, 140);

    let y = 170;
    report.summary.keyMetrics.forEach(metric => {
      doc.fontSize(12)
         .fillColor('#7f8c8d')
         .text(metric.label, 70, y, { continued: true });
      
      doc.fillColor('#2c3e50')
         .text(`: ${metric.value}`, { continued: false });
      
      y += 20;
    });

    // Key insights
    if (report.summary.insights.length > 0) {
      doc.fontSize(16)
         .fillColor('#2c3e50')
         .text('Key Insights', 50, y + 20);

      y += 50;
      report.summary.insights.slice(0, 3).forEach(insight => {
        doc.fontSize(14)
           .fillColor('#e74c3c')
           .text(`• ${insight.title}`, 70, y);
        
        doc.fontSize(11)
           .fillColor('#34495e')
           .text(insight.description, 90, y + 18, { width: 450 });
        
        y += 60;
      });
    }

    doc.addPage();
  }

  private async generateSection(doc: PDFKit.PDFDocument, section: any, options: ReportExportOptions): Promise<void> {
    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text(section.title, 50, 50);

    if (section.description) {
      doc.fontSize(12)
         .fillColor('#7f8c8d')
         .text(section.description, 50, 80, { width: 500 });
    }

    let y = section.description ? 120 : 90;

    switch (section.type) {
      case 'metrics':
        y = this.generateMetricsSection(doc, section.content, y);
        break;
      case 'charts':
        if (options.includeCharts) {
          y = await this.generateChartSection(doc, section.content, y);
        }
        break;
      case 'tables':
        y = this.generateTableSection(doc, section.content, y);
        break;
      case 'insights':
        y = this.generateInsightsSection(doc, section.content, y);
        break;
    }

    doc.addPage();
  }

  private generateMetricsSection(doc: PDFKit.PDFDocument, metrics: MetricData[], y: number): number {
    const metricsPerRow = 2;
    const columnWidth = (doc.page.width - 100) / metricsPerRow;
    const rowHeight = 80;

    metrics.forEach((metric, index) => {
      const row = Math.floor(index / metricsPerRow);
      const col = index % metricsPerRow;
      const x = 50 + (col * columnWidth);
      const currentY = y + (row * rowHeight);

      // Metric box
      doc.rect(x, currentY, columnWidth - 20, rowHeight - 10)
         .fillColor('#ecf0f1')
         .fill();

      // Metric label
      doc.fontSize(12)
         .fillColor('#7f8c8d')
         .text(metric.label, x + 10, currentY + 10, { width: columnWidth - 40, align: 'center' });

      // Metric value
      doc.fontSize(20)
         .fillColor('#2c3e50')
         .text(metric.value.toString() + (metric.unit ? ` ${metric.unit}` : ''), 
               x + 10, currentY + 30, { width: columnWidth - 40, align: 'center' });

      // Status indicator
      if (metric.status) {
        const statusColor = metric.status === 'good' ? '#27ae60' : 
                           metric.status === 'warning' ? '#f39c12' : '#e74c3c';
        doc.circle(x + columnWidth - 30, currentY + 15, 5)
           .fillColor(statusColor)
           .fill();
      }
    });

    return y + Math.ceil(metrics.length / metricsPerRow) * rowHeight + 20;
  }

  private async generateChartSection(doc: PDFKit.PDFDocument, chartData: ChartData, y: number): Promise<number> {
    try {
      const chartBuffer = await this.chartRenderer.renderToBuffer({
        type: 'line',
        data: chartData,
        options: {
          responsive: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });

      const maxWidth = 500;
      const maxHeight = 300;
      
      doc.image(chartBuffer, 50, y, { 
        width: maxWidth, 
        height: maxHeight,
        align: 'center'
      });

      return y + maxHeight + 20;
    } catch (error) {
      console.error('Error generating chart:', error);
      doc.fontSize(12)
         .fillColor('#e74c3c')
         .text('Chart could not be generated', 50, y);
      return y + 40;
    }
  }

  private generateTableSection(doc: PDFKit.PDFDocument, tableData: TableData, y: number): number {
    const pageWidth = doc.page.width - 100;
    const columnWidth = pageWidth / tableData.headers.length;
    const rowHeight = 25;

    // Headers
    doc.fontSize(10)
       .fillColor('#2c3e50');

    tableData.headers.forEach((header, index) => {
      const x = 50 + (index * columnWidth);
      doc.rect(x, y, columnWidth, rowHeight)
         .fillColor('#34495e')
         .fill();
      
      doc.fillColor('#ffffff')
         .text(header, x + 5, y + 8, { width: columnWidth - 10, align: 'center' });
    });

    y += rowHeight;

    // Rows (limit to prevent page overflow)
    const maxRows = Math.min(tableData.rows.length, 20);
    doc.fillColor('#2c3e50');

    for (let i = 0; i < maxRows; i++) {
      const row = tableData.rows[i];
      
      row.forEach((cell, index) => {
        const x = 50 + (index * columnWidth);
        
        if (i % 2 === 0) {
          doc.rect(x, y, columnWidth, rowHeight)
             .fillColor('#ecf0f1')
             .fill();
        }
        
        doc.fillColor('#2c3e50')
           .text(cell?.toString() || '', x + 5, y + 8, { width: columnWidth - 10, align: 'center' });
      });
      
      y += rowHeight;
    }

    if (tableData.rows.length > maxRows) {
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text(`... and ${tableData.rows.length - maxRows} more rows`, 50, y + 10);
      y += 30;
    }

    return y + 20;
  }

  private generateInsightsSection(doc: PDFKit.PDFDocument, insights: any, y: number): number {
    if (insights.insights) {
      insights.insights.forEach((insight: any) => {
        const severityColor = insight.severity === 'critical' ? '#e74c3c' :
                              insight.severity === 'high' ? '#f39c12' :
                              insight.severity === 'medium' ? '#f1c40f' : '#27ae60';

        doc.fontSize(14)
           .fillColor(severityColor)
           .text(`• ${insight.title}`, 50, y);

        doc.fontSize(11)
           .fillColor('#34495e')
           .text(insight.description, 70, y + 18, { width: 480 });

        y += 50;

        if (insight.recommendations && insight.recommendations.length > 0) {
          doc.fontSize(10)
             .fillColor('#7f8c8d')
             .text('Recommendations:', 70, y);

          insight.recommendations.forEach((rec: string) => {
            doc.text(`- ${rec}`, 90, y + 15, { width: 460 });
            y += 15;
          });

          y += 10;
        }
      });
    }

    return y + 20;
  }

  private generateAppendices(doc: PDFKit.PDFDocument, report: ReportData): void {
    doc.fontSize(18)
       .fillColor('#2c3e50')
       .text('Appendices', 50, 50);

    doc.fontSize(12)
       .fillColor('#34495e')
       .text('Report Generation Details', 50, 90);

    doc.fontSize(10)
       .fillColor('#7f8c8d')
       .text(`Report ID: ${report.id}`, 70, 120)
       .text(`Generated: ${report.generatedAt.toLocaleString()}`, 70, 140)
       .text(`Template: ${report.template.name}`, 70, 160)
       .text(`Generation Time: ${report.metadata.generationTime}ms`, 70, 180);

    // Filters applied
    if (Object.keys(report.filters).length > 0) {
      doc.fontSize(12)
         .fillColor('#34495e')
         .text('Filters Applied', 50, 220);

      let y = 250;
      Object.entries(report.filters).forEach(([key, value]) => {
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text(`${key}: ${value}`, 70, y);
        y += 15;
      });
    }
  }
}