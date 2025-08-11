export interface ReportData {
  id: string;
  title: string;
  description?: string;
  dateRange: {
    start: string;
    end: string;
  };
  generatedAt: string;
  generatedBy?: string;
  totalPromptCards: number;
  totalTestCases: number;
  totalTestExecutions: number;
  overallStats: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
  };
  promptCardStats: PromptCardStats[];
  testExecutionTrends: ExecutionTrend[];
  modelPerformance: ModelPerformance[];
  assertionTypeStats: AssertionTypeStats[];
  detailedResults?: any[]; // TestExecutionResult[] imported below
}

export interface PromptCardStats {
  id: number;
  title: string;
  description?: string;
  testCaseCount: number;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
  averageExecutionTime: number;
  lastExecuted?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionTrend {
  date: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  averageExecutionTime: number;
}

export interface ModelPerformance {
  model: string;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
  averageExecutionTime: number;
  averageTokenUsage?: number;
  costEstimate?: number;
}

export interface AssertionTypeStats {
  type: string;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  passRate: number;
  averageExecutionTime: number;
}

export interface ReportConfig {
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'html';
  template?: string;
  includeCharts?: boolean;
  includeExecutiveSummary?: boolean;
  includeDetailedResults?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: {
    promptCardIds?: number[];
    models?: string[];
    assertionTypes?: string[];
    passedOnly?: boolean;
    failedOnly?: boolean;
  };
  customization?: {
    brandLogo?: string;
    brandColors?: {
      primary: string;
      secondary: string;
      accent: string;
    };
    companyName?: string;
    reportTitle?: string;
  };
  scheduling?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time?: string;
    recipients?: string[];
  };
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'html';
  sections: ReportSection[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportSection {
  id: string;
  name: string;
  type: 'summary' | 'chart' | 'table' | 'text' | 'image';
  config: Record<string, any>;
  order: number;
  enabled: boolean;
}

export interface GenerateReportRequest {
  config: ReportConfig;
  templateId?: string;
  async?: boolean;
}

export interface GenerateReportResponse {
  reportId: string;
  format: string;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  filePath?: string;
  error?: string;
  generatedAt?: string;
  fileSize?: number;
}

export interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  config: ReportConfig;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    timezone?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  recipients: string[];
  enabled: boolean;
  lastGenerated?: string;
  nextGeneration?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportJob {
  id: string;
  type: 'generate' | 'schedule';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  config: ReportConfig;
  progress: number;
  error?: string;
  result?: GenerateReportResponse;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    type?: 'line' | 'bar' | 'pie' | 'doughnut';
  }[];
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  title: string;
  width: number;
  height: number;
  data: ChartData;
  options?: Record<string, any>;
}

// Re-export existing types for convenience
export type { 
  TestResult, 
  TestExecutionResult, 
  BatchExecutionResult, 
  AssertionResult 
} from './testExecution';

export type { 
  PromptCard, 
  PromptCardWithTestCases 
} from './promptCard';

export type { 
  TestCase, 
  AssertionType 
} from './testCase';