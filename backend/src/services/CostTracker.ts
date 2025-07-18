import { db } from '../database/connection';
import {
  CostData,
  ModelPricing,
  CostSummary,
  CostOptimizationRecommendation,
  BudgetAlert,
  CostPrediction,
  UsageAnalytics,
  CostOptimizationSettings,
  ROICalculation
} from '../types/costTracking';

/**
 * Comprehensive Cost Tracking Service
 * Tracks token usage, calculates costs, provides optimization recommendations
 */
export class CostTracker {
  private modelPricing: Map<string, ModelPricing> = new Map();
  private optimizationSettings: CostOptimizationSettings;

  constructor() {
    this.optimizationSettings = {
      enableAutoOptimization: true,
      costThreshold: 10.0, // $10 threshold
      tokenThreshold: 100000, // 100k tokens
      modelPreferences: ['gpt-3.5-turbo', 'llama3'], // Preferred models for cost optimization
      promptOptimization: true,
      batchingEnabled: true,
      cachingEnabled: true
    };
    
    this.initializePricing();
  }


  /**
   * Initialize model pricing data
   */
  private initializePricing(): void {
    const defaultPricing: ModelPricing[] = [
      {
        model: 'gpt-4',
        prompt_token_cost: 0.03, // $0.03 per 1k tokens
        completion_token_cost: 0.06, // $0.06 per 1k tokens
        context_window: 8192,
        last_updated: new Date().toISOString()
      },
      {
        model: 'gpt-4-turbo',
        prompt_token_cost: 0.01, // $0.01 per 1k tokens
        completion_token_cost: 0.03, // $0.03 per 1k tokens
        context_window: 128000,
        last_updated: new Date().toISOString()
      },
      {
        model: 'gpt-3.5-turbo',
        prompt_token_cost: 0.0015, // $0.0015 per 1k tokens
        completion_token_cost: 0.002, // $0.002 per 1k tokens
        context_window: 16385,
        last_updated: new Date().toISOString()
      },
      {
        model: 'llama3',
        prompt_token_cost: 0.0, // Open source - no cost
        completion_token_cost: 0.0,
        context_window: 8192,
        last_updated: new Date().toISOString()
      },
      {
        model: 'claude-3-sonnet',
        prompt_token_cost: 0.003, // $0.003 per 1k tokens
        completion_token_cost: 0.015, // $0.015 per 1k tokens
        context_window: 200000,
        last_updated: new Date().toISOString()
      }
    ];

    // Insert default pricing into database
    const insertPricing = db.prepare(`
      INSERT OR REPLACE INTO model_pricing 
      (model, prompt_token_cost, completion_token_cost, context_window, last_updated)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const pricing of defaultPricing) {
      insertPricing.run(
        pricing.model,
        pricing.prompt_token_cost,
        pricing.completion_token_cost,
        pricing.context_window,
        pricing.last_updated
      );
      this.modelPricing.set(pricing.model, pricing);
    }

    console.log('Model pricing initialized');
  }

  /**
   * Track token usage and calculate cost for an execution
   */
  public async trackUsage(
    executionId: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    executionTimeMs: number,
    testCaseId?: number,
    promptCardId?: number
  ): Promise<CostData> {
    const totalTokens = promptTokens + completionTokens;
    const cost = this.calculateCost(model, promptTokens, completionTokens);

    const insertCost = db.prepare(`
      INSERT INTO cost_tracking 
      (execution_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, execution_time_ms, test_case_id, prompt_card_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertCost.run(
      executionId,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      executionTimeMs,
      testCaseId,
      promptCardId
    );

    const costData: CostData = {
      id: result.lastInsertRowid as number,
      execution_id: executionId,
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_usd: cost,
      execution_time_ms: executionTimeMs,
      test_case_id: testCaseId,
      prompt_card_id: promptCardId,
      created_at: new Date().toISOString()
    };

    // Check budget alerts
    await this.checkBudgetAlerts();

    return costData;
  }

  /**
   * Calculate cost for given token usage
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.modelPricing.get(model);
    if (!pricing) {
      console.warn(`No pricing found for model: ${model}, assuming zero cost`);
      return 0;
    }

    const promptCost = (promptTokens / 1000) * pricing.prompt_token_cost;
    const completionCost = (completionTokens / 1000) * pricing.completion_token_cost;
    return promptCost + completionCost;
  }

  /**
   * Get cost summary for a given time period
   */
  public async getCostSummary(
    startDate?: string,
    endDate?: string,
    promptCardId?: number
  ): Promise<CostSummary> {
    let query = `
      SELECT 
        model,
        SUM(cost_usd) as total_cost,
        SUM(total_tokens) as total_tokens,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        COUNT(*) as total_executions
      FROM cost_tracking
      WHERE 1=1
    `;

    const params: any[] = [];

    if (startDate) {
      query += ` AND created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= ?`;
      params.push(endDate);
    }

    if (promptCardId) {
      query += ` AND prompt_card_id = ?`;
      params.push(promptCardId);
    }

    query += ` GROUP BY model`;

    const results = db.prepare(query).all(...params);

    const costByModel: Record<string, number> = {};
    const tokensByModel: Record<string, number> = {};
    const executionsByModel: Record<string, number> = {};

    let totalCost = 0;
    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalExecutions = 0;

    for (const result of results) {
      const model = result.model;
      const cost = result.total_cost;
      const tokens = result.total_tokens;
      const executions = result.total_executions;

      costByModel[model] = cost;
      tokensByModel[model] = tokens;
      executionsByModel[model] = executions;

      totalCost += cost;
      totalTokens += tokens;
      totalPromptTokens += result.total_prompt_tokens;
      totalCompletionTokens += result.total_completion_tokens;
      totalExecutions += executions;
    }

    return {
      totalCost,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalExecutions,
      averageCostPerExecution: totalExecutions > 0 ? totalCost / totalExecutions : 0,
      averageTokensPerExecution: totalExecutions > 0 ? totalTokens / totalExecutions : 0,
      costByModel,
      tokensByModel,
      executionsByModel
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  public async generateOptimizationRecommendations(
    startDate?: string,
    endDate?: string
  ): Promise<CostOptimizationRecommendation[]> {
    const recommendations: CostOptimizationRecommendation[] = [];
    const summary = await this.getCostSummary(startDate, endDate);

    // Model optimization recommendations
    const sortedModels = Object.entries(summary.costByModel)
      .sort(([,a], [,b]) => b - a);

    if (sortedModels.length > 1) {
      const mostExpensiveModel = sortedModels[0][0];
      const mostExpensiveCost = sortedModels[0][1];
      const cheapestModel = sortedModels[sortedModels.length - 1][0];
      const cheapestCost = sortedModels[sortedModels.length - 1][1];

      if (mostExpensiveCost > cheapestCost * 2) {
        recommendations.push({
          type: 'model_suggestion',
          title: `Consider switching from ${mostExpensiveModel} to ${cheapestModel}`,
          description: `${mostExpensiveModel} accounts for $${mostExpensiveCost.toFixed(2)} of your costs. Consider using ${cheapestModel} for appropriate tasks.`,
          estimatedSavings: mostExpensiveCost - cheapestCost,
          estimatedSavingsPercentage: ((mostExpensiveCost - cheapestCost) / mostExpensiveCost) * 100,
          priority: 'high',
          actionRequired: `Review test cases using ${mostExpensiveModel} and evaluate if ${cheapestModel} would be sufficient.`,
          metadata: {
            currentModel: mostExpensiveModel,
            suggestedModel: cheapestModel,
            currentCost: mostExpensiveCost,
            suggestedCost: cheapestCost
          }
        });
      }
    }

    // High token usage recommendations
    if (summary.averageTokensPerExecution > 2000) {
      recommendations.push({
        type: 'token_reduction',
        title: 'High token usage detected',
        description: `Average token usage is ${summary.averageTokensPerExecution.toFixed(0)} tokens per execution. Consider optimizing prompts.`,
        estimatedSavings: summary.totalCost * 0.3, // Estimate 30% savings
        estimatedSavingsPercentage: 30,
        priority: 'medium',
        actionRequired: 'Review and optimize prompt templates to reduce token usage.',
        metadata: {
          averageTokens: summary.averageTokensPerExecution,
          totalTokens: summary.totalTokens
        }
      });
    }

    // Execution frequency recommendations
    if (summary.totalExecutions > 1000) {
      recommendations.push({
        type: 'execution_reduction',
        title: 'High execution frequency',
        description: `${summary.totalExecutions} executions recorded. Consider implementing caching or batching.`,
        estimatedSavings: summary.totalCost * 0.2, // Estimate 20% savings
        estimatedSavingsPercentage: 20,
        priority: 'low',
        actionRequired: 'Implement result caching and batch processing for similar test cases.',
        metadata: {
          totalExecutions: summary.totalExecutions,
          avgCostPerExecution: summary.averageCostPerExecution
        }
      });
    }

    return recommendations;
  }

  /**
   * Create or update budget alert
   */
  public async createBudgetAlert(
    name: string,
    type: 'daily' | 'weekly' | 'monthly' | 'total',
    threshold: number
  ): Promise<BudgetAlert> {
    const insertAlert = db.prepare(`
      INSERT INTO budget_alerts (name, type, threshold)
      VALUES (?, ?, ?)
    `);

    const result = insertAlert.run(name, type, threshold);
    
    return {
      id: result.lastInsertRowid as number,
      name,
      type,
      threshold,
      current_amount: 0,
      percentage_used: 0,
      status: 'active',
      created_at: new Date().toISOString()
    };
  }

  /**
   * Check budget alerts and update their status
   */
  public async checkBudgetAlerts(): Promise<BudgetAlert[]> {
    const alerts = db.prepare(`
      SELECT * FROM budget_alerts WHERE status IN ('active', 'triggered')
    `).all();

    const triggeredAlerts: BudgetAlert[] = [];

    for (const alert of alerts) {
      const currentAmount = await this.getCurrentSpendingForAlert(alert.type);
      const percentageUsed = (currentAmount / alert.threshold) * 100;

      let newStatus = alert.status;
      if (percentageUsed >= 100) {
        newStatus = 'exceeded';
      } else if (percentageUsed >= 80) {
        newStatus = 'triggered';
      }

      // Update alert with current amounts
      db.prepare(`
        UPDATE budget_alerts 
        SET current_amount = ?, percentage_used = ?, status = ?
        WHERE id = ?
      `).run(currentAmount, percentageUsed, newStatus, alert.id);

      if (newStatus !== alert.status) {
        triggeredAlerts.push({
          ...alert,
          current_amount: currentAmount,
          percentage_used: percentageUsed,
          status: newStatus as any
        });
      }
    }

    return triggeredAlerts;
  }

  /**
   * Get current spending for alert period
   */
  private async getCurrentSpendingForAlert(type: string): Promise<number> {
    let startDate: string;
    const now = new Date();

    switch (type) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart.toISOString();
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
      case 'total':
        startDate = '1970-01-01T00:00:00.000Z';
        break;
      default:
        return 0;
    }

    const result = db.prepare(`
      SELECT SUM(cost_usd) as total_cost 
      FROM cost_tracking 
      WHERE created_at >= ?
    `).get(startDate);

    return result?.total_cost || 0;
  }

  /**
   * Generate cost predictions based on historical data
   */
  public async generateCostPrediction(
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<CostPrediction> {
    const days = period === 'daily' ? 7 : period === 'weekly' ? 28 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const historicalData = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(cost_usd) as daily_cost,
        SUM(total_tokens) as daily_tokens,
        COUNT(*) as daily_executions
      FROM cost_tracking
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(startDate.toISOString());

    if (historicalData.length < 3) {
      return {
        period,
        predictedCost: 0,
        confidence: 0,
        basedOnDays: historicalData.length,
        trend: 'stable',
        factors: ['Insufficient historical data']
      };
    }

    const costs = historicalData.map(d => d.daily_cost);
    const avgDailyCost = costs.reduce((a, b) => a + b, 0) / costs.length;
    
    // Simple trend analysis
    const recentCosts = costs.slice(-7);
    const earlierCosts = costs.slice(0, 7);
    const recentAvg = recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length;
    const earlierAvg = earlierCosts.reduce((a, b) => a + b, 0) / earlierCosts.length;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentAvg > earlierAvg * 1.1) {
      trend = 'increasing';
    } else if (recentAvg < earlierAvg * 0.9) {
      trend = 'decreasing';
    }

    const multiplier = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const predictedCost = avgDailyCost * multiplier;

    return {
      period,
      predictedCost,
      confidence: Math.min(historicalData.length / 30, 1), // Higher confidence with more data
      basedOnDays: historicalData.length,
      trend,
      factors: [
        `Based on ${historicalData.length} days of historical data`,
        `Average daily cost: $${avgDailyCost.toFixed(2)}`,
        `Trend: ${trend}`
      ]
    };
  }

  /**
   * Get usage analytics for a time period
   */
  public async getUsageAnalytics(
    startDate: string,
    endDate: string
  ): Promise<UsageAnalytics> {
    const summary = await this.getCostSummary(startDate, endDate);
    
    // Get daily trend data
    const trendData = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(cost_usd) as cost,
        SUM(total_tokens) as tokens,
        COUNT(*) as executions
      FROM cost_tracking
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(startDate, endDate);

    const dayCount = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)));
    
    // Find peak usage day
    const peakDay = trendData.reduce((max, day) => 
      day.cost > max.cost ? day : max, 
      trendData[0] || { date: startDate, cost: 0, tokens: 0, executions: 0 }
    );

    // Model usage breakdown
    const modelUsage = Object.entries(summary.costByModel).map(([model, cost]) => ({
      model,
      cost,
      tokens: summary.tokensByModel[model] || 0,
      executions: summary.executionsByModel[model] || 0,
      percentage: (cost / summary.totalCost) * 100
    })).sort((a, b) => b.cost - a.cost);

    return {
      period: {
        start: startDate,
        end: endDate
      },
      totalCost: summary.totalCost,
      totalTokens: summary.totalTokens,
      totalExecutions: summary.totalExecutions,
      averageCostPerDay: summary.totalCost / dayCount,
      averageTokensPerDay: summary.totalTokens / dayCount,
      averageExecutionsPerDay: summary.totalExecutions / dayCount,
      peakUsageDay: peakDay.date,
      peakUsageCost: peakDay.cost,
      costTrend: trendData.map(d => ({
        date: d.date,
        cost: d.cost,
        tokens: d.tokens,
        executions: d.executions
      })),
      modelUsage
    };
  }

  /**
   * Calculate ROI for test executions
   */
  public async calculateROI(
    startDate?: string,
    endDate?: string,
    promptCardId?: number
  ): Promise<ROICalculation> {
    const summary = await this.getCostSummary(startDate, endDate, promptCardId);
    
    // Get success/failure statistics
    let query = `
      SELECT 
        COUNT(*) as total_executions,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as successful_executions,
        SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failed_executions
      FROM test_results tr
      JOIN cost_tracking ct ON tr.execution_id = ct.execution_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (startDate) {
      query += ` AND ct.created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND ct.created_at <= ?`;
      params.push(endDate);
    }

    if (promptCardId) {
      query += ` AND ct.prompt_card_id = ?`;
      params.push(promptCardId);
    }

    const result = db.prepare(query).get(...params);
    
    const totalExecutions = result?.total_executions || 0;
    const successfulExecutions = result?.successful_executions || 0;
    const failedExecutions = result?.failed_executions || 0;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    const averageCostPerSuccess = successfulExecutions > 0 ? summary.totalCost / successfulExecutions : 0;
    const costEfficiency = summary.totalCost > 0 ? (successfulExecutions / summary.totalCost) * 100 : 0;

    const recommendations = await this.generateOptimizationRecommendations(startDate, endDate);

    return {
      totalCost: summary.totalCost,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageCostPerSuccess,
      successRate,
      costEfficiency,
      recommendations
    };
  }

  /**
   * Get all budget alerts
   */
  public async getBudgetAlerts(): Promise<BudgetAlert[]> {
    return db.prepare(`
      SELECT * FROM budget_alerts ORDER BY created_at DESC
    `).all();
  }

  /**
   * Update optimization settings
   */
  public async updateOptimizationSettings(settings: Partial<CostOptimizationSettings>): Promise<void> {
    this.optimizationSettings = { ...this.optimizationSettings, ...settings };
    
    db.prepare(`
      INSERT OR REPLACE INTO cost_optimization_settings 
      (id, enable_auto_optimization, cost_threshold, token_threshold, model_preferences, 
       prompt_optimization, batching_enabled, caching_enabled, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      settings.enableAutoOptimization ?? this.optimizationSettings.enableAutoOptimization,
      settings.costThreshold ?? this.optimizationSettings.costThreshold,
      settings.tokenThreshold ?? this.optimizationSettings.tokenThreshold,
      JSON.stringify(settings.modelPreferences ?? this.optimizationSettings.modelPreferences),
      settings.promptOptimization ?? this.optimizationSettings.promptOptimization,
      settings.batchingEnabled ?? this.optimizationSettings.batchingEnabled,
      settings.cachingEnabled ?? this.optimizationSettings.cachingEnabled
    );
  }

  /**
   * Get optimization settings
   */
  public getOptimizationSettings(): CostOptimizationSettings {
    return this.optimizationSettings;
  }
}

export const costTracker = new CostTracker();