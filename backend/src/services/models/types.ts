export interface ModelInfo {
  name: string;
  size: number;
  format: string;
  modified_at: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface ModelMetrics {
  modelName: string;
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  tokensPerSecond: number;
  lastUpdated: Date;
  totalRequests: number;
  failedRequests: number;
  averageTokens: number;
  peakMemoryUsage: number;
  cpuUsage: number;
}

export interface ModelHealthStatus {
  modelName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastHealthCheck: Date;
  responseTime: number;
  errorCount: number;
  healthScore: number; // 0-100
  issues: string[];
  uptime: number;
}

export interface ModelBenchmarkResult {
  modelName: string;
  testName: string;
  averageResponseTime: number;
  throughput: number;
  accuracy: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  testDate: Date;
  sampleSize: number;
  configuration: Record<string, any>;
}

export interface ModelPerformanceConfig {
  healthCheckInterval: number;
  benchmarkInterval: number;
  maxResponseTime: number;
  maxErrorRate: number;
  minHealthScore: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
  };
}

export interface ModelSelectionCriteria {
  maxResponseTime?: number;
  minAccuracy?: number;
  maxMemoryUsage?: number;
  preferredModels?: string[];
  taskType?: 'general' | 'coding' | 'creative' | 'analytical';
  complexityLevel?: 'simple' | 'moderate' | 'complex';
}

export interface ModelRecommendation {
  modelName: string;
  confidence: number;
  reasons: string[];
  estimatedPerformance: {
    responseTime: number;
    accuracy: number;
    resourceUsage: number;
  };
}

export interface ModelSwitchContext {
  currentModel: string;
  targetModel: string;
  preserveContext?: boolean;
  warmupPrompts?: string[];
  rollbackConditions?: {
    maxErrors: number;
    maxResponseTime: number;
    timeoutMinutes: number;
  };
}

export interface ModelLoadStatus {
  modelName: string;
  status: 'loading' | 'loaded' | 'failed' | 'unloaded';
  loadTime: number;
  memoryUsage: number;
  readyForRequests: boolean;
  lastActivity: Date;
}

export interface ModelCapabilities {
  modelName: string;
  maxTokens: number;
  supportedFormats: string[];
  languages: string[];
  specializations: string[];
  contextWindow: number;
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  supportsCodeGeneration: boolean;
  supportsImageProcessing: boolean;
}

export interface ModelComparison {
  models: string[];
  metrics: {
    responseTime: Record<string, number>;
    accuracy: Record<string, number>;
    resourceUsage: Record<string, number>;
    reliability: Record<string, number>;
  };
  recommendations: string[];
  bestForTasks: Record<string, string[]>;
}