// Enterprise Cost Tracking Types
// Comprehensive interfaces for advanced cost tracking and budgeting system

// Enhanced core cost tracking
export interface EnterpriseInfrastructureCost {
  id: number;
  resource_id: string;
  resource_type: 'ec2' | 'rds' | 'lambda' | 'storage' | 'network' | 'container';
  resource_name: string;
  provider: 'aws' | 'azure' | 'gcp' | 'local';
  region: string;
  cost_usd: number;
  usage_amount: number;
  usage_unit: string;
  billing_period_start: string;
  billing_period_end: string;
  workspace_id?: string;
  team_id?: string;
  tags?: Record<string, string>;
  created_at: string;
}

// Operational cost tracking
export interface OperationalCost {
  id: number;
  operation_type: 'api_call' | 'data_processing' | 'storage_operation' | 'compute_job';
  operation_name: string;
  cost_usd: number;
  duration_ms: number;
  resource_consumption: Record<string, number>;
  user_id?: string;
  team_id?: string;
  workspace_id?: string;
  success: boolean;
  error_details?: string;
  created_at: string;
}

// Enhanced budget management
export interface Budget {
  id: number;
  name: string;
  description?: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  currency: string;
  scope: 'global' | 'workspace' | 'team' | 'user' | 'resource_type';
  scope_id?: string;
  resource_filters: Record<string, any>;
  start_date: string;
  end_date: string;
  auto_reset: boolean;
  rollover_unused: boolean;
  status: 'active' | 'paused' | 'expired' | 'deleted';
  created_by: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetAlert {
  id: number;
  budget_id: number;
  name: string;
  alert_type: 'threshold' | 'forecast' | 'anomaly' | 'variance';
  threshold_percentage: number;
  forecast_days?: number;
  current_amount: number;
  percentage_used: number;
  projected_amount?: number;
  status: 'active' | 'triggered' | 'resolved' | 'snoozed';
  severity: 'info' | 'warning' | 'critical';
  notification_channels: string[]; // email, slack, webhook
  automated_actions: string[]; // throttle, suspend, approve
  last_triggered: string;
  snooze_until?: string;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

// Anomaly detection
export interface CostAnomaly {
  id: number;
  detection_algorithm: 'statistical' | 'ml_based' | 'rule_based';
  anomaly_type: 'spike' | 'unusual_pattern' | 'unexpected_cost';
  severity: 'low' | 'medium' | 'high' | 'critical';
  resource_type: string;
  resource_id: string;
  baseline_cost: number;
  actual_cost: number;
  deviation_percentage: number;
  confidence_score: number;
  root_cause_analysis: string;
  suggested_actions: string[];
  business_impact: string;
  detected_at: string;
  resolved_at?: string;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  workspace_id?: string;
  team_id?: string;
}

// Advanced cost forecasting
export interface CostPrediction {
  id: string;
  forecast_type: 'short_term' | 'medium_term' | 'long_term';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  algorithm: 'linear_regression' | 'arima' | 'prophet' | 'lstm' | 'ensemble';
  predicted_cost: number;
  prediction_intervals: {
    lower_bound: number;
    upper_bound: number;
    confidence_level: number;
  };
  confidence_score: number;
  model_accuracy: {
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
    r_squared: number;
  };
  based_on_days: number;
  trend_analysis: {
    overall_trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    trend_strength: number;
    seasonality_detected: boolean;
    change_points: Array<{
      date: string;
      change_magnitude: number;
      reason: string;
    }>;
  };
  contributing_factors: Array<{
    factor: string;
    impact_weight: number;
    description: string;
  }>;
  scenario_analysis: {
    best_case: number;
    worst_case: number;
    most_likely: number;
    scenarios: Array<{
      name: string;
      probability: number;
      predicted_cost: number;
      assumptions: string[];
    }>;
  };
  recommendations: string[];
  forecast_generated_at: string;
  valid_until: string;
  workspace_id?: string;
  team_id?: string;
}

// Multi-tenant cost attribution
export interface CostAttribution {
  workspace_id: string;
  workspace_name: string;
  team_id: string;
  team_name: string;
  user_id: string;
  user_name: string;
  cost_breakdown: {
    compute: number;
    storage: number;
    network: number;
    api_calls: number;
    other: number;
  };
  allocation_method: 'direct' | 'proportional' | 'activity_based';
  allocation_percentage: number;
  billing_period: string;
  tags: Record<string, string>;
}

// Real-time cost monitoring
export interface RealTimeCostMetrics {
  current_spend_rate: number; // per hour
  projected_daily_cost: number;
  projected_monthly_cost: number;
  cost_velocity: number; // rate of change
  active_resources: number;
  cost_by_service: Record<string, number>;
  cost_by_region: Record<string, number>;
  cost_by_team: Record<string, number>;
  anomalies_detected: number;
  budget_utilization: Record<string, number>;
  last_updated: string;
}

// Cloud provider integration interfaces
export interface CloudProviderConfig {
  id: string;
  provider: 'aws' | 'azure' | 'gcp';
  account_id: string;
  credentials: {
    access_key?: string;
    secret_key?: string;
    subscription_id?: string;
    tenant_id?: string;
    project_id?: string;
    service_account_key?: string;
  };
  regions: string[];
  sync_frequency: 'realtime' | 'hourly' | 'daily';
  cost_allocation_tags: string[];
  enabled_services: string[];
  created_at: string;
  updated_at: string;
  last_sync: string;
  workspace_id?: string;
}

export interface CloudCostData {
  provider: 'aws' | 'azure' | 'gcp';
  account_id: string;
  service_name: string;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  region: string;
  cost_usd: number;
  usage_quantity: number;
  usage_unit: string;
  billing_period: string;
  tags: Record<string, string>;
  raw_data: Record<string, any>;
  imported_at: string;
}

// Enhanced optimization recommendations
export interface EnhancedCostOptimizationRecommendation {
  id: string;
  type: 'model_suggestion' | 'prompt_optimization' | 'token_reduction' | 'execution_reduction' | 'resource_rightsizing' | 'schedule_optimization' | 'auto_scaling';
  category: 'cost_reduction' | 'performance_improvement' | 'resource_efficiency';
  title: string;
  description: string;
  detailed_analysis: string;
  estimated_savings: number;
  estimated_savings_percentage: number;
  confidence_score: number; // 0-100
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  action_required: string;
  implementation_steps: string[];
  affected_resources: string[];
  risk_assessment: string;
  business_impact: string;
  timeline_days: number;
  auto_implementable: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'approved' | 'implemented' | 'rejected';
  workspace_id?: string;
  team_id?: string;
}

// Financial reporting interfaces
export interface FinancialReport {
  id: string;
  report_type: 'cost_summary' | 'budget_analysis' | 'forecast' | 'optimization' | 'chargeback';
  title: string;
  description: string;
  period: {
    start: string;
    end: string;
  };
  scope: {
    workspaces: string[];
    teams: string[];
    users: string[];
    resource_types: string[];
  };
  data: Record<string, any>;
  visualizations: Array<{
    type: 'chart' | 'table' | 'metric';
    title: string;
    data: any;
    config: any;
  }>;
  export_formats: string[];
  scheduled: boolean;
  schedule_config?: {
    frequency: string;
    recipients: string[];
    delivery_method: string;
  };
  created_by: string;
  created_at: string;
  updated_at: string;
  generated_at: string;
}

// Compliance and governance
export interface CostGovernancePolicy {
  id: string;
  name: string;
  description: string;
  policy_type: 'budget_limit' | 'approval_workflow' | 'cost_allocation' | 'resource_quota';
  rules: Array<{
    condition: string;
    action: string;
    parameters: Record<string, any>;
  }>;
  scope: {
    workspaces: string[];
    teams: string[];
    resource_types: string[];
  };
  enforcement_level: 'advisory' | 'preventive' | 'detective';
  auto_remediation: boolean;
  notification_settings: {
    channels: string[];
    recipients: string[];
    escalation_rules: Array<{
      condition: string;
      delay_minutes: number;
      recipients: string[];
    }>;
  };
  created_by: string;
  approved_by: string;
  effective_date: string;
  expiry_date?: string;
  status: 'draft' | 'active' | 'suspended' | 'expired';
  created_at: string;
  updated_at: string;
}

// Enhanced optimization settings
export interface EnterpriseOptimizationSettings {
  id: string;
  workspace_id?: string;
  team_id?: string;
  enable_auto_optimization: boolean;
  cost_threshold: number;
  token_threshold: number;
  model_preferences: string[];
  prompt_optimization: boolean;
  batching_enabled: boolean;
  caching_enabled: boolean;
  auto_scaling_enabled: boolean;
  rightsizing_enabled: boolean;
  schedule_optimization_enabled: boolean;
  anomaly_detection_enabled: boolean;
  notification_settings: {
    email_alerts: boolean;
    slack_integration: boolean;
    webhook_url?: string;
    alert_frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  };
  optimization_schedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time_of_day: string;
    timezone: string;
  };
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  compliance_requirements: string[];
  exclusion_rules: {
    resource_types: string[];
    tags: Record<string, string>;
    critical_workloads: string[];
  };
  created_at: string;
  updated_at: string;
}

// Comprehensive usage analytics
export interface EnterpriseUsageAnalytics {
  period: {
    start: string;
    end: string;
  };
  summary: {
    total_cost: number;
    total_tokens: number;
    total_executions: number;
    total_resources: number;
    unique_users: number;
    unique_workspaces: number;
  };
  daily_metrics: {
    average_cost_per_day: number;
    average_tokens_per_day: number;
    average_executions_per_day: number;
    peak_usage_day: string;
    peak_usage_cost: number;
    lowest_usage_day: string;
    cost_volatility: number;
  };
  trends: {
    cost_trend: Array<{
      date: string;
      cost: number;
      tokens: number;
      executions: number;
      unique_users: number;
      resource_utilization: number;
    }>;
    growth_rate: {
      cost_growth_rate: number;
      usage_growth_rate: number;
      user_growth_rate: number;
    };
    seasonality: {
      daily_patterns: Record<string, number>;
      weekly_patterns: Record<string, number>;
      monthly_patterns: Record<string, number>;
    };
  };
  breakdowns: {
    by_model: Array<{
      model: string;
      cost: number;
      tokens: number;
      executions: number;
      percentage: number;
      efficiency_score: number;
    }>;
    by_workspace: Array<{
      workspace_id: string;
      workspace_name: string;
      cost: number;
      percentage: number;
      user_count: number;
    }>;
    by_team: Array<{
      team_id: string;
      team_name: string;
      cost: number;
      percentage: number;
      user_count: number;
    }>;
    by_resource_type: Array<{
      resource_type: string;
      cost: number;
      percentage: number;
      utilization: number;
    }>;
    by_region: Array<{
      region: string;
      cost: number;
      percentage: number;
      resource_count: number;
    }>;
  };
  efficiency_metrics: {
    cost_per_successful_execution: number;
    resource_utilization_rate: number;
    idle_resource_cost: number;
    optimization_opportunities: EnhancedCostOptimizationRecommendation[];
  };
}

// Advanced ROI calculation
export interface EnterpriseROICalculation {
  period: {
    start: string;
    end: string;
  };
  total_cost: number;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  average_cost_per_success: number;
  success_rate: number;
  cost_efficiency: number;
  value_generated: number; // Business value metrics
  cost_per_value_unit: number;
  productivity_metrics: {
    tasks_completed: number;
    time_saved_hours: number;
    automation_rate: number;
  };
  comparison_metrics: {
    previous_period_cost: number;
    cost_change_percentage: number;
    efficiency_improvement: number;
  };
  recommendations: EnhancedCostOptimizationRecommendation[];
  workspace_id?: string;
  team_id?: string;
}