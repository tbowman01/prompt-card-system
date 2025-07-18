export interface CostData {
  id: number;
  execution_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  execution_time_ms: number;
  test_case_id?: number;
  prompt_card_id?: number;
  created_at: string;
}

export interface ModelPricing {
  model: string;
  prompt_token_cost: number; // Cost per 1k tokens
  completion_token_cost: number; // Cost per 1k tokens
  context_window: number;
  last_updated: string;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalExecutions: number;
  averageCostPerExecution: number;
  averageTokensPerExecution: number;
  costByModel: Record<string, number>;
  tokensByModel: Record<string, number>;
  executionsByModel: Record<string, number>;
}

export interface CostOptimizationRecommendation {
  type: 'model_suggestion' | 'prompt_optimization' | 'token_reduction' | 'execution_reduction';
  title: string;
  description: string;
  estimatedSavings: number;
  estimatedSavingsPercentage: number;
  priority: 'low' | 'medium' | 'high';
  actionRequired: string;
  metadata?: Record<string, any>;
}

export interface BudgetAlert {
  id: number;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'total';
  threshold: number;
  current_amount: number;
  percentage_used: number;
  status: 'active' | 'triggered' | 'exceeded';
  created_at: string;
  triggered_at?: string;
}

export interface CostPrediction {
  period: 'daily' | 'weekly' | 'monthly';
  predictedCost: number;
  confidence: number;
  basedOnDays: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  factors: string[];
}

export interface UsageAnalytics {
  period: {
    start: string;
    end: string;
  };
  totalCost: number;
  totalTokens: number;
  totalExecutions: number;
  averageCostPerDay: number;
  averageTokensPerDay: number;
  averageExecutionsPerDay: number;
  peakUsageDay: string;
  peakUsageCost: number;
  costTrend: Array<{
    date: string;
    cost: number;
    tokens: number;
    executions: number;
  }>;
  modelUsage: Array<{
    model: string;
    cost: number;
    tokens: number;
    executions: number;
    percentage: number;
  }>;
}

export interface CostOptimizationSettings {
  enableAutoOptimization: boolean;
  costThreshold: number;
  tokenThreshold: number;
  modelPreferences: string[];
  promptOptimization: boolean;
  batchingEnabled: boolean;
  cachingEnabled: boolean;
}

export interface ROICalculation {
  totalCost: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageCostPerSuccess: number;
  successRate: number;
  costEfficiency: number;
  recommendations: CostOptimizationRecommendation[];
}