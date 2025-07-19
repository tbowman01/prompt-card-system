import { Router } from 'express';
import { healthOrchestrator } from '../services/health/HealthOrchestrator';

const router = Router();

// Get overall system health
router.get('/system', async (req, res) => {
  try {
    const systemHealth = healthOrchestrator.getSystemHealth();
    
    const statusCode = systemHealth.overallStatus === 'healthy' ? 200 :
                      systemHealth.overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      ...systemHealth,
      services: Object.fromEntries(systemHealth.services),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific service health
router.get('/service/:serviceName', async (req, res) => {
  try {
    const { serviceName } = req.params;
    const serviceHealth = healthOrchestrator.getServiceHealth(serviceName);
    
    if (!serviceHealth) {
      return res.status(404).json({
        error: 'Service not found',
        serviceName
      });
    }
    
    const statusCode = serviceHealth.status === 'healthy' ? 200 :
                      serviceHealth.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      ...serviceHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get service health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get health summary for dashboard
router.get('/summary', async (req, res) => {
  try {
    const systemHealth = healthOrchestrator.getSystemHealth();
    
    const summary = {
      overallStatus: systemHealth.overallStatus,
      totalServices: systemHealth.totalServices,
      healthyServices: systemHealth.healthyServices,
      degradedServices: systemHealth.degradedServices,
      unhealthyServices: systemHealth.unhealthyServices,
      offlineServices: systemHealth.offlineServices,
      lastCheck: systemHealth.lastFullCheck,
      healthPercentage: Math.round((systemHealth.healthyServices / systemHealth.totalServices) * 100),
      criticalServices: Array.from(systemHealth.services.values())
        .filter(s => s.criticalService)
        .map(s => ({
          name: s.name,
          status: s.status,
          lastCheck: s.lastCheck,
          responseTime: s.responseTime
        })),
      recentIssues: Array.from(systemHealth.services.values())
        .filter(s => s.status !== 'healthy')
        .map(s => ({
          service: s.name,
          status: s.status,
          message: s.message,
          lastCheck: s.lastCheck
        }))
        .sort((a, b) => new Date(b.lastCheck).getTime() - new Date(a.lastCheck).getTime())
        .slice(0, 10)
    };
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get health summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start health monitoring
router.post('/start', async (req, res) => {
  try {
    await healthOrchestrator.start();
    res.json({
      message: 'Health monitoring started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to start health monitoring',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stop health monitoring
router.post('/stop', async (req, res) => {
  try {
    await healthOrchestrator.stop();
    res.json({
      message: 'Health monitoring stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to stop health monitoring',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update health monitoring configuration
router.put('/config', async (req, res) => {
  try {
    const config = req.body;
    healthOrchestrator.updateConfig(config);
    
    res.json({
      message: 'Health monitoring configuration updated',
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health events stream (for real-time updates)
router.get('/events', (req, res) => {
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

  // Send initial system health
  const initialHealth = healthOrchestrator.getSystemHealth();
  sendEvent({
    type: 'initial',
    data: {
      ...initialHealth,
      services: Object.fromEntries(initialHealth.services)
    }
  });

  // Set up event listeners
  const onServiceStatusChanged = (data: any) => {
    sendEvent({ type: 'serviceStatusChanged', data });
  };

  const onFullHealthCheckComplete = (data: any) => {
    sendEvent({ 
      type: 'fullHealthCheckComplete', 
      data: {
        ...data.systemHealth,
        services: Object.fromEntries(data.systemHealth.services)
      }
    });
  };

  const onCriticalServiceDown = (data: any) => {
    sendEvent({ type: 'criticalServiceDown', data });
  };

  healthOrchestrator.on('serviceStatusChanged', onServiceStatusChanged);
  healthOrchestrator.on('fullHealthCheckComplete', onFullHealthCheckComplete);
  healthOrchestrator.on('criticalServiceDown', onCriticalServiceDown);

  // Handle client disconnect
  req.on('close', () => {
    healthOrchestrator.off('serviceStatusChanged', onServiceStatusChanged);
    healthOrchestrator.off('fullHealthCheckComplete', onFullHealthCheckComplete);
    healthOrchestrator.off('criticalServiceDown', onCriticalServiceDown);
  });
});

export { router as healthOrchestratorRoutes };