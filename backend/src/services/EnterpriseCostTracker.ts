import { db } from '../database/connection';
import {
  Budget,
  BudgetAlert,
  CostAnomaly,
  CostAttribution,
  CostPrediction,
  CloudProviderConfig,
  CloudCostData,
  EnhancedCostOptimizationRecommendation,
  FinancialReport,
  CostGovernancePolicy,
  EnterpriseOptimizationSettings,
  EnterpriseUsageAnalytics,
  EnterpriseROICalculation,
  RealTimeCostMetrics,
  EnterpriseInfrastructureCost,
  OperationalCost
} from '../types/enterpriseCostTracking';
import {
  CostData,
  ModelPricing,
  CostSummary
} from '../types/costTracking';

/**
 * Enterprise Cost Tracking and Management System
 * 
 * Provides comprehensive cost tracking, budgeting, forecasting, and optimization
 * capabilities for enterprise-grade applications.
 */
export class EnterpriseCostTracker {
  private readonly COST_ACCURACY_THRESHOLD = 0.05; // 5% accuracy requirement
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private realTimeMetricsCache: RealTimeCostMetrics | null = null;
  private lastCacheUpdate = 0;

  constructor() {
    this.initializeEnterpriseDatabase();
    this.startRealTimeMonitoring();
  }

  /**
   * Initialize enterprise database schema
   */
  private async initializeEnterpriseDatabase(): Promise<void> {
    console.log('Initializing enterprise cost tracking database...');

    try {
      // Enhanced infrastructure cost tracking
      await db.exec(`
        CREATE TABLE IF NOT EXISTS infrastructure_costs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resource_id TEXT NOT NULL,
          resource_type TEXT NOT NULL CHECK (resource_type IN ('ec2', 'rds', 'lambda', 'storage', 'network', 'container')),
          resource_name TEXT NOT NULL,
          provider TEXT NOT NULL CHECK (provider IN ('aws', 'azure', 'gcp', 'local')),
          region TEXT NOT NULL,
          cost_usd REAL NOT NULL DEFAULT 0,
          usage_amount REAL NOT NULL DEFAULT 0,
          usage_unit TEXT NOT NULL,
          billing_period_start DATETIME NOT NULL,
          billing_period_end DATETIME NOT NULL,
          workspace_id TEXT,
          team_id TEXT,
          tags TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(resource_id, billing_period_start, billing_period_end)
        )
      `);

      // Operational cost tracking
      await db.exec(`
        CREATE TABLE IF NOT EXISTS operational_costs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation_type TEXT NOT NULL CHECK (operation_type IN ('api_call', 'data_processing', 'storage_operation', 'compute_job')),
          operation_name TEXT NOT NULL,
          cost_usd REAL NOT NULL DEFAULT 0,
          duration_ms INTEGER NOT NULL,
          resource_consumption TEXT DEFAULT '{}',
          user_id TEXT,
          team_id TEXT,
          workspace_id TEXT,
          success BOOLEAN NOT NULL DEFAULT 1,
          error_details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Enhanced budgets table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
          amount REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          scope TEXT NOT NULL CHECK (scope IN ('global', 'workspace', 'team', 'user', 'resource_type')),
          scope_id TEXT,
          resource_filters TEXT DEFAULT '{}',
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          auto_reset BOOLEAN DEFAULT 0,
          rollover_unused BOOLEAN DEFAULT 0,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'deleted')),
          created_by TEXT NOT NULL,
          approved_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Enhanced budget alerts
      await db.exec(`
        CREATE TABLE IF NOT EXISTS budget_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          budget_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'forecast', 'anomaly', 'variance')),
          threshold_percentage REAL NOT NULL,
          forecast_days INTEGER,
          current_amount REAL DEFAULT 0,
          percentage_used REAL DEFAULT 0,
          projected_amount REAL,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'resolved', 'snoozed')),
          severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
          notification_channels TEXT DEFAULT '[]',
          automated_actions TEXT DEFAULT '[]',
          last_triggered DATETIME,
          snooze_until DATETIME,
          trigger_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
        )
      `);

      // Cost anomalies detection
      await db.exec(`
        CREATE TABLE IF NOT EXISTS cost_anomalies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          detection_algorithm TEXT NOT NULL CHECK (detection_algorithm IN ('statistical', 'ml_based', 'rule_based')),
          anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('spike', 'unusual_pattern', 'unexpected_cost')),
          severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
          resource_type TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          baseline_cost REAL NOT NULL,
          actual_cost REAL NOT NULL,
          deviation_percentage REAL NOT NULL,
          confidence_score REAL NOT NULL,
          root_cause_analysis TEXT,
          suggested_actions TEXT DEFAULT '[]',
          business_impact TEXT,
          detected_at DATETIME NOT NULL,
          resolved_at DATETIME,
          status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
          workspace_id TEXT,
          team_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Cost predictions and forecasting
      await db.exec(`
        CREATE TABLE IF NOT EXISTS cost_predictions (
          id TEXT PRIMARY KEY,
          forecast_type TEXT NOT NULL CHECK (forecast_type IN ('short_term', 'medium_term', 'long_term')),
          period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
          algorithm TEXT NOT NULL CHECK (algorithm IN ('linear_regression', 'arima', 'prophet', 'lstm', 'ensemble')),
          predicted_cost REAL NOT NULL,
          prediction_intervals TEXT NOT NULL,
          confidence_score REAL NOT NULL,
          model_accuracy TEXT NOT NULL,
          based_on_days INTEGER NOT NULL,
          trend_analysis TEXT NOT NULL,
          contributing_factors TEXT NOT NULL,
          scenario_analysis TEXT NOT NULL,
          recommendations TEXT DEFAULT '[]',
          forecast_generated_at DATETIME NOT NULL,
          valid_until DATETIME NOT NULL,
          workspace_id TEXT,
          team_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Cloud provider configurations
      await db.exec(`
        CREATE TABLE IF NOT EXISTS cloud_provider_configs (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL CHECK (provider IN ('aws', 'azure', 'gcp')),
          account_id TEXT NOT NULL,
          credentials TEXT NOT NULL,
          regions TEXT DEFAULT '[]',
          sync_frequency TEXT DEFAULT 'daily' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily')),
          cost_allocation_tags TEXT DEFAULT '[]',
          enabled_services TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_sync DATETIME,
          workspace_id TEXT,
          UNIQUE(provider, account_id)
        )
      `);

      // Enhanced optimization recommendations
      await db.exec(`
        CREATE TABLE IF NOT EXISTS cost_optimization_recommendations (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          detailed_analysis TEXT,
          estimated_savings REAL NOT NULL,
          estimated_savings_percentage REAL NOT NULL,
          confidence_score REAL NOT NULL,
          priority TEXT NOT NULL,
          impact TEXT NOT NULL,
          effort TEXT NOT NULL,
          action_required TEXT NOT NULL,
          implementation_steps TEXT DEFAULT '[]',
          affected_resources TEXT DEFAULT '[]',
          risk_assessment TEXT,
          business_impact TEXT,
          timeline_days INTEGER,
          auto_implementable BOOLEAN DEFAULT 0,
          metadata TEXT DEFAULT '{}',
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'implemented', 'rejected')),
          workspace_id TEXT,
          team_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Cost governance policies
      await db.exec(`
        CREATE TABLE IF NOT EXISTS cost_governance_policies (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          policy_type TEXT NOT NULL,
          rules TEXT NOT NULL,
          scope TEXT NOT NULL,
          enforcement_level TEXT NOT NULL,
          auto_remediation BOOLEAN DEFAULT 0,
          notification_settings TEXT NOT NULL,
          created_by TEXT NOT NULL,
          approved_by TEXT,
          effective_date DATETIME NOT NULL,
          expiry_date DATETIME,
          status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'expired')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create comprehensive indexes
      await this.createOptimizedIndexes();

      console.log('Enterprise cost tracking database initialized successfully');
    } catch (error) {
      console.error('Error initializing enterprise database:', error);
      throw error;
    }
  }

  /**
   * Create optimized database indexes
   */
  private async createOptimizedIndexes(): Promise<void> {
    const indexes = [
      // Infrastructure costs indexes
      'CREATE INDEX IF NOT EXISTS idx_infrastructure_costs_resource_id ON infrastructure_costs(resource_id)',
      'CREATE INDEX IF NOT EXISTS idx_infrastructure_costs_provider ON infrastructure_costs(provider)',
      'CREATE INDEX IF NOT EXISTS idx_infrastructure_costs_workspace ON infrastructure_costs(workspace_id)',
      'CREATE INDEX IF NOT EXISTS idx_infrastructure_costs_period ON infrastructure_costs(billing_period_start, billing_period_end)',
      'CREATE INDEX IF NOT EXISTS idx_infrastructure_costs_type_region ON infrastructure_costs(resource_type, region)',

      // Operational costs indexes
      'CREATE INDEX IF NOT EXISTS idx_operational_costs_operation_type ON operational_costs(operation_type)',
      'CREATE INDEX IF NOT EXISTS idx_operational_costs_workspace ON operational_costs(workspace_id)',
      'CREATE INDEX IF NOT EXISTS idx_operational_costs_user ON operational_costs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_operational_costs_created_at ON operational_costs(created_at)',

      // Budget indexes
      'CREATE INDEX IF NOT EXISTS idx_budgets_scope ON budgets(scope, scope_id)',
      'CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status)',
      'CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(start_date, end_date)',

      // Anomaly indexes
      'CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON cost_anomalies(severity)',
      'CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at ON cost_anomalies(detected_at)',
      'CREATE INDEX IF NOT EXISTS idx_anomalies_status ON cost_anomalies(status)',

      // Optimization recommendations indexes
      'CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON cost_optimization_recommendations(priority)',
      'CREATE INDEX IF NOT EXISTS idx_recommendations_status ON cost_optimization_recommendations(status)',
      'CREATE INDEX IF NOT EXISTS idx_recommendations_workspace ON cost_optimization_recommendations(workspace_id)'
    ];

    for (const indexSQL of indexes) {
      await db.exec(indexSQL);
    }
  }

  /**
   * Start real-time cost monitoring
   */
  private startRealTimeMonitoring(): void {
    setInterval(async () => {
      try {
        await this.updateRealTimeMetrics();
        await this.detectAnomalies();
        await this.checkBudgetAlerts();
      } catch (error) {
        console.error('Error in real-time monitoring:', error);
      }
    }, this.UPDATE_INTERVAL);
  }

  /**
   * Update real-time cost metrics
   */
  private async updateRealTimeMetrics(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.UPDATE_INTERVAL) {
      return; // Skip if cache is still valid
    }

    try {
      const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      // Get current spend rate (per hour)
      const recentCosts = db.prepare(`
        SELECT SUM(cost_usd) as total_cost, COUNT(*) as count
        FROM cost_tracking 
        WHERE created_at >= ?
      `).get(hourAgo);

      const currentSpendRate = recentCosts?.total_cost || 0;

      // Get projected costs
      const projectedDailyCost = currentSpendRate * 24;
      const projectedMonthlyCost = projectedDailyCost * 30;

      // Calculate cost velocity
      const previousHourCosts = db.prepare(`
        SELECT SUM(cost_usd) as total_cost
        FROM cost_tracking 
        WHERE created_at >= ? AND created_at <= ?
      `).get(new Date(now - 2 * 60 * 60 * 1000).toISOString(), hourAgo);

      const costVelocity = currentSpendRate - (previousHourCosts?.total_cost || 0);

      // Get active resources count
      const activeResources = db.prepare(`
        SELECT COUNT(DISTINCT resource_id) as count
        FROM infrastructure_costs
        WHERE billing_period_end >= ?
      `).get(new Date().toISOString());

      // Get cost breakdowns
      const costByService = this.getCostBreakdownByService(dayAgo);
      const costByRegion = this.getCostBreakdownByRegion(dayAgo);
      const costByTeam = this.getCostBreakdownByTeam(dayAgo);

      // Get anomalies count
      const anomaliesCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM cost_anomalies
        WHERE status = 'open' AND detected_at >= ?
      `).get(dayAgo);

      // Get budget utilization
      const budgetUtilization = await this.getBudgetUtilization();

      this.realTimeMetricsCache = {
        current_spend_rate: currentSpendRate,
        projected_daily_cost: projectedDailyCost,
        projected_monthly_cost: projectedMonthlyCost,
        cost_velocity: costVelocity,
        active_resources: activeResources?.count || 0,
        cost_by_service: costByService,
        cost_by_region: costByRegion,
        cost_by_team: costByTeam,
        anomalies_detected: anomaliesCount?.count || 0,
        budget_utilization: budgetUtilization,
        last_updated: new Date().toISOString()
      };

      this.lastCacheUpdate = now;
    } catch (error) {
      console.error('Error updating real-time metrics:', error);
    }
  }

  /**
   * Get cost breakdown by service
   */
  private getCostBreakdownByService(since: string): Record<string, number> {
    const results = db.prepare(`
      SELECT resource_type, SUM(cost_usd) as total_cost
      FROM infrastructure_costs
      WHERE created_at >= ?
      GROUP BY resource_type
    `).all(since);

    const breakdown: Record<string, number> = {};
    for (const result of results) {
      breakdown[result.resource_type] = result.total_cost;
    }
    return breakdown;
  }

  /**
   * Get cost breakdown by region
   */
  private getCostBreakdownByRegion(since: string): Record<string, number> {
    const results = db.prepare(`
      SELECT region, SUM(cost_usd) as total_cost
      FROM infrastructure_costs
      WHERE created_at >= ?
      GROUP BY region
    `).all(since);

    const breakdown: Record<string, number> = {};
    for (const result of results) {
      breakdown[result.region] = result.total_cost;
    }
    return breakdown;
  }

  /**
   * Get cost breakdown by team
   */
  private getCostBreakdownByTeam(since: string): Record<string, number> {
    const results = db.prepare(`
      SELECT team_id, SUM(cost_usd) as total_cost
      FROM infrastructure_costs
      WHERE created_at >= ? AND team_id IS NOT NULL
      GROUP BY team_id
    `).all(since);

    const breakdown: Record<string, number> = {};
    for (const result of results) {
      breakdown[result.team_id] = result.total_cost;
    }
    return breakdown;
  }

  /**
   * Get budget utilization
   */
  private async getBudgetUtilization(): Promise<Record<string, number>> {
    const activeBudgets = db.prepare(`
      SELECT id, name, amount, start_date, end_date, scope, scope_id
      FROM budgets
      WHERE status = 'active' AND start_date <= datetime('now') AND end_date >= datetime('now')
    `).all();

    const utilization: Record<string, number> = {};

    for (const budget of activeBudgets) {
      const currentSpend = await this.getCurrentBudgetSpend(budget);
      utilization[budget.name] = (currentSpend / budget.amount) * 100;
    }

    return utilization;
  }

  /**
   * Get current budget spend
   */
  private async getCurrentBudgetSpend(budget: any): Promise<number> {
    let query = `
      SELECT SUM(cost_usd) as total_cost
      FROM cost_tracking
      WHERE created_at >= ? AND created_at <= ?
    `;
    const params: any[] = [budget.start_date, budget.end_date];

    if (budget.scope === 'workspace' && budget.scope_id) {
      query += ` AND workspace_id = ?`;
      params.push(budget.scope_id);
    } else if (budget.scope === 'team' && budget.scope_id) {
      query += ` AND team_id = ?`;
      params.push(budget.scope_id);
    }

    const result = db.prepare(query).get(...params);
    return result?.total_cost || 0;
  }

  /**
   * Detect cost anomalies using statistical analysis
   */
  private async detectAnomalies(): Promise<CostAnomaly[]> {
    const anomalies: CostAnomaly[] = [];

    try {
      // Get recent cost data for analysis
      const recentData = db.prepare(`
        SELECT 
          resource_type,
          region,
          DATE(created_at) as date,
          SUM(cost_usd) as daily_cost
        FROM infrastructure_costs
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY resource_type, region, DATE(created_at)
        ORDER BY date DESC
      `).all();

      // Group by resource type and region
      const groupedData: Record<string, number[]> = {};
      for (const row of recentData) {
        const key = `${row.resource_type}-${row.region}`;
        if (!groupedData[key]) {
          groupedData[key] = [];
        }
        groupedData[key].push(row.daily_cost);
      }

      // Analyze each group for anomalies
      for (const [key, costs] of Object.entries(groupedData)) {
        if (costs.length < 7) continue; // Need at least 7 days of data

        const [resourceType, region] = key.split('-');
        const anomaly = this.detectStatisticalAnomaly(costs, resourceType, region);
        
        if (anomaly) {
          // Insert anomaly into database
          const insertAnomaly = db.prepare(`
            INSERT INTO cost_anomalies 
            (detection_algorithm, anomaly_type, severity, resource_type, resource_id, 
             baseline_cost, actual_cost, deviation_percentage, confidence_score, 
             root_cause_analysis, suggested_actions, business_impact, detected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const result = insertAnomaly.run(
            'statistical',
            anomaly.anomaly_type,
            anomaly.severity,
            anomaly.resource_type,
            anomaly.resource_id,
            anomaly.baseline_cost,
            anomaly.actual_cost,
            anomaly.deviation_percentage,
            anomaly.confidence_score,
            anomaly.root_cause_analysis,
            JSON.stringify(anomaly.suggested_actions),
            anomaly.business_impact,
            anomaly.detected_at
          );

          anomalies.push({
            ...anomaly,
            id: result.lastInsertRowid as number
          });
        }
      }

      return anomalies;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      return anomalies;
    }
  }

  /**
   * Detect statistical anomaly in cost data
   */
  private detectStatisticalAnomaly(costs: number[], resourceType: string, region: string): Partial<CostAnomaly> | null {
    const recent = costs.slice(0, 3); // Last 3 days
    const historical = costs.slice(3); // Previous data

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const historicalAvg = historical.reduce((a, b) => a + b, 0) / historical.length;
    const historicalStdDev = this.calculateStandardDeviation(historical);

    const zScore = Math.abs((recentAvg - historicalAvg) / historicalStdDev);
    const deviationPercentage = ((recentAvg - historicalAvg) / historicalAvg) * 100;

    // Anomaly threshold (z-score > 2 indicates anomaly)
    if (zScore > 2) {
      const severity = zScore > 3 ? 'critical' : zScore > 2.5 ? 'high' : 'medium';
      const anomalyType = recentAvg > historicalAvg ? 'spike' : 'unusual_pattern';

      return {
        anomaly_type: anomalyType,
        severity: severity as any,
        resource_type: resourceType,
        resource_id: `${resourceType}-${region}`,
        baseline_cost: historicalAvg,
        actual_cost: recentAvg,
        deviation_percentage: Math.abs(deviationPercentage),
        confidence_score: Math.min(zScore / 3 * 100, 100),
        root_cause_analysis: this.generateRootCauseAnalysis(anomalyType, deviationPercentage, resourceType),
        suggested_actions: this.generateAnomalySuggestions(anomalyType, resourceType),
        business_impact: this.assessBusinessImpact(severity as any, deviationPercentage),
        detected_at: new Date().toISOString(),
        status: 'open' as any
      };
    }

    return null;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Generate root cause analysis
   */
  private generateRootCauseAnalysis(anomalyType: string, deviation: number, resourceType: string): string {
    if (anomalyType === 'spike') {
      return `Detected ${Math.abs(deviation).toFixed(1)}% cost increase in ${resourceType} resources. ` +
             `Possible causes: increased demand, resource scaling, pricing changes, or configuration changes.`;
    } else {
      return `Unusual cost pattern detected in ${resourceType} resources with ${Math.abs(deviation).toFixed(1)}% deviation. ` +
             `Investigate recent changes in usage patterns, resource allocation, or external factors.`;
    }
  }

  /**
   * Generate anomaly suggestions
   */
  private generateAnomalySuggestions(anomalyType: string, resourceType: string): string[] {
    const suggestions = [
      'Review recent changes in resource configuration',
      'Check for increased usage or demand patterns',
      'Verify billing and pricing information',
      'Investigate potential security incidents'
    ];

    if (anomalyType === 'spike') {
      suggestions.push('Consider implementing auto-scaling policies');
      suggestions.push('Review resource rightsizing opportunities');
    }

    if (resourceType === 'compute') {
      suggestions.push('Analyze CPU and memory utilization');
      suggestions.push('Check for inefficient algorithms or processes');
    }

    return suggestions;
  }

  /**
   * Assess business impact of anomaly
   */
  private assessBusinessImpact(severity: 'low' | 'medium' | 'high' | 'critical', deviation: number): string {
    const impact = Math.abs(deviation);
    
    if (severity === 'critical') {
      return `Critical impact: ${impact.toFixed(1)}% cost deviation may significantly affect budget and operations`;
    } else if (severity === 'high') {
      return `High impact: ${impact.toFixed(1)}% cost deviation requires immediate attention`;
    } else if (severity === 'medium') {
      return `Medium impact: ${impact.toFixed(1)}% cost deviation should be monitored`;
    } else {
      return `Low impact: ${impact.toFixed(1)}% cost deviation is within acceptable range`;
    }
  }

  /**
   * Check budget alerts and trigger notifications
   */
  private async checkBudgetAlerts(): Promise<BudgetAlert[]> {
    const triggeredAlerts: BudgetAlert[] = [];

    const activeAlerts = db.prepare(`
      SELECT ba.*, b.name as budget_name, b.amount, b.start_date, b.end_date, b.scope, b.scope_id
      FROM budget_alerts ba
      JOIN budgets b ON ba.budget_id = b.id
      WHERE ba.status IN ('active', 'triggered') AND b.status = 'active'
    `).all();

    for (const alert of activeAlerts) {
      const currentSpend = await this.getCurrentBudgetSpend(alert);
      const percentageUsed = (currentSpend / alert.amount) * 100;
      
      let newStatus = alert.status;
      let shouldTrigger = false;

      if (alert.alert_type === 'threshold') {
        if (percentageUsed >= alert.threshold_percentage && alert.status === 'active') {
          newStatus = 'triggered';
          shouldTrigger = true;
        } else if (percentageUsed < alert.threshold_percentage && alert.status === 'triggered') {
          newStatus = 'resolved';
        }
      }

      // Update alert status
      db.prepare(`
        UPDATE budget_alerts
        SET current_amount = ?, percentage_used = ?, status = ?, 
            last_triggered = CASE WHEN ? THEN datetime('now') ELSE last_triggered END,
            trigger_count = trigger_count + CASE WHEN ? THEN 1 ELSE 0 END
        WHERE id = ?
      `).run(currentSpend, percentageUsed, newStatus, shouldTrigger, shouldTrigger, alert.id);

      if (shouldTrigger) {
        const updatedAlert: BudgetAlert = {
          ...alert,
          current_amount: currentSpend,
          percentage_used: percentageUsed,
          status: newStatus as any,
          last_triggered: new Date().toISOString(),
          trigger_count: alert.trigger_count + 1
        };

        triggeredAlerts.push(updatedAlert);
        await this.sendBudgetAlertNotification(updatedAlert);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Send budget alert notification
   */
  private async sendBudgetAlertNotification(alert: BudgetAlert): Promise<void> {
    // Implementation for sending notifications (email, Slack, webhook)
    console.log(`Budget Alert Triggered: ${alert.name} - ${alert.percentage_used.toFixed(1)}% used`);
    
    // TODO: Implement actual notification sending
    // - Email notifications
    // - Slack integration
    // - Webhook calls
    // - SMS alerts for critical budgets
  }

  /**
   * Create a new budget
   */
  public async createBudget(budgetData: Omit<Budget, 'id' | 'created_at' | 'updated_at'>): Promise<Budget> {
    const insertBudget = db.prepare(`
      INSERT INTO budgets (
        name, description, type, amount, currency, scope, scope_id, 
        resource_filters, start_date, end_date, auto_reset, rollover_unused,
        status, created_by, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertBudget.run(
      budgetData.name,
      budgetData.description,
      budgetData.type,
      budgetData.amount,
      budgetData.currency,
      budgetData.scope,
      budgetData.scope_id,
      JSON.stringify(budgetData.resource_filters),
      budgetData.start_date,
      budgetData.end_date,
      budgetData.auto_reset,
      budgetData.rollover_unused,
      budgetData.status,
      budgetData.created_by,
      budgetData.approved_by
    );

    const budget: Budget = {
      ...budgetData,
      id: result.lastInsertRowid as number,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return budget;
  }

  /**
   * Get real-time cost metrics
   */
  public async getRealTimeCostMetrics(): Promise<RealTimeCostMetrics> {
    if (!this.realTimeMetricsCache || Date.now() - this.lastCacheUpdate > this.UPDATE_INTERVAL) {
      await this.updateRealTimeMetrics();
    }

    return this.realTimeMetricsCache!;
  }

  /**
   * Generate cost forecast using multiple algorithms
   */
  public async generateAdvancedCostForecast(
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    algorithm: 'linear_regression' | 'arima' | 'prophet' | 'lstm' | 'ensemble' = 'ensemble'
  ): Promise<CostPrediction> {
    // Get historical data
    const historicalData = await this.getHistoricalCostData(90); // 90 days
    
    // Generate prediction based on algorithm
    const prediction = await this.runForecastingAlgorithm(algorithm, historicalData, period);
    
    // Store prediction
    const insertPrediction = db.prepare(`
      INSERT OR REPLACE INTO cost_predictions (
        id, forecast_type, period, algorithm, predicted_cost, prediction_intervals,
        confidence_score, model_accuracy, based_on_days, trend_analysis,
        contributing_factors, scenario_analysis, recommendations, 
        forecast_generated_at, valid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const predictionId = `${algorithm}-${period}-${Date.now()}`;
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // Valid for 24 hours

    insertPrediction.run(
      predictionId,
      this.getForecastType(period),
      period,
      algorithm,
      prediction.predicted_cost,
      JSON.stringify(prediction.prediction_intervals),
      prediction.confidence_score,
      JSON.stringify(prediction.model_accuracy),
      historicalData.length,
      JSON.stringify(prediction.trend_analysis),
      JSON.stringify(prediction.contributing_factors),
      JSON.stringify(prediction.scenario_analysis),
      JSON.stringify(prediction.recommendations),
      new Date().toISOString(),
      validUntil.toISOString()
    );

    return {
      ...prediction,
      id: predictionId,
      forecast_generated_at: new Date().toISOString(),
      valid_until: validUntil.toISOString()
    };
  }

  /**
   * Get historical cost data for analysis
   */
  private async getHistoricalCostData(days: number): Promise<Array<{date: string, cost: number}>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const data = db.prepare(`
      SELECT DATE(created_at) as date, SUM(cost_usd) as cost
      FROM cost_tracking
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(startDate);

    return data;
  }

  /**
   * Run forecasting algorithm
   */
  private async runForecastingAlgorithm(
    algorithm: string,
    historicalData: Array<{date: string, cost: number}>,
    period: string
  ): Promise<Partial<CostPrediction>> {
    // This is a simplified implementation - in production, you would use
    // actual ML libraries like TensorFlow.js, Prophet, or similar

    const costs = historicalData.map(d => d.cost);
    const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
    
    // Simple trend analysis
    const recentCosts = costs.slice(-7);
    const earlierCosts = costs.slice(0, 7);
    const recentAvg = recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length;
    const earlierAvg = earlierCosts.reduce((a, b) => a + b, 0) / earlierCosts.length;

    let trend: 'increasing' | 'decreasing' | 'stable' | 'volatile' = 'stable';
    if (recentAvg > earlierAvg * 1.1) {
      trend = 'increasing';
    } else if (recentAvg < earlierAvg * 0.9) {
      trend = 'decreasing';
    }

    const multiplier = this.getPeriodMultiplier(period);
    const predicted_cost = avgCost * multiplier;
    const variance = this.calculateVariance(costs);
    const confidence = Math.max(0, Math.min(100, (1 - variance / avgCost) * 100));

    return {
      predicted_cost,
      confidence_score: confidence,
      prediction_intervals: {
        lower_bound: predicted_cost * 0.8,
        upper_bound: predicted_cost * 1.2,
        confidence_level: 80
      },
      model_accuracy: {
        mape: 15, // Mock values - would be calculated from actual model
        rmse: Math.sqrt(variance),
        r_squared: confidence / 100
      },
      trend_analysis: {
        overall_trend: trend,
        trend_strength: Math.abs((recentAvg - earlierAvg) / earlierAvg),
        seasonality_detected: false,
        change_points: []
      },
      contributing_factors: [
        { factor: 'Historical usage pattern', impact_weight: 0.6, description: 'Based on recent usage trends' },
        { factor: 'Seasonal variations', impact_weight: 0.2, description: 'Account for seasonal changes' },
        { factor: 'External factors', impact_weight: 0.2, description: 'Market and business factors' }
      ],
      scenario_analysis: {
        best_case: predicted_cost * 0.8,
        worst_case: predicted_cost * 1.3,
        most_likely: predicted_cost,
        scenarios: [
          { name: 'Conservative growth', probability: 0.4, predicted_cost: predicted_cost * 0.9, assumptions: ['Stable usage', 'No major changes'] },
          { name: 'Expected growth', probability: 0.4, predicted_cost: predicted_cost, assumptions: ['Current trends continue'] },
          { name: 'Aggressive growth', probability: 0.2, predicted_cost: predicted_cost * 1.2, assumptions: ['Business expansion', 'Increased usage'] }
        ]
      },
      recommendations: [
        'Monitor cost trends closely',
        'Consider implementing cost controls',
        'Review resource utilization'
      ]
    };
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get forecast type based on period
   */
  private getForecastType(period: string): 'short_term' | 'medium_term' | 'long_term' {
    switch (period) {
      case 'daily':
      case 'weekly':
        return 'short_term';
      case 'monthly':
        return 'medium_term';
      case 'quarterly':
      case 'yearly':
        return 'long_term';
      default:
        return 'medium_term';
    }
  }

  /**
   * Get period multiplier for forecasting
   */
  private getPeriodMultiplier(period: string): number {
    switch (period) {
      case 'daily':
        return 1;
      case 'weekly':
        return 7;
      case 'monthly':
        return 30;
      case 'quarterly':
        return 90;
      case 'yearly':
        return 365;
      default:
        return 30;
    }
  }

  /**
   * Generate comprehensive cost optimization recommendations
   */
  public async generateEnhancedOptimizationRecommendations(
    workspaceId?: string,
    teamId?: string
  ): Promise<EnhancedCostOptimizationRecommendation[]> {
    const recommendations: EnhancedCostOptimizationRecommendation[] = [];

    // Analyze resource utilization
    const utilizationRecommendations = await this.analyzeResourceUtilization(workspaceId, teamId);
    recommendations.push(...utilizationRecommendations);

    // Analyze cost patterns
    const patternRecommendations = await this.analyzeCostPatterns(workspaceId, teamId);
    recommendations.push(...patternRecommendations);

    // Analyze model efficiency
    const modelRecommendations = await this.analyzeModelEfficiency(workspaceId, teamId);
    recommendations.push(...modelRecommendations);

    // Store recommendations
    for (const rec of recommendations) {
      await this.storeOptimizationRecommendation(rec);
    }

    return recommendations;
  }

  /**
   * Analyze resource utilization for optimization
   */
  private async analyzeResourceUtilization(workspaceId?: string, teamId?: string): Promise<EnhancedCostOptimizationRecommendation[]> {
    const recommendations: EnhancedCostOptimizationRecommendation[] = [];

    // Get underutilized resources
    let query = `
      SELECT resource_type, resource_id, AVG(usage_amount) as avg_usage, SUM(cost_usd) as total_cost
      FROM infrastructure_costs
      WHERE billing_period_end >= datetime('now', '-7 days')
    `;
    const params: any[] = [];

    if (workspaceId) {
      query += ` AND workspace_id = ?`;
      params.push(workspaceId);
    }
    if (teamId) {
      query += ` AND team_id = ?`;
      params.push(teamId);
    }

    query += ` GROUP BY resource_type, resource_id HAVING avg_usage < 0.5`;

    const underutilizedResources = db.prepare(query).all(...params);

    for (const resource of underutilizedResources) {
      const recommendation: EnhancedCostOptimizationRecommendation = {
        id: `rightsizing-${resource.resource_id}-${Date.now()}`,
        type: 'resource_rightsizing',
        category: 'cost_reduction',
        title: `Rightsize underutilized ${resource.resource_type}`,
        description: `Resource ${resource.resource_id} is underutilized with average usage of ${(resource.avg_usage * 100).toFixed(1)}%`,
        detailed_analysis: `Analysis shows this ${resource.resource_type} resource has been running below 50% utilization. ` +
                          `Current cost is $${resource.total_cost.toFixed(2)} per week with low usage patterns.`,
        estimated_savings: resource.total_cost * 0.4, // 40% savings from rightsizing
        estimated_savings_percentage: 40,
        confidence_score: 85,
        priority: resource.total_cost > 100 ? 'high' : 'medium',
        impact: resource.total_cost > 100 ? 'high' : 'medium',
        effort: 'low',
        action_required: 'Downsize or terminate underutilized resource',
        implementation_steps: [
          'Analyze usage patterns over the past 30 days',
          'Identify peak usage requirements',
          'Select appropriate smaller instance size',
          'Schedule downtime for resizing',
          'Monitor performance after changes'
        ],
        affected_resources: [resource.resource_id],
        risk_assessment: 'Low risk - usage patterns show consistent underutilization',
        business_impact: 'Minimal impact on performance with significant cost savings',
        timeline_days: 3,
        auto_implementable: false,
        metadata: {
          current_usage: resource.avg_usage,
          current_cost: resource.total_cost,
          resource_type: resource.resource_type
        },
        status: 'pending',
        workspace_id: workspaceId,
        team_id: teamId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Analyze cost patterns for optimization
   */
  private async analyzeCostPatterns(workspaceId?: string, teamId?: string): Promise<EnhancedCostOptimizationRecommendation[]> {
    const recommendations: EnhancedCostOptimizationRecommendation[] = [];

    // Analyze scheduling patterns
    const hourlyUsage = db.prepare(`
      SELECT strftime('%H', created_at) as hour, AVG(cost_usd) as avg_cost, COUNT(*) as count
      FROM operational_costs
      WHERE created_at >= datetime('now', '-30 days')
      ${workspaceId ? 'AND workspace_id = ?' : ''}
      ${teamId ? 'AND team_id = ?' : ''}
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `).all(...[workspaceId, teamId].filter(Boolean));

    // Find off-peak hours (low usage periods)
    const avgCost = hourlyUsage.reduce((sum, h) => sum + h.avg_cost, 0) / hourlyUsage.length;
    const lowUsageHours = hourlyUsage.filter(h => h.avg_cost < avgCost * 0.3);

    if (lowUsageHours.length >= 8) { // At least 8 hours of low usage
      const recommendation: EnhancedCostOptimizationRecommendation = {
        id: `schedule-optimization-${Date.now()}`,
        type: 'schedule_optimization',
        category: 'cost_reduction',
        title: 'Implement scheduled resource scaling',
        description: 'Detected extended periods of low resource usage that could benefit from scheduled scaling',
        detailed_analysis: `Usage analysis shows ${lowUsageHours.length} hours per day with usage below 30% of average. ` +
                          `Implementing scheduled scaling could reduce costs during these periods.`,
        estimated_savings: avgCost * 24 * 30 * 0.25, // 25% savings from scheduling
        estimated_savings_percentage: 25,
        confidence_score: 75,
        priority: 'medium',
        impact: 'medium',
        effort: 'medium',
        action_required: 'Implement automated resource scheduling',
        implementation_steps: [
          'Analyze detailed usage patterns',
          'Define scaling policies',
          'Set up automated scaling rules',
          'Test scaling policies in staging',
          'Deploy to production with monitoring'
        ],
        affected_resources: ['all-compute-resources'],
        risk_assessment: 'Medium risk - ensure adequate resources during unexpected peaks',
        business_impact: 'Positive impact with potential minor performance variations during scale-up',
        timeline_days: 14,
        auto_implementable: true,
        metadata: {
          low_usage_hours: lowUsageHours.length,
          average_cost: avgCost
        },
        status: 'pending',
        workspace_id: workspaceId,
        team_id: teamId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Analyze model efficiency for optimization
   */
  private async analyzeModelEfficiency(workspaceId?: string, teamId?: string): Promise<EnhancedCostOptimizationRecommendation[]> {
    const recommendations: EnhancedCostOptimizationRecommendation[] = [];

    // Get model usage statistics
    let query = `
      SELECT 
        model,
        AVG(cost_usd) as avg_cost,
        AVG(total_tokens) as avg_tokens,
        COUNT(*) as usage_count,
        AVG(execution_time_ms) as avg_execution_time,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate
      FROM cost_tracking ct
      LEFT JOIN test_results tr ON ct.execution_id = tr.execution_id
      WHERE ct.created_at >= datetime('now', '-30 days')
    `;
    const params: any[] = [];

    if (workspaceId) {
      query += ` AND ct.workspace_id = ?`;
      params.push(workspaceId);
    }
    if (teamId) {
      query += ` AND ct.team_id = ?`;
      params.push(teamId);
    }

    query += ` GROUP BY model HAVING usage_count > 10 ORDER BY avg_cost DESC`;

    const modelStats = db.prepare(query).all(...params);

    if (modelStats.length > 1) {
      const mostExpensive = modelStats[0];
      const mostEfficient = modelStats.reduce((min, current) => {
        const minEfficiency = min.success_rate / min.avg_cost;
        const currentEfficiency = current.success_rate / current.avg_cost;
        return currentEfficiency > minEfficiency ? current : min;
      });

      if (mostExpensive.model !== mostEfficient.model && mostExpensive.success_rate < mostEfficient.success_rate * 0.9) {
        const potentialSavings = (mostExpensive.avg_cost - mostEfficient.avg_cost) * mostExpensive.usage_count;

        const recommendation: EnhancedCostOptimizationRecommendation = {
          id: `model-optimization-${Date.now()}`,
          type: 'model_suggestion',
          category: 'cost_reduction',
          title: `Switch from ${mostExpensive.model} to ${mostEfficient.model}`,
          description: `Model ${mostEfficient.model} offers better cost-effectiveness than ${mostExpensive.model}`,
          detailed_analysis: `Analysis shows ${mostEfficient.model} has ${(mostEfficient.success_rate * 100).toFixed(1)}% success rate ` +
                            `at $${mostEfficient.avg_cost.toFixed(4)} average cost, compared to ${mostExpensive.model} with ` +
                            `${(mostExpensive.success_rate * 100).toFixed(1)}% success rate at $${mostExpensive.avg_cost.toFixed(4)} average cost.`,
          estimated_savings: potentialSavings,
          estimated_savings_percentage: ((mostExpensive.avg_cost - mostEfficient.avg_cost) / mostExpensive.avg_cost) * 100,
          confidence_score: 80,
          priority: potentialSavings > 1000 ? 'high' : 'medium',
          impact: 'high',
          effort: 'low',
          action_required: `Migrate workloads from ${mostExpensive.model} to ${mostEfficient.model}`,
          implementation_steps: [
            'Test model performance with sample workloads',
            'Compare output quality and accuracy',
            'Gradually migrate non-critical workloads',
            'Monitor performance and cost impact',
            'Complete migration if results are satisfactory'
          ],
          affected_resources: [`model-${mostExpensive.model}`],
          risk_assessment: 'Low to medium risk - validate output quality before full migration',
          business_impact: 'Positive cost impact with maintained or improved performance',
          timeline_days: 7,
          auto_implementable: false,
          metadata: {
            current_model: mostExpensive.model,
            suggested_model: mostEfficient.model,
            current_cost: mostExpensive.avg_cost,
            suggested_cost: mostEfficient.avg_cost,
            usage_count: mostExpensive.usage_count
          },
          status: 'pending',
          workspace_id: workspaceId,
          team_id: teamId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Store optimization recommendation
   */
  private async storeOptimizationRecommendation(rec: EnhancedCostOptimizationRecommendation): Promise<void> {
    const insertRec = db.prepare(`
      INSERT OR REPLACE INTO cost_optimization_recommendations (
        id, type, category, title, description, detailed_analysis,
        estimated_savings, estimated_savings_percentage, confidence_score,
        priority, impact, effort, action_required, implementation_steps,
        affected_resources, risk_assessment, business_impact, timeline_days,
        auto_implementable, metadata, status, workspace_id, team_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRec.run(
      rec.id, rec.type, rec.category, rec.title, rec.description, rec.detailed_analysis,
      rec.estimated_savings, rec.estimated_savings_percentage, rec.confidence_score,
      rec.priority, rec.impact, rec.effort, rec.action_required,
      JSON.stringify(rec.implementation_steps), JSON.stringify(rec.affected_resources),
      rec.risk_assessment, rec.business_impact, rec.timeline_days,
      rec.auto_implementable, JSON.stringify(rec.metadata), rec.status,
      rec.workspace_id, rec.team_id
    );
  }

  /**
   * Get comprehensive enterprise usage analytics
   */
  public async getEnterpriseUsageAnalytics(
    startDate: string,
    endDate: string,
    workspaceId?: string,
    teamId?: string
  ): Promise<EnterpriseUsageAnalytics> {
    // Build base queries with optional filters
    let whereClause = `WHERE created_at >= ? AND created_at <= ?`;
    const params = [startDate, endDate];

    if (workspaceId) {
      whereClause += ` AND workspace_id = ?`;
      params.push(workspaceId);
    }
    if (teamId) {
      whereClause += ` AND team_id = ?`;
      params.push(teamId);
    }

    // Get summary metrics
    const summaryQuery = `
      SELECT 
        SUM(cost_usd) as total_cost,
        SUM(total_tokens) as total_tokens,
        COUNT(*) as total_executions,
        COUNT(DISTINCT COALESCE(workspace_id, 'default')) as unique_workspaces,
        COUNT(DISTINCT COALESCE(user_id, 'unknown')) as unique_users
      FROM cost_tracking ${whereClause}
    `;

    const summary = db.prepare(summaryQuery).get(...params);

    // Get infrastructure resource count
    const resourcesQuery = `
      SELECT COUNT(DISTINCT resource_id) as total_resources
      FROM infrastructure_costs 
      WHERE billing_period_start >= ? AND billing_period_end <= ?
      ${workspaceId ? 'AND workspace_id = ?' : ''}
      ${teamId ? 'AND team_id = ?' : ''}
    `;

    const resourceParams = [startDate, endDate];
    if (workspaceId) resourceParams.push(workspaceId);
    if (teamId) resourceParams.push(teamId);

    const resourceCount = db.prepare(resourcesQuery).get(...resourceParams);

    // Get daily trends
    const trendQuery = `
      SELECT 
        DATE(created_at) as date,
        SUM(cost_usd) as cost,
        SUM(total_tokens) as tokens,
        COUNT(*) as executions,
        COUNT(DISTINCT COALESCE(user_id, 'unknown')) as unique_users
      FROM cost_tracking ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    const trends = db.prepare(trendQuery).all(...params);

    // Calculate daily metrics
    const dayCount = Math.max(1, trends.length);
    const costs = trends.map(t => t.cost);
    const peakDay = trends.reduce((max, current) => current.cost > max.cost ? current : max, trends[0] || {});
    const lowestDay = trends.reduce((min, current) => current.cost < min.cost ? current : min, trends[0] || {});

    // Calculate cost volatility (coefficient of variation)
    const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
    const variance = costs.reduce((acc, cost) => acc + Math.pow(cost - avgCost, 2), 0) / costs.length;
    const volatility = Math.sqrt(variance) / avgCost;

    // Get model breakdown
    const modelBreakdown = await this.getModelBreakdown(whereClause, params);

    // Get workspace breakdown
    const workspaceBreakdown = await this.getWorkspaceBreakdown(whereClause, params);

    // Get team breakdown
    const teamBreakdown = await this.getTeamBreakdown(whereClause, params);

    // Get resource type breakdown
    const resourceTypeBreakdown = await this.getResourceTypeBreakdown(startDate, endDate, workspaceId, teamId);

    // Get region breakdown
    const regionBreakdown = await this.getRegionBreakdown(startDate, endDate, workspaceId, teamId);

    // Calculate growth rates (simplified)
    const midPoint = Math.floor(trends.length / 2);
    const firstHalf = trends.slice(0, midPoint);
    const secondHalf = trends.slice(midPoint);

    const firstHalfAvg = firstHalf.reduce((sum, t) => sum + t.cost, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, t) => sum + t.cost, 0) / secondHalf.length;
    const costGrowthRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    return {
      period: { start: startDate, end: endDate },
      summary: {
        total_cost: summary.total_cost || 0,
        total_tokens: summary.total_tokens || 0,
        total_executions: summary.total_executions || 0,
        total_resources: resourceCount?.total_resources || 0,
        unique_users: summary.unique_users || 0,
        unique_workspaces: summary.unique_workspaces || 0
      },
      daily_metrics: {
        average_cost_per_day: (summary.total_cost || 0) / dayCount,
        average_tokens_per_day: (summary.total_tokens || 0) / dayCount,
        average_executions_per_day: (summary.total_executions || 0) / dayCount,
        peak_usage_day: peakDay?.date || startDate,
        peak_usage_cost: peakDay?.cost || 0,
        lowest_usage_day: lowestDay?.date || startDate,
        cost_volatility: volatility || 0
      },
      trends: {
        cost_trend: trends.map(t => ({
          date: t.date,
          cost: t.cost,
          tokens: t.tokens,
          executions: t.executions,
          unique_users: t.unique_users,
          resource_utilization: 0.8 // Mock value - would calculate from actual utilization data
        })),
        growth_rate: {
          cost_growth_rate: costGrowthRate,
          usage_growth_rate: costGrowthRate * 0.8, // Simplified calculation
          user_growth_rate: 5 // Mock value
        },
        seasonality: {
          daily_patterns: {},
          weekly_patterns: {},
          monthly_patterns: {}
        }
      },
      breakdowns: {
        by_model: modelBreakdown,
        by_workspace: workspaceBreakdown,
        by_team: teamBreakdown,
        by_resource_type: resourceTypeBreakdown,
        by_region: regionBreakdown
      },
      efficiency_metrics: {
        cost_per_successful_execution: 0, // Would calculate from test results
        resource_utilization_rate: 0.75, // Mock value
        idle_resource_cost: summary.total_cost * 0.1, // Estimate 10% idle cost
        optimization_opportunities: await this.generateEnhancedOptimizationRecommendations(workspaceId, teamId)
      }
    };
  }

  /**
   * Get model usage breakdown
   */
  private async getModelBreakdown(whereClause: string, params: any[]): Promise<Array<any>> {
    const query = `
      SELECT 
        model,
        SUM(cost_usd) as cost,
        SUM(total_tokens) as tokens,
        COUNT(*) as executions,
        AVG(execution_time_ms) as avg_execution_time
      FROM cost_tracking ${whereClause}
      GROUP BY model
      ORDER BY cost DESC
    `;

    const results = db.prepare(query).all(...params);
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

    return results.map(r => ({
      model: r.model,
      cost: r.cost,
      tokens: r.tokens,
      executions: r.executions,
      percentage: totalCost > 0 ? (r.cost / totalCost) * 100 : 0,
      efficiency_score: r.executions > 0 ? (r.tokens / r.cost) : 0 // Tokens per dollar
    }));
  }

  /**
   * Get workspace breakdown
   */
  private async getWorkspaceBreakdown(whereClause: string, params: any[]): Promise<Array<any>> {
    const query = `
      SELECT 
        COALESCE(workspace_id, 'unassigned') as workspace_id,
        'Workspace ' || COALESCE(workspace_id, 'Unassigned') as workspace_name,
        SUM(cost_usd) as cost,
        COUNT(DISTINCT COALESCE(user_id, 'unknown')) as user_count
      FROM cost_tracking ${whereClause}
      GROUP BY workspace_id
      ORDER BY cost DESC
    `;

    const results = db.prepare(query).all(...params);
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

    return results.map(r => ({
      workspace_id: r.workspace_id,
      workspace_name: r.workspace_name,
      cost: r.cost,
      percentage: totalCost > 0 ? (r.cost / totalCost) * 100 : 0,
      user_count: r.user_count
    }));
  }

  /**
   * Get team breakdown
   */
  private async getTeamBreakdown(whereClause: string, params: any[]): Promise<Array<any>> {
    const query = `
      SELECT 
        COALESCE(team_id, 'unassigned') as team_id,
        'Team ' || COALESCE(team_id, 'Unassigned') as team_name,
        SUM(cost_usd) as cost,
        COUNT(DISTINCT COALESCE(user_id, 'unknown')) as user_count
      FROM cost_tracking ${whereClause}
      GROUP BY team_id
      ORDER BY cost DESC
    `;

    const results = db.prepare(query).all(...params);
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

    return results.map(r => ({
      team_id: r.team_id,
      team_name: r.team_name,
      cost: r.cost,
      percentage: totalCost > 0 ? (r.cost / totalCost) * 100 : 0,
      user_count: r.user_count
    }));
  }

  /**
   * Get resource type breakdown
   */
  private async getResourceTypeBreakdown(startDate: string, endDate: string, workspaceId?: string, teamId?: string): Promise<Array<any>> {
    let query = `
      SELECT 
        resource_type,
        SUM(cost_usd) as cost,
        AVG(usage_amount) as utilization,
        COUNT(DISTINCT resource_id) as resource_count
      FROM infrastructure_costs
      WHERE billing_period_start >= ? AND billing_period_end <= ?
    `;
    const params = [startDate, endDate];

    if (workspaceId) {
      query += ` AND workspace_id = ?`;
      params.push(workspaceId);
    }
    if (teamId) {
      query += ` AND team_id = ?`;
      params.push(teamId);
    }

    query += ` GROUP BY resource_type ORDER BY cost DESC`;

    const results = db.prepare(query).all(...params);
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

    return results.map(r => ({
      resource_type: r.resource_type,
      cost: r.cost,
      percentage: totalCost > 0 ? (r.cost / totalCost) * 100 : 0,
      utilization: r.utilization,
      resource_count: r.resource_count
    }));
  }

  /**
   * Get region breakdown
   */
  private async getRegionBreakdown(startDate: string, endDate: string, workspaceId?: string, teamId?: string): Promise<Array<any>> {
    let query = `
      SELECT 
        region,
        SUM(cost_usd) as cost,
        COUNT(DISTINCT resource_id) as resource_count
      FROM infrastructure_costs
      WHERE billing_period_start >= ? AND billing_period_end <= ?
    `;
    const params = [startDate, endDate];

    if (workspaceId) {
      query += ` AND workspace_id = ?`;
      params.push(workspaceId);
    }
    if (teamId) {
      query += ` AND team_id = ?`;
      params.push(teamId);
    }

    query += ` GROUP BY region ORDER BY cost DESC`;

    const results = db.prepare(query).all(...params);
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

    return results.map(r => ({
      region: r.region,
      cost: r.cost,
      percentage: totalCost > 0 ? (r.cost / totalCost) * 100 : 0,
      resource_count: r.resource_count
    }));
  }
}

export const enterpriseCostTracker = new EnterpriseCostTracker();