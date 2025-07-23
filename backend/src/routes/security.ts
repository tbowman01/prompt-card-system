import { Router, Request, Response } from 'express';
import {
  securityMonitor,
  logAggregator,
  alertingSystem,
  complianceChecker,
  SecurityEvent,
  LogFilter,
  Alert,
  AlertRule,
  NotificationChannel,
  ComplianceCheck
} from '../services/security';

const router = Router();

// Security monitoring endpoints
router.get('/status', async (req: Request, res: Response) => {
  try {
    const metrics = securityMonitor.getSecurityMetrics();
    const alertStats = alertingSystem.getAlertStatistics();
    const complianceMetrics = complianceChecker.getComplianceMetrics();
    
    res.json({
      status: 'active',
      timestamp: new Date().toISOString(),
      security: metrics,
      alerts: alertStats,
      compliance: complianceMetrics
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get security status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Vulnerability scanning endpoints
router.post('/scan/dependencies', async (req: Request, res: Response) => {
  try {
    const report = await securityMonitor.scanDependencies();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: 'Dependency scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/scan/code', async (req, res) => {
  try {
    const report = await securityMonitor.scanCode();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: 'Code scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/scan/infrastructure', async (req, res) => {
  try {
    const report = await securityMonitor.scanInfrastructure();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: 'Infrastructure scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/scan/comprehensive', async (req, res) => {
  try {
    const reports = await securityMonitor.performComprehensiveScan();
    res.json({
      timestamp: new Date().toISOString(),
      reports
    });
  } catch (error) {
    res.status(500).json({
      error: 'Comprehensive scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Security events endpoints
router.get('/events', (req, res) => {
  try {
    const {
      severity,
      type,
      source,
      since,
      limit = '100'
    } = req.query;
    
    const filters: any = {};
    if (severity) filters.severity = severity;
    if (type) filters.type = type;
    if (source) filters.source = source as string;
    if (since) filters.since = new Date(since as string);
    filters.limit = parseInt(limit as string);
    
    const events = securityMonitor.getSecurityEvents(filters);
    res.json({
      total: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get security events',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/events', (req, res) => {
  try {
    const { severity, type, source, message, details } = req.body;
    
    if (!severity || !type || !source || !message) {
      return res.status(400).json({
        error: 'Missing required fields: severity, type, source, message'
      });
    }
    
    securityMonitor.logSecurityEvent({
      severity,
      type,
      source,
      message,
      details: details || {},
      resolved: false
    });
    
    res.status(201).json({ status: 'Event logged successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to log security event',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Log aggregation endpoints
router.get('/logs', (req, res) => {
  try {
    const {
      level,
      source,
      tags,
      searchTerm,
      since,
      until,
      limit = '100'
    } = req.query;
    
    const filter: LogFilter = {};
    if (level) filter.level = (level as string).split(',') as any;
    if (source) filter.source = (source as string).split(',');
    if (tags) filter.tags = (tags as string).split(',');
    if (searchTerm) filter.searchTerm = searchTerm as string;
    if (since || until) {
      filter.timeRange = {
        start: since ? new Date(since as string) : new Date(0),
        end: until ? new Date(until as string) : new Date()
      };
    }
    filter.limit = parseInt(limit as string);
    
    const logs = logAggregator.getLogs(filter);
    res.json({
      total: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/logs/analysis', async (req, res) => {
  try {
    const { since, until } = req.query;
    
    const timeRange = (since || until) ? {
      start: since ? new Date(since as string) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: until ? new Date(until as string) : new Date()
    } : undefined;
    
    const analysis = await logAggregator.performLogAnalysis(timeRange);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to perform log analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/logs/statistics', (req, res) => {
  try {
    const stats = logAggregator.getLogStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get log statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Alerting endpoints
router.get('/alerts', (req, res) => {
  try {
    const {
      severity,
      type,
      acknowledged,
      resolved,
      since,
      limit = '50'
    } = req.query;
    
    const filters: any = {};
    if (severity) filters.severity = (severity as string).split(',');
    if (type) filters.type = (type as string).split(',');
    if (acknowledged !== undefined) filters.acknowledged = acknowledged === 'true';
    if (resolved !== undefined) filters.resolved = resolved === 'true';
    if (since) filters.since = new Date(since as string);
    filters.limit = parseInt(limit as string);
    
    const alerts = alertingSystem.getAlerts(filters);
    res.json({
      total: alerts.length,
      alerts
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.patch('/alerts/:alertId/acknowledge', (req, res) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;
    
    if (!acknowledgedBy) {
      return res.status(400).json({
        error: 'acknowledgedBy field is required'
      });
    }
    
    const success = alertingSystem.acknowledgeAlert(alertId, acknowledgedBy);
    
    if (success) {
      res.json({ status: 'Alert acknowledged successfully' });
    } else {
      res.status(404).json({ error: 'Alert not found or already acknowledged' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.patch('/alerts/:alertId/resolve', (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolvedBy } = req.body;
    
    if (!resolvedBy) {
      return res.status(400).json({
        error: 'resolvedBy field is required'
      });
    }
    
    const success = alertingSystem.resolveAlert(alertId, resolvedBy);
    
    if (success) {
      res.json({ status: 'Alert resolved successfully' });
    } else {
      res.status(404).json({ error: 'Alert not found or already resolved' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Alert rules management
router.get('/alert-rules', (req, res) => {
  try {
    const rules = alertingSystem.getRules();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alert rules',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/alert-rules', (req, res) => {
  try {
    const rule = alertingSystem.addRule(req.body);
    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/alert-rules/:ruleId', (req, res) => {
  try {
    const { ruleId } = req.params;
    const success = alertingSystem.updateRule(ruleId, req.body);
    
    if (success) {
      res.json({ status: 'Rule updated successfully' });
    } else {
      res.status(404).json({ error: 'Rule not found' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/alert-rules/:ruleId', (req, res) => {
  try {
    const { ruleId } = req.params;
    const success = alertingSystem.removeRule(ruleId);
    
    if (success) {
      res.json({ status: 'Rule deleted successfully' });
    } else {
      res.status(404).json({ error: 'Rule not found' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Notification channels management
router.get('/notification-channels', (req, res) => {
  try {
    const channels = alertingSystem.getChannels();
    res.json({ channels });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get notification channels',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/notification-channels', (req, res) => {
  try {
    const channel = alertingSystem.addChannel(req.body);
    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create notification channel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/notification-channels/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    const success = alertingSystem.updateChannel(channelId, req.body);
    
    if (success) {
      res.json({ status: 'Channel updated successfully' });
    } else {
      res.status(404).json({ error: 'Channel not found' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update notification channel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/notification-channels/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    const success = alertingSystem.removeChannel(channelId);
    
    if (success) {
      res.json({ status: 'Channel deleted successfully' });
    } else {
      res.status(404).json({ error: 'Channel not found' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete notification channel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Compliance endpoints
router.get('/compliance/status', (req, res) => {
  try {
    const metrics = complianceChecker.getComplianceMetrics();
    const latestReport = complianceChecker.getLatestReport();
    
    res.json({
      metrics,
      latestReport
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get compliance status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/compliance/scan', async (req, res) => {
  try {
    const { framework } = req.body;
    const report = await complianceChecker.generateComplianceReport(framework);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: 'Compliance scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/compliance/reports', (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const reports = complianceChecker.getReports(parseInt(limit as string));
    res.json({ reports });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get compliance reports',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/compliance/checks', (req, res) => {
  try {
    const { category, framework, severity, automated } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category;
    if (framework) filters.framework = framework;
    if (severity) filters.severity = severity;
    if (automated !== undefined) filters.automated = automated === 'true';
    
    const checks = complianceChecker.getChecks(filters);
    res.json({ checks });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get compliance checks',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/compliance/checks/:checkId/run', async (req, res) => {
  try {
    const { checkId } = req.params;
    const result = await complianceChecker.runCheck(checkId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to run compliance check',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Security dashboard endpoint
router.get('/dashboard', async (req, res) => {
  try {
    const [securityMetrics, alertStats, complianceMetrics, logStats] = await Promise.all([
      Promise.resolve(securityMonitor.getSecurityMetrics()),
      Promise.resolve(alertingSystem.getAlertStatistics()),
      Promise.resolve(complianceChecker.getComplianceMetrics()),
      Promise.resolve(logAggregator.getLogStatistics())
    ]);
    
    const recentAlerts = alertingSystem.getAlerts({ limit: 10 });
    const recentEvents = securityMonitor.getSecurityEvents({ limit: 10 });
    const latestAnalysis = logAggregator.getAnalyses(1)[0];
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: {
        security: securityMetrics,
        alerts: alertStats,
        compliance: complianceMetrics,
        logs: logStats
      },
      recent: {
        alerts: recentAlerts,
        events: recentEvents,
        analysis: latestAnalysis
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get security dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as securityRoutes };