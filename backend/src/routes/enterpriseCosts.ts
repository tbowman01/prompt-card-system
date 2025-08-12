import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { enterpriseCostTracker } from '../services/EnterpriseCostTracker';
import { cloudProviderIntegration } from '../services/CloudProviderIntegration';
import {
  Budget,
  BudgetAlert,
  CloudProviderConfig,
  EnhancedCostOptimizationRecommendation,
  CostPrediction,
  EnterpriseUsageAnalytics,
  RealTimeCostMetrics
} from '../types/enterpriseCostTracking';

const router = express.Router();

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

/**
 * GET /api/enterprise-costs/real-time-metrics
 * Get real-time cost metrics dashboard
 */
router.get('/real-time-metrics',
  query('workspace_id').optional().isString(),
  query('team_id').optional().isString(),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const metrics = await enterpriseCostTracker.getRealTimeCostMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch real-time metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/enterprise-costs/analytics
 * Get comprehensive usage analytics
 */
router.get('/analytics',
  query('start_date').isISO8601().withMessage('Invalid start date format'),
  query('end_date').isISO8601().withMessage('Invalid end date format'),
  query('workspace_id').optional().isString(),
  query('team_id').optional().isString(),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { start_date, end_date, workspace_id, team_id } = req.query;
      
      const analytics = await enterpriseCostTracker.getEnterpriseUsageAnalytics(
        start_date as string,
        end_date as string,
        workspace_id as string,
        team_id as string
      );
      
      res.json({
        success: true,
        data: analytics,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/enterprise-costs/forecast
 * Generate cost forecast
 */
router.post('/forecast',
  body('period').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).withMessage('Invalid period'),
  body('algorithm').optional().isIn(['linear_regression', 'arima', 'prophet', 'lstm', 'ensemble']),
  body('workspace_id').optional().isString(),
  body('team_id').optional().isString(),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { period, algorithm = 'ensemble' } = req.body;
      
      const forecast = await enterpriseCostTracker.generateAdvancedCostForecast(period, algorithm);
      
      res.json({
        success: true,
        data: forecast,
        message: 'Cost forecast generated successfully'
      });
    } catch (error) {
      console.error('Error generating forecast:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate cost forecast',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/enterprise-costs/recommendations
 * Get cost optimization recommendations
 */
router.get('/recommendations',
  query('workspace_id').optional().isString(),
  query('team_id').optional().isString(),
  query('status').optional().isIn(['pending', 'approved', 'implemented', 'rejected']),
  query('priority').optional().isIn(['critical', 'high', 'medium', 'low']),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { workspace_id, team_id, status, priority } = req.query;
      
      const recommendations = await enterpriseCostTracker.generateEnhancedOptimizationRecommendations(
        workspace_id as string,
        team_id as string
      );
      
      // Filter by status and priority if specified
      let filteredRecommendations = recommendations;
      if (status) {
        filteredRecommendations = filteredRecommendations.filter(r => r.status === status);
      }
      if (priority) {
        filteredRecommendations = filteredRecommendations.filter(r => r.priority === priority);
      }
      
      res.json({
        success: true,
        data: filteredRecommendations,
        total: filteredRecommendations.length,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recommendations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/enterprise-costs/budgets
 * Create a new budget
 */
router.post('/budgets',
  body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Budget name is required'),
  body('description').optional().isString(),
  body('type').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).withMessage('Invalid budget type'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Invalid currency code'),
  body('scope').isIn(['global', 'workspace', 'team', 'user', 'resource_type']).withMessage('Invalid scope'),
  body('scope_id').optional().isString(),
  body('start_date').isISO8601().withMessage('Invalid start date format'),
  body('end_date').isISO8601().withMessage('Invalid end date format'),
  body('auto_reset').optional().isBoolean(),
  body('rollover_unused').optional().isBoolean(),
  body('created_by').isString().withMessage('Creator is required'),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const budgetData = {
        ...req.body,
        currency: req.body.currency || 'USD',
        resource_filters: req.body.resource_filters || {},
        status: 'active' as const,
        auto_reset: req.body.auto_reset || false,
        rollover_unused: req.body.rollover_unused || false
      };
      
      const budget = await enterpriseCostTracker.createBudget(budgetData);
      
      res.status(201).json({
        success: true,
        data: budget,
        message: 'Budget created successfully'
      });
    } catch (error) {
      console.error('Error creating budget:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create budget',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/enterprise-costs/budgets
 * Get all budgets with optional filtering
 */
router.get('/budgets',
  query('scope').optional().isIn(['global', 'workspace', 'team', 'user', 'resource_type']),
  query('scope_id').optional().isString(),
  query('status').optional().isIn(['active', 'paused', 'expired', 'deleted']),
  query('workspace_id').optional().isString(),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      // This would need to be implemented in the EnterpriseCostTracker
      // For now, returning a mock response
      const budgets = [
        {
          id: 1,
          name: 'Monthly Development Budget',
          description: 'Budget for development team',
          type: 'monthly',
          amount: 10000,
          currency: 'USD',
          scope: 'team',
          scope_id: 'dev-team',
          current_spend: 7500,
          percentage_used: 75,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      res.json({
        success: true,
        data: budgets,
        total: budgets.length
      });
    } catch (error) {
      console.error('Error fetching budgets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budgets',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/enterprise-costs/anomalies
 * Get cost anomalies
 */
router.get('/anomalies',
  query('status').optional().isIn(['open', 'investigating', 'resolved', 'false_positive']),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('workspace_id').optional().isString(),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      // This would be implemented by querying the cost_anomalies table
      // For now, returning mock data
      const anomalies = [
        {
          id: 1,
          detection_algorithm: 'statistical',
          anomaly_type: 'spike',
          severity: 'high',
          resource_type: 'compute',
          resource_id: 'ec2-us-east-1',
          baseline_cost: 150.00,
          actual_cost: 450.00,
          deviation_percentage: 200.0,
          confidence_score: 95.5,
          root_cause_analysis: 'Detected 200% cost increase in compute resources. Possible causes: increased demand, resource scaling, pricing changes.',
          suggested_actions: ['Review recent changes', 'Check auto-scaling policies', 'Verify billing information'],
          business_impact: 'High impact: 200% cost deviation requires immediate attention',
          detected_at: new Date().toISOString(),
          status: 'open'
        }
      ];
      
      res.json({
        success: true,
        data: anomalies,
        total: anomalies.length
      });
    } catch (error) {
      console.error('Error fetching anomalies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch cost anomalies',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/enterprise-costs/cloud-providers
 * Register a new cloud provider
 */
router.post('/cloud-providers',
  body('id').isString().isLength({ min: 1 }).withMessage('Provider ID is required'),
  body('provider').isIn(['aws', 'azure', 'gcp']).withMessage('Invalid provider'),
  body('account_id').isString().isLength({ min: 1 }).withMessage('Account ID is required'),
  body('credentials').isObject().withMessage('Credentials object is required'),
  body('regions').optional().isArray(),
  body('sync_frequency').optional().isIn(['realtime', 'hourly', 'daily']),
  body('workspace_id').optional().isString(),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const config: Omit<CloudProviderConfig, 'created_at' | 'updated_at'> = {
        ...req.body,
        regions: req.body.regions || [],
        sync_frequency: req.body.sync_frequency || 'daily',
        cost_allocation_tags: req.body.cost_allocation_tags || [],
        enabled_services: req.body.enabled_services || [],
        last_sync: new Date().toISOString()
      };
      
      const savedConfig = await cloudProviderIntegration.registerCloudProvider(config);
      
      // Remove sensitive credentials from response
      const responseConfig = { ...savedConfig };
      delete (responseConfig as any).credentials;
      
      res.status(201).json({
        success: true,
        data: responseConfig,
        message: 'Cloud provider registered successfully'
      });
    } catch (error) {
      console.error('Error registering cloud provider:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register cloud provider',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/enterprise-costs/cloud-providers
 * Get all registered cloud providers
 */
router.get('/cloud-providers',
  query('workspace_id').optional().isString(),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { workspace_id } = req.query;
      
      const providers = await cloudProviderIntegration.getCloudProviders(workspace_id as string);
      
      // Remove sensitive credentials from response
      const safeProviders = providers.map(provider => {
        const safeProvider = { ...provider };
        delete (safeProvider as any).credentials;
        return safeProvider;
      });
      
      res.json({
        success: true,
        data: safeProviders,
        total: safeProviders.length
      });
    } catch (error) {
      console.error('Error fetching cloud providers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch cloud providers',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/enterprise-costs/cloud-providers/:id/sync
 * Trigger manual sync for a cloud provider
 */
router.post('/cloud-providers/:id/sync',
  param('id').isString().withMessage('Provider ID is required'),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      
      const providers = await cloudProviderIntegration.getCloudProviders();
      const provider = providers.find(p => p.id === id);
      
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Cloud provider not found'
        });
      }
      
      const costData = await cloudProviderIntegration.syncProviderCosts(provider);
      
      res.json({
        success: true,
        data: {
          provider_id: id,
          records_synced: costData.length,
          sync_timestamp: new Date().toISOString()
        },
        message: 'Cloud provider sync completed successfully'
      });
    } catch (error) {
      console.error('Error syncing cloud provider:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync cloud provider',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/enterprise-costs/cloud-providers/:id
 * Remove a cloud provider configuration
 */
router.delete('/cloud-providers/:id',
  param('id').isString().withMessage('Provider ID is required'),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      
      await cloudProviderIntegration.removeCloudProvider(id);
      
      res.json({
        success: true,
        message: 'Cloud provider removed successfully'
      });
    } catch (error) {
      console.error('Error removing cloud provider:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove cloud provider',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/enterprise-costs/consolidated
 * Get consolidated cost data from all providers
 */
router.get('/consolidated',
  query('start_date').isISO8601().withMessage('Invalid start date format'),
  query('end_date').isISO8601().withMessage('Invalid end date format'),
  query('workspace_id').optional().isString(),
  query('provider').optional().isIn(['aws', 'azure', 'gcp']),
  query('resource_type').optional().isString(),
  query('region').optional().isString(),
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { start_date, end_date, workspace_id, provider, resource_type, region } = req.query;
      
      let costData = await cloudProviderIntegration.getConsolidatedCosts(
        start_date as string,
        end_date as string,
        workspace_id as string
      );
      
      // Apply additional filters
      if (provider) {
        costData = costData.filter(data => data.provider === provider);
      }
      if (resource_type) {
        costData = costData.filter(data => data.resource_type === resource_type);
      }
      if (region) {
        costData = costData.filter(data => data.region === region);
      }
      
      // Calculate summary statistics
      const totalCost = costData.reduce((sum, data) => sum + data.cost_usd, 0);
      const providerBreakdown = costData.reduce((acc, data) => {
        acc[data.provider] = (acc[data.provider] || 0) + data.cost_usd;
        return acc;
      }, {} as Record<string, number>);
      
      res.json({
        success: true,
        data: {
          cost_data: costData,
          summary: {
            total_cost: totalCost,
            total_records: costData.length,
            provider_breakdown: providerBreakdown,
            date_range: {
              start: start_date,
              end: end_date
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching consolidated costs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch consolidated cost data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/enterprise-costs/health-check
 * Health check endpoint for monitoring
 */
router.get('/health-check', (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    service: 'Enterprise Cost Tracking API',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;