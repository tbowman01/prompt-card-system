export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'executive' | 'detailed' | 'cost' | 'performance' | 'custom';
  fields: ReportField[];
  defaultFilters: Record<string, any>;
  supportedFormats: ('pdf' | 'excel' | 'json' | 'csv')[];
  customizable: boolean;
}

export interface ReportField {
  key: string;
  label: string;
  type: 'metric' | 'chart' | 'table' | 'text' | 'insight';
  required: boolean;
  description?: string;
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  promptCardId?: number;
  model?: string;
  status?: 'passed' | 'failed' | 'all';
  tags?: string[];
  costThreshold?: number;
  performanceThreshold?: number;
}

export interface ReportData {
  id: string;
  template: ReportTemplate;
  title: string;
  description: string;
  generatedAt: Date;
  filters: ReportFilters;
  sections: ReportSection[];
  summary: ReportSummary;
  metadata: {
    totalExecutions: number;
    totalCost: number;
    averagePerformance: number;
    successRate: number;
    generationTime: number;
  };
}

export interface ReportSection {
  id: string;
  title: string;
  description?: string;
  type: 'metrics' | 'charts' | 'tables' | 'insights' | 'recommendations';
  content: any;
  order: number;
}

export interface ReportSummary {
  keyMetrics: Array<{
    label: string;
    value: number | string;
    trend?: 'up' | 'down' | 'stable';
    trendPercentage?: number;
  }>;
  insights: Array<{
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  }>;
  totalPages?: number;
  generationTime: number;
}

export interface ReportExportOptions {
  format: 'pdf' | 'excel' | 'json' | 'csv';
  includeCharts: boolean;
  includeRawData: boolean;
  compression?: boolean;
  password?: string;
  customizations?: {
    logo?: string;
    theme?: 'light' | 'dark' | 'corporate';
    colors?: Record<string, string>;
  };
}

export interface ReportGenerationProgress {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  totalSteps: number;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export interface ReportSchedule {
  id: string;
  name: string;
  templateId: string;
  filters: ReportFilters;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  format: 'pdf' | 'excel';
  nextExecution: Date;
  lastExecution?: Date;
  enabled: boolean;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    type?: 'line' | 'bar' | 'pie' | 'area';
  }>;
  options?: {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    plugins?: any;
    scales?: any;
  };
}

export interface TableData {
  headers: string[];
  rows: any[][];
  totalRows: number;
  sortable: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface MetricData {
  value: number | string;
  label: string;
  unit?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  target?: number;
  status?: 'good' | 'warning' | 'critical';
}