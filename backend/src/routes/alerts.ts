import { Router, Request, Response } from 'express';
import { alertingSystem, AlertSeverity } from '../services/health/AlertingSystem';

const router = Router();

// Get all alerts with optional filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      service,
      severity,
      acknowledged,
      resolved,
      limit
    } = req.query;

    const filters: any = {};
    
    if (service) filters.service = service as string;
    if (severity) filters.severity = severity as AlertSeverity;
    if (acknowledged !== undefined) filters.acknowledged = acknowledged === 'true';
    if (resolved !== undefined) filters.resolved = resolved === 'true';
    if (limit) filters.limit = parseInt(limit as string, 10);

    const alerts = alertingSystem.getAlerts(filters);
    
    res.json({
      alerts,
      total: alerts.length,
      filters: filters
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get alert statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = alertingSystem.getAlertStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alert statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific alert by ID
router.get('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const alerts = alertingSystem.getAlerts();
    const alert = alerts.find(a => a.id === alertId);
    
    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        alertId
      });
    }
    
    res.json(alert);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Acknowledge an alert
router.post('/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const success = alertingSystem.acknowledgeAlert(alertId);
    
    if (!success) {
      return res.status(404).json({
        error: 'Alert not found',
        alertId
      });
    }
    
    res.json({
      message: 'Alert acknowledged successfully',
      alertId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Resolve an alert
router.post('/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const success = alertingSystem.resolveAlert(alertId);
    
    if (!success) {
      return res.status(404).json({
        error: 'Alert not found',
        alertId
      });
    }
    
    res.json({
      message: 'Alert resolved successfully',
      alertId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get alert rules
router.get('/rules/list', async (req, res) => {
  try {
    const rules = alertingSystem.getAlertRules();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alert rules',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add new alert rule
router.post('/rules', async (req, res) => {
  try {
    const rule = req.body;
    
    // Basic validation
    if (!rule.id || !rule.name || !rule.type || !rule.severity) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['id', 'name', 'type', 'severity']
      });
    }
    
    alertingSystem.addAlertRule(rule);
    
    res.status(201).json({
      message: 'Alert rule created successfully',
      rule
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update alert rule
router.put('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;
    
    const success = alertingSystem.updateAlertRule(ruleId, updates);
    
    if (!success) {
      return res.status(404).json({
        error: 'Alert rule not found',
        ruleId
      });
    }
    
    res.json({
      message: 'Alert rule updated successfully',
      ruleId,
      updates
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete alert rule
router.delete('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const success = alertingSystem.removeAlertRule(ruleId);
    
    if (!success) {
      return res.status(404).json({
        error: 'Alert rule not found',
        ruleId
      });
    }
    
    res.json({
      message: 'Alert rule deleted successfully',
      ruleId
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Real-time alert stream
router.get('/stream/live', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial stats
  const initialStats = alertingSystem.getAlertStats();
  sendEvent({
    type: 'stats',
    data: initialStats
  });

  // Set up event listeners
  const onAlertCreated = (alert: any) => {
    sendEvent({ type: 'alertCreated', data: alert });
  };

  const onAlertAcknowledged = (alert: any) => {
    sendEvent({ type: 'alertAcknowledged', data: alert });
  };

  const onAlertResolved = (alert: any) => {
    sendEvent({ type: 'alertResolved', data: alert });
  };

  alertingSystem.on('alertCreated', onAlertCreated);
  alertingSystem.on('alertAcknowledged', onAlertAcknowledged);
  alertingSystem.on('alertResolved', onAlertResolved);

  // Handle client disconnect
  req.on('close', () => {
    alertingSystem.off('alertCreated', onAlertCreated);
    alertingSystem.off('alertAcknowledged', onAlertAcknowledged);
    alertingSystem.off('alertResolved', onAlertResolved);
  });
});

export { router as alertRoutes };