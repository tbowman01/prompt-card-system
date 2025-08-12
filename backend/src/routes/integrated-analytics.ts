import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { performance } from 'perf_hooks';

const router = Router();

// Rate limiting for analytics endpoints
const analyticsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per minute
  message: { error: 'Too many analytics requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

interface IntegratedMetrics {
  ai_performance: {
    total_optimizations: number;
    success_rate: number;
    average_improvement: number;
    cost_savings_generated: number;
  };
  cost_efficiency: {
    current_monthly_spend: number;
    projected_savings: number;
    optimization_roi: number;
    cost_per_optimization: number;
  };
  system_performance: {
    average_response_time: number;
    throughput_ops_per_second: number;
    error_rate: number;
    uptime_percentage: number;
  };
  user_satisfaction: {
    satisfaction_score: number;
    completion_rate: number;
    user_retention: number;
    feedback_sentiment: number;
  };
}

interface OptimizationImpact {
  time_period: string;
  ai_optimizations: number;
  cost_reduction: number;
  performance_gain: number;
  user_satisfaction: number;
  cumulative_savings: number;
}

interface AlertSummary {
  id: string;
  type: 'cost_spike' | 'performance_degradation' | 'optimization_opportunity' | 'budget_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  potential_impact: number;
  recommended_action: string;
  created_at: string;
}

/**
 * @route   GET /api/analytics/integrated-metrics
 * @desc    Get comprehensive integrated metrics combining AI performance and cost data
 * @access  Public
 */
router.get('/integrated-metrics',
  analyticsRateLimit,
  [
    query('period').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid period'),
    query('workspace_id').optional().isString(),
    query('team_id').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      const { period = '24h', workspace_id, team_id } = req.query;

      // In a real implementation, this would fetch from multiple data sources
      // and aggregate AI optimization metrics with cost data
      const integratedMetrics: IntegratedMetrics = await calculateIntegratedMetrics({
        period: period as string,
        workspace_id: workspace_id as string,
        team_id: team_id as string
      });

      const processingTime = performance.now() - startTime;

      res.json({
        success: true,
        data: integratedMetrics,
        metadata: {
          processing_time_ms: Math.round(processingTime),
          period,
          timestamp: new Date().toISOString(),
          data_sources: ['ai_optimizer', 'cost_tracker', 'performance_monitor']
        }
      });

    } catch (error) {
      console.error('Integrated metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve integrated metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /api/analytics/optimization-impact
 * @desc    Get optimization impact data over time
 * @access  Public
 */
router.get('/optimization-impact',
  analyticsRateLimit,
  [
    query('timeframe').optional().isIn(['week', 'month', 'quarter']).withMessage('Invalid timeframe'),
    query('granularity').optional().isIn(['hour', 'day', 'week']).withMessage('Invalid granularity')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      const { timeframe = 'month', granularity = 'week' } = req.query;

      const impactData: OptimizationImpact[] = await getOptimizationImpact({
        timeframe: timeframe as string,
        granularity: granularity as string
      });

      const processingTime = performance.now() - startTime;

      // Calculate trend analysis
      const trendAnalysis = {
        cost_savings_trend: calculateTrend(impactData.map(d => d.cost_reduction)),
        performance_trend: calculateTrend(impactData.map(d => d.performance_gain)),
        satisfaction_trend: calculateTrend(impactData.map(d => d.user_satisfaction))
      };

      res.json({
        success: true,
        data: impactData,
        analytics: {
          trend_analysis: trendAnalysis,
          total_periods: impactData.length,
          total_savings: impactData.reduce((sum, d) => sum + d.cost_reduction, 0),
          average_performance_gain: impactData.reduce((sum, d) => sum + d.performance_gain, 0) / impactData.length
        },
        metadata: {
          processing_time_ms: Math.round(processingTime),
          timeframe,
          granularity,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Optimization impact error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve optimization impact data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /api/analytics/alert-summary
 * @desc    Get current alerts and recommendations
 * @access  Public
 */
router.get('/alert-summary',
  analyticsRateLimit,
  [
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { severity, limit = 20 } = req.query;

      const alerts: AlertSummary[] = await getCurrentAlerts({
        severity: severity as string,
        limit: parseInt(limit as string)
      });

      // Categorize alerts
      const alertStats = {
        total: alerts.length,
        by_severity: {
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        },
        by_type: alerts.reduce((acc: Record<string, number>, alert) => {
          acc[alert.type] = (acc[alert.type] || 0) + 1;
          return acc;
        }, {}),
        total_potential_impact: alerts.reduce((sum, alert) => sum + alert.potential_impact, 0)
      };

      res.json({
        success: true,
        data: alerts,
        statistics: alertStats,
        metadata: {
          timestamp: new Date().toISOString(),
          filters_applied: { severity, limit }
        }
      });

    } catch (error) {
      console.error('Alert summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /api/analytics/cost-optimization-correlation
 * @desc    Analyze correlation between AI optimizations and cost savings
 * @access  Public
 */
router.get('/cost-optimization-correlation',
  analyticsRateLimit,
  async (req: Request, res: Response) => {
    try {
      const correlationData = await analyzeCostOptimizationCorrelation();

      res.json({
        success: true,
        data: correlationData,
        metadata: {
          timestamp: new Date().toISOString(),
          analysis_type: 'correlation'
        }
      });

    } catch (error) {
      console.error('Correlation analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze cost-optimization correlation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /api/analytics/generate-insight
 * @desc    Generate AI-powered insights from integrated data
 * @access  Public
 */
router.post('/generate-insight',
  analyticsRateLimit,
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      const insight = await generateAIInsight();
      const processingTime = performance.now() - startTime;

      res.json({
        success: true,
        data: insight,
        metadata: {
          processing_time_ms: Math.round(processingTime),
          timestamp: new Date().toISOString(),
          insight_version: '1.0'
        }
      });

    } catch (error) {
      console.error('AI insight generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate AI insight',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Helper functions
async function calculateIntegratedMetrics(params: {
  period: string;
  workspace_id?: string;
  team_id?: string;
}): Promise<IntegratedMetrics> {
  // Mock implementation - in production this would aggregate real data
  // from AI optimization engine, cost tracking system, and performance monitors
  
  const baseMetrics = {
    ai_performance: {
      total_optimizations: 12847 + Math.floor(Math.random() * 1000),
      success_rate: 94.2 + (Math.random() - 0.5) * 2,
      average_improvement: 32.5 + (Math.random() - 0.5) * 5,
      cost_savings_generated: 18750.50 + Math.random() * 2000
    },
    cost_efficiency: {
      current_monthly_spend: 45230.75 + Math.random() * 5000,
      projected_savings: 8945.25 + Math.random() * 1000,
      optimization_roi: 4.8 + (Math.random() - 0.5) * 0.5,
      cost_per_optimization: 2.35 + (Math.random() - 0.5) * 0.5
    },
    system_performance: {
      average_response_time: 85 + Math.floor(Math.random() * 20),
      throughput_ops_per_second: 847 + Math.floor(Math.random() * 100),
      error_rate: 0.3 + (Math.random() - 0.5) * 0.2,
      uptime_percentage: 99.8 + (Math.random() - 0.5) * 0.3
    },
    user_satisfaction: {
      satisfaction_score: 91.5 + (Math.random() - 0.5) * 3,
      completion_rate: 87.3 + (Math.random() - 0.5) * 5,
      user_retention: 92.1 + (Math.random() - 0.5) * 2,
      feedback_sentiment: 85.7 + (Math.random() - 0.5) * 4
    }
  };

  return baseMetrics;
}

async function getOptimizationImpact(params: {
  timeframe: string;
  granularity: string;
}): Promise<OptimizationImpact[]> {
  // Mock time series data generation
  const periods = params.granularity === 'day' ? 30 : 4; // 30 days or 4 weeks
  const data: OptimizationImpact[] = [];
  
  let cumulativeSavings = 0;
  
  for (let i = 0; i < periods; i++) {
    const periodSavings = 3000 + Math.random() * 3000;
    cumulativeSavings += periodSavings;
    
    data.push({
      time_period: params.granularity === 'day' 
        ? `Day ${i + 1}` 
        : `Week ${i + 1}`,
      ai_optimizations: 2800 + Math.floor(Math.random() * 800),
      cost_reduction: periodSavings,
      performance_gain: 28 + Math.floor(Math.random() * 15),
      user_satisfaction: 85 + Math.floor(Math.random() * 10),
      cumulative_savings: cumulativeSavings
    });
  }
  
  return data;
}

async function getCurrentAlerts(params: {
  severity?: string;
  limit: number;
}): Promise<AlertSummary[]> {
  // Mock alert generation based on current system state
  const alerts: AlertSummary[] = [
    {
      id: '1',
      type: 'cost_spike',
      severity: 'high',
      title: 'Unusual cost increase detected',
      description: 'GPU usage has increased 45% in the last hour due to increased model inference requests',
      potential_impact: 2850,
      recommended_action: 'Review recent model deployments and consider implementing auto-scaling to manage costs',
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      type: 'optimization_opportunity',
      severity: 'medium',
      title: 'High-impact optimization available',
      description: 'Analysis shows 68% of current GPT-4 requests could use GPT-3.5-turbo with minimal quality impact',
      potential_impact: 1240,
      recommended_action: 'Implement intelligent model routing based on prompt complexity analysis',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      type: 'performance_degradation',
      severity: 'low',
      title: 'Edge node latency increase',
      description: 'Asia-Pacific edge nodes showing 15ms average latency increase over baseline',
      potential_impact: 0,
      recommended_action: 'Monitor regional performance metrics and consider traffic rebalancing',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '4',
      type: 'budget_alert',
      severity: 'critical',
      title: 'Monthly budget threshold exceeded',
      description: 'Current spend has exceeded 95% of monthly budget with 8 days remaining in billing cycle',
      potential_impact: 5600,
      recommended_action: 'Implement cost controls and review high-usage resources immediately',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ];

  let filteredAlerts = alerts;
  
  if (params.severity) {
    filteredAlerts = alerts.filter(alert => alert.severity === params.severity);
  }

  return filteredAlerts.slice(0, params.limit);
}

async function analyzeCostOptimizationCorrelation() {
  // Mock correlation analysis
  return {
    correlation_coefficient: 0.87, // Strong positive correlation
    confidence_interval: { lower: 0.82, upper: 0.91 },
    analysis: {
      optimization_impact: 'Each AI optimization results in average 2.3% cost reduction',
      roi_analysis: 'ROI improves 15% when AI optimizations exceed 100 per day',
      efficiency_patterns: [
        'Prompt optimization shows highest ROI (4.8x)',
        'Model selection optimization provides consistent 25% savings',
        'Batch processing reduces costs by 35% on average'
      ]
    },
    recommendations: [
      'Increase focus on prompt optimization for maximum ROI',
      'Implement automated model selection for consistent savings',
      'Scale batch processing capabilities to handle more workloads'
    ]
  };
}

async function generateAIInsight() {
  // Mock AI-generated insight
  return {
    insight_id: `insight_${Date.now()}`,
    title: 'Optimization Performance Accelerating',
    summary: 'AI optimization system is showing accelerating returns with 23% improvement in efficiency over the past week',
    details: {
      key_findings: [
        'Response time optimizations are yielding 32% better results than previous month',
        'Cost per optimization has decreased by 18% due to improved algorithms',
        'User satisfaction scores correlate strongly (r=0.89) with optimization frequency'
      ],
      trend_analysis: 'Upward trending performance suggests optimization algorithms are learning effectively',
      confidence_score: 0.94
    },
    action_items: [
      'Scale optimization frequency to maintain momentum',
      'Investigate opportunity to apply similar patterns to other domains',
      'Consider increasing AI optimization budget allocation'
    ],
    generated_at: new Date().toISOString()
  };
}

function calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 2) return 'stable';
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.ceil(values.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  const percentageChange = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (percentageChange > 5) return 'increasing';
  if (percentageChange < -5) return 'decreasing';
  return 'stable';
}

export default router;