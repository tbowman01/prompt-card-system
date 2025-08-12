import express from 'express';
import { Request, Response } from 'express';
import { alertRoutes } from './alerts';
import performanceRoutes from './performance';

const router = express.Router();

// Mount existing routes under monitoring namespace
router.use('/alerts', alertRoutes);
router.use('/performance', performanceRoutes);

// System health endpoint - proxy to main health endpoint
router.get('/system-health', async (req: Request, res: Response) => {
  try {
    // Forward to main health endpoint
    const healthResponse = await fetch(`${req.protocol}://${req.get('host')}/api/health`);
    const healthData = await healthResponse.json();
    res.json(healthData);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system health'
    });
  }
});

// Traces endpoint - placeholder for future implementation
router.get('/traces', (req: Request, res: Response) => {
  res.json({
    traces: [],
    message: 'Traces endpoint - to be implemented with OpenTelemetry integration'
  });
});

router.get('/traces/:traceId', (req: Request, res: Response) => {
  res.json({
    traceId: req.params.traceId,
    spans: [],
    message: 'Trace detail endpoint - to be implemented with OpenTelemetry integration'
  });
});

// Custom metrics endpoint
router.get('/custom-metrics', (req: Request, res: Response) => {
  res.json({
    metrics: {
      api_requests_total: 0,
      api_response_time_avg: 0,
      active_connections: 0,
      error_rate: 0
    },
    timestamp: new Date().toISOString(),
    message: 'Custom metrics endpoint - to be integrated with Prometheus'
  });
});

// KPIs endpoint
router.get('/kpis', (req: Request, res: Response) => {
  res.json({
    kpis: {
      availability: 99.9,
      response_time: 150,
      error_rate: 0.1,
      throughput: 1000
    },
    timestamp: new Date().toISOString()
  });
});

// Dashboard endpoints
router.get('/dashboard/overview', (req: Request, res: Response) => {
  res.json({
    overview: {
      total_requests: 10000,
      active_users: 50,
      error_count: 5,
      avg_response_time: 200
    },
    timestamp: new Date().toISOString()
  });
});

router.get('/dashboard/metrics', (req: Request, res: Response) => {
  res.json({
    metrics: {
      cpu_usage: 45.2,
      memory_usage: 67.8,
      disk_usage: 23.1,
      network_io: 1024
    },
    timestamp: new Date().toISOString()
  });
});

export { router as monitoringRoutes };