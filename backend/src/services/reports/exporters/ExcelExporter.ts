import * as ExcelJS from 'exceljs';
import { ReportData, ReportExportOptions, ChartData, TableData, MetricData } from '../../../types/reports';
import { ChartConfiguration, ChartData as ChartJSData } from 'chart.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

export class ExcelExporter {
  private chartRenderer: ChartJSNodeCanvas;
  private static readonly CHART_WIDTH = 800;
  private static readonly CHART_HEIGHT = 400;

  constructor() {
    this.chartRenderer = new ChartJSNodeCanvas({
      width: ExcelExporter.CHART_WIDTH,
      height: ExcelExporter.CHART_HEIGHT,
      backgroundColour: 'white'
    });
  }

  async exportToExcel(
    report: ReportData,
    options: ReportExportOptions = { format: 'excel', includeCharts: true, includeRawData: true }
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = 'Prompt Card System';
    workbook.lastModifiedBy = 'Prompt Card System';
    workbook.created = report.generatedAt;
    workbook.modified = new Date();
    workbook.lastPrinted = new Date();

    // Add worksheets
    await this.addSummaryWorksheet(workbook, report, options);
    await this.addMetricsWorksheet(workbook, report, options);
    
    if (options.includeCharts) {
      await this.addChartsWorksheet(workbook, report, options);
    }

    await this.addDataWorksheet(workbook, report, options);

    if (options.includeRawData) {
      await this.addRawDataWorksheet(workbook, report, options);
    }

    // Apply theme
    if (options.customizations?.theme) {
      this.applyTheme(workbook, options.customizations.theme);
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async addSummaryWorksheet(workbook: ExcelJS.Workbook, report: ReportData, options: ReportExportOptions): Promise<void> {
    const worksheet = workbook.addWorksheet('Summary');
    
    // Title
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = report.title;
    titleCell.font = { size: 18, bold: true, color: { argb: '2c3e50' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ecf0f1' } };
    worksheet.getRow(1).height = 30;

    // Description
    worksheet.mergeCells('A2:F2');
    const descCell = worksheet.getCell('A2');
    descCell.value = report.description;
    descCell.font = { size: 12, italic: true };
    descCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    // Generation info
    worksheet.mergeCells('A3:F3');
    const infoCell = worksheet.getCell('A3');
    infoCell.value = `Generated on: ${report.generatedAt.toLocaleDateString()} at ${report.generatedAt.toLocaleTimeString()}`;
    infoCell.font = { size: 10 };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Key metrics header
    worksheet.mergeCells('A5:F5');
    const metricsHeaderCell = worksheet.getCell('A5');
    metricsHeaderCell.value = 'Key Performance Indicators';
    metricsHeaderCell.font = { size: 14, bold: true };
    metricsHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    metricsHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3498db' } };
    metricsHeaderCell.font.color = { argb: 'ffffff' };

    // Key metrics
    const row = 7;
    report.summary.keyMetrics.forEach((metric, index) => {
      const col = (index % 3) * 2 + 1; // A, C, E columns
      const metricRow = Math.floor(index / 3) + row;

      // Metric label
      const labelCell = worksheet.getCell(metricRow, col);
      labelCell.value = metric.label;
      labelCell.font = { bold: true };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };

      // Metric value
      const valueCell = worksheet.getCell(metricRow, col + 1);
      valueCell.value = metric.value;
      valueCell.font = { size: 12, bold: true };
      valueCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // Add trend indicator if available
      if (metric.trend) {
        const trendSymbol = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';
        const trendColor = metric.trend === 'up' ? '27ae60' : metric.trend === 'down' ? 'e74c3c' : '95a5a6';
        valueCell.value = `${metric.value} ${trendSymbol}`;
        valueCell.font.color = { argb: trendColor };
      }

      // Style the cells
      labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      valueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Insights section
    const insightsStartRow = row + Math.ceil(report.summary.keyMetrics.length / 3) + 2;
    worksheet.mergeCells(`A${insightsStartRow}:F${insightsStartRow}`);
    const insightsHeaderCell = worksheet.getCell(`A${insightsStartRow}`);
    insightsHeaderCell.value = 'Key Insights';
    insightsHeaderCell.font = { size: 14, bold: true };
    insightsHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    insightsHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'e74c3c' } };
    insightsHeaderCell.font.color = { argb: 'ffffff' };

    let insightRow = insightsStartRow + 2;
    report.summary.insights.slice(0, 5).forEach((insight, index) => {
      // Insight title
      worksheet.mergeCells(`A${insightRow}:F${insightRow}`);
      const titleCell = worksheet.getCell(`A${insightRow}`);
      titleCell.value = `${index + 1}. ${insight.title}`;
      titleCell.font = { bold: true };
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      
      // Severity indicator
      const severityColor = insight.severity === 'critical' ? 'e74c3c' :
                            insight.severity === 'high' ? 'f39c12' :
                            insight.severity === 'medium' ? 'f1c40f' : '27ae60';
      titleCell.font.color = { argb: severityColor };

      // Insight description
      insightRow++;
      worksheet.mergeCells(`A${insightRow}:F${insightRow}`);
      const descCell = worksheet.getCell(`A${insightRow}`);
      descCell.value = insight.description;
      descCell.font = { size: 10 };
      descCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      worksheet.getRow(insightRow).height = 30;

      insightRow += 2;
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 20;
    });
  }

  private async addMetricsWorksheet(workbook: ExcelJS.Workbook, report: ReportData, options: ReportExportOptions): Promise<void> {
    const worksheet = workbook.addWorksheet('Detailed Metrics');
    
    // Title
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Detailed Performance Metrics';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3498db' } };
    titleCell.font.color = { argb: 'ffffff' };
    worksheet.getRow(1).height = 25;

    let row = 3;

    // Process each section that contains metrics
    for (const section of report.sections.filter(s => s.type === 'metrics')) {
      // Section header
      worksheet.mergeCells(`A${row}:D${row}`);
      const headerCell = worksheet.getCell(`A${row}`);
      headerCell.value = section.title;
      headerCell.font = { size: 14, bold: true };
      headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '34495e' } };
      headerCell.font.color = { argb: 'ffffff' };

      row += 2;

      // Metrics table header
      ['Metric', 'Value', 'Unit', 'Status'].forEach((header, index) => {
        const cell = worksheet.getCell(row, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '95a5a6' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      row++;

      // Metrics data
      const metrics = section.content as MetricData[];
      metrics.forEach(metric => {
        const values = [metric.label, metric.value, metric.unit || '-', metric.status || '-'];
        values.forEach((value, index) => {
          const cell = worksheet.getCell(row, index + 1);
          cell.value = value;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          
          // Color code status
          if (index === 3 && metric.status) {
            const statusColor = metric.status === 'good' ? '27ae60' : 
                               metric.status === 'warning' ? 'f39c12' : 'e74c3c';
            cell.font = { color: { argb: statusColor }, bold: true };
          }
        });
        row++;
      });

      row += 2;
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 20;
    });
  }

  private async addChartsWorksheet(workbook: ExcelJS.Workbook, report: ReportData, options: ReportExportOptions): Promise<void> {
    const worksheet = workbook.addWorksheet('Charts');
    
    // Title
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Visual Analytics';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '9b59b6' } };
    titleCell.font.color = { argb: 'ffffff' };
    worksheet.getRow(1).height = 25;

    let row = 3;

    // Process each section that contains charts
    for (const section of report.sections.filter(s => s.type === 'charts')) {
      // Section header
      worksheet.mergeCells(`A${row}:H${row}`);
      const headerCell = worksheet.getCell(`A${row}`);
      headerCell.value = section.title;
      headerCell.font = { size: 14, bold: true };
      headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '34495e' } };
      headerCell.font.color = { argb: 'ffffff' };

      row += 2;

      try {
        // Generate chart image
        const chartData = section.content as ChartData;
        const chartConfig: ChartConfiguration = {
          type: 'line',
          data: {
            labels: chartData.labels,
            datasets: chartData.datasets.map(dataset => ({
              label: dataset.label,
              data: dataset.data,
              backgroundColor: dataset.backgroundColor,
              borderColor: dataset.borderColor,
              borderWidth: dataset.borderWidth
            }))
          },
        };
        const chartBuffer = await this.chartRenderer.renderToBuffer(chartConfig);

        // Add chart as image
        const imageId = workbook.addImage({
          buffer: chartBuffer,
          extension: 'png',
        });

        worksheet.addImage(imageId, {
          tl: { col: 0, row: row - 1, nativeCol: 0, nativeColOff: 0, nativeRow: 0, nativeRowOff: 0 } as any,
          br: { col: 7, row: row + 19, nativeCol: 0, nativeColOff: 0, nativeRow: 0, nativeRowOff: 0 } as any
        });

        // Add chart data table
        const dataStartRow = row + 22;
        
        // Data table header
        ['Label', ...chartData.datasets.map(d => d.label || 'Dataset')].forEach((header, index) => {
          const cell = worksheet.getCell(dataStartRow, index + 1);
          cell.value = header;
          cell.font = { bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '95a5a6' } };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Data table rows
        chartData.labels.forEach((label, labelIndex) => {
          const rowIndex = dataStartRow + labelIndex + 1;
          const cell = worksheet.getCell(rowIndex, 1);
          cell.value = label;
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

          chartData.datasets.forEach((dataset, datasetIndex) => {
            const dataCell = worksheet.getCell(rowIndex, datasetIndex + 2);
            dataCell.value = dataset.data[labelIndex] || 0;
            dataCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          });
        });

        row = dataStartRow + chartData.labels.length + 4;
      } catch (error) {
        console.error('Error generating chart for Excel:', error);
        worksheet.getCell(`A${row}`).value = 'Chart generation failed';
        row += 2;
      }
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  private async addDataWorksheet(workbook: ExcelJS.Workbook, report: ReportData, options: ReportExportOptions): Promise<void> {
    const worksheet = workbook.addWorksheet('Data Tables');
    
    // Title
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Data Tables';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16a085' } };
    titleCell.font.color = { argb: 'ffffff' };
    worksheet.getRow(1).height = 25;

    let row = 3;

    // Process each section that contains tables
    for (const section of report.sections.filter(s => s.type === 'tables')) {
      // Section header
      worksheet.mergeCells(`A${row}:J${row}`);
      const headerCell = worksheet.getCell(`A${row}`);
      headerCell.value = section.title;
      headerCell.font = { size: 14, bold: true };
      headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '34495e' } };
      headerCell.font.color = { argb: 'ffffff' };

      row += 2;

      const tableData = section.content as TableData;

      // Table headers
      tableData.headers.forEach((header, index) => {
        const cell = worksheet.getCell(row, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '95a5a6' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      row++;

      // Table data
      tableData.rows.forEach((rowData, rowIndex) => {
        rowData.forEach((cellData, colIndex) => {
          const cell = worksheet.getCell(row, colIndex + 1);
          cell.value = cellData;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          
          // Alternate row colors
          if (rowIndex % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8f9fa' } };
          }
        });
        row++;
      });

      row += 2;
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  private async addRawDataWorksheet(workbook: ExcelJS.Workbook, report: ReportData, options: ReportExportOptions): Promise<void> {
    const worksheet = workbook.addWorksheet('Raw Data');
    
    // Title
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Raw Report Data';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7f8c8d' } };
    titleCell.font.color = { argb: 'ffffff' };
    worksheet.getRow(1).height = 25;

    let row = 3;

    // Report metadata
    const metadata = [
      ['Report ID', report.id],
      ['Template', report.template.name],
      ['Generated', report.generatedAt.toISOString()],
      ['Total Executions', report.metadata.totalExecutions],
      ['Total Cost', `$${report.metadata.totalCost.toFixed(2)}`],
      ['Average Performance', `${report.metadata.averagePerformance.toFixed(2)}ms`],
      ['Success Rate', `${report.metadata.successRate.toFixed(1)}%`],
      ['Generation Time', `${report.metadata.generationTime}ms`]
    ];

    // Metadata header
    worksheet.mergeCells(`A${row}:F${row}`);
    const metadataHeaderCell = worksheet.getCell(`A${row}`);
    metadataHeaderCell.value = 'Report Metadata';
    metadataHeaderCell.font = { size: 14, bold: true };
    metadataHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    metadataHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '34495e' } };
    metadataHeaderCell.font.color = { argb: 'ffffff' };

    row += 2;

    // Metadata table
    metadata.forEach(([key, value]) => {
      worksheet.getCell(row, 1).value = key;
      worksheet.getCell(row, 2).value = value;
      worksheet.getCell(row, 1).font = { bold: true };
      worksheet.getCell(row, 1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      worksheet.getCell(row, 2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      row++;
    });

    row += 2;

    // Filters applied
    if (Object.keys(report.filters).length > 0) {
      worksheet.mergeCells(`A${row}:F${row}`);
      const filtersHeaderCell = worksheet.getCell(`A${row}`);
      filtersHeaderCell.value = 'Filters Applied';
      filtersHeaderCell.font = { size: 14, bold: true };
      filtersHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
      filtersHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '34495e' } };
      filtersHeaderCell.font.color = { argb: 'ffffff' };

      row += 2;

      Object.entries(report.filters).forEach(([key, value]) => {
        worksheet.getCell(row, 1).value = key;
        worksheet.getCell(row, 2).value = value?.toString() || '';
        worksheet.getCell(row, 1).font = { bold: true };
        worksheet.getCell(row, 1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        worksheet.getCell(row, 2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        row++;
      });
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 25;
    });
  }

  private applyTheme(workbook: ExcelJS.Workbook, theme: 'light' | 'dark' | 'corporate'): void {
    const themes = {
      light: {
        primary: '3498db',
        secondary: 'ecf0f1',
        accent: '2ecc71',
        text: '2c3e50'
      },
      dark: {
        primary: '34495e',
        secondary: '2c3e50',
        accent: 'e74c3c',
        text: 'ecf0f1'
      },
      corporate: {
        primary: '2c3e50',
        secondary: '95a5a6',
        accent: '3498db',
        text: '2c3e50'
      }
    };

    const colors = themes[theme] || themes.light;
    
    // Apply theme colors to all worksheets
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell) => {
            if (cell.fill && cell.fill.type === 'pattern') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
            }
          });
        }
      });
    });
  }
}