import { Router } from 'express';
import { db } from '../database/connection';
import { llmService } from '../services/llmService';
import { performanceMonitor } from '../services/performance/PerformanceMonitor';
import { securityMonitor, logAggregator, alertingSystem, complianceChecker } from '../services/security';
import { createClient } from 'redis';
import axios from 'axios';
import os from 'os';
import { Server as SocketIOServer } from 'socket.io';

const router = Router();

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  responseTime?: number;
  details?: any;
}

interface ServiceHealth {
  [key: string]: HealthCheckResult;
}

// Utility function to perform health check with timeout
async function performHealthCheck(
  name: string,
  checkFn: () => Promise<HealthCheckResult>,
  timeout = 5000
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const result = await Promise.race([
      checkFn(),
      new Promise<HealthCheckResult>((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), timeout)
      )
    ]);
    
    return {
      ...result,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    };
  }
}

// Database health check
async function checkDatabase(): Promise<HealthCheckResult> {
  try {
    const result = db.prepare('SELECT 1 as healthy').get() as { healthy: number };
    
    // Get database stats
    const stats = {
      promptCards: db.prepare('SELECT COUNT(*) as count FROM prompt_cards').get() as { count: number },
      testCases: db.prepare('SELECT COUNT(*) as count FROM test_cases').get() as { count: number },
      testExecutions: db.prepare('SELECT COUNT(*) as count FROM test_executions').get() as { count: number }
    };
    
    return {
      status: result?.healthy === 1 ? 'healthy' : 'unhealthy',
      details: {
        type: 'SQLite',
        path: process.env.DATABASE_PATH,
        stats
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
}

// Redis health check
async function checkRedis(): Promise<HealthCheckResult> {
  const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
  
  try {
    const client = createClient({ url: redisUrl });
    await client.connect();
    
    const pingResult = await client.ping();
    const info = await client.info('server');
    
    await client.disconnect();
    
    // Extract version from info
    const versionMatch = info.match(/redis_version:(.+)/);
    const version = versionMatch ? versionMatch[1].trim() : 'unknown';
    
    return {
      status: pingResult === 'PONG' ? 'healthy' : 'unhealthy',
      details: {
        url: redisUrl,
        version,
        ping: pingResult
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { url: redisUrl }
    };
  }
}

// Ollama/LLM health check
async function checkOllama(): Promise<HealthCheckResult> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
  
  try {
    // Check Ollama API version
    const versionResponse = await axios.get(`${ollamaUrl}/api/version`, { timeout: 3000 });
    
    // Get available models
    const modelsResponse = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 3000 });
    const models = modelsResponse.data.models || [];
    
    // Try a simple generation with the first available model
    let generationTest = null;
    if (models.length > 0) {
      try {
        const testResponse = await axios.post(
          `${ollamaUrl}/api/generate`,
          {
            model: models[0].name,
            prompt: 'Respond with OK',
            stream: false,
            options: { num_predict: 5 }
          },
          { timeout: 5000 }
        );
        generationTest = testResponse.data.response?.includes('OK') ? 'passed' : 'failed';
      } catch (e) {
        generationTest = 'failed';
      }
    }
    
    return {
      status: models.length > 0 ? 'healthy' : 'degraded',
      message: models.length === 0 ? 'No models available' : undefined,
      details: {
        url: ollamaUrl,
        version: versionResponse.data.version,
        modelCount: models.length,
        models: models.map((m: any) => ({
          name: m.name,
          size: m.size,
          modified: m.modified_at
        })),
        generationTest
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Ollama connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { url: ollamaUrl }
    };
  }
}

// WebSocket health check
async function checkWebSocket(io?: SocketIOServer): Promise<HealthCheckResult> {
  try {
    if (!io) {
      return {
        status: 'unhealthy',
        message: 'WebSocket server not initialized'
      };
    }
    
    const sockets = await io.fetchSockets();
    
    return {
      status: 'healthy',
      details: {
        engine: io.engine.constructor.name,
        connectedClients: sockets.length,
        transports: io.engine.opts.transports
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'WebSocket check failed'
    };
  }
}

// System health check
async function checkSystem(): Promise<HealthCheckResult> {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const loadAverage = os.loadavg();
    
    // Check memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemoryPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // Determine health based on metrics
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (usedMemoryPercent > 90) {
      status = 'unhealthy';
    } else if (usedMemoryPercent > 80 || loadAverage[0] > os.cpus().length * 2) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        uptime: Math.floor(uptime),
        memory: {
          rss: Math.floor(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.floor(memoryUsage.external / 1024 / 1024),
          systemUsedPercent: Math.floor(usedMemoryPercent)
        },
        cpu: {
          loadAverage,
          cores: os.cpus().length
        },
        platform: os.platform(),
        nodeVersion: process.version
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'System check failed'
    };
  }
}

// Security health check
async function checkSecurity(): Promise<HealthCheckResult> {
  try {
    const securityMetrics = securityMonitor.getSecurityMetrics();
    const alertStats = alertingSystem.getAlertStatistics();
    const complianceMetrics = complianceChecker.getComplianceMetrics();
    
    // Determine health based on security metrics
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (securityMetrics.criticalVulnerabilities > 0 || alertStats.critical > 0) {
      status = 'unhealthy';
    } else if (securityMetrics.threatLevel === 'high' || complianceMetrics.criticalIssues > 0) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        securityScore: securityMetrics.securityScore,
        threatLevel: securityMetrics.threatLevel,
        criticalVulnerabilities: securityMetrics.criticalVulnerabilities,
        eventsLast24h: securityMetrics.eventsLast24h,
        complianceScore: complianceMetrics.currentScore,
        criticalAlerts: alertStats.critical,
        lastScanTimestamp: securityMetrics.lastScanTimestamp
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Security check failed'
    };
  }
}

// Comprehensive health check endpoint
router.get('/', async (req, res) => {
  const detailed = req.query.detailed === 'true';
  const startTime = Date.now();
  
  try {
    // Run all health checks in parallel
    const [database, redis, ollama, websocket, system, security] = await Promise.all([
      performHealthCheck('database', checkDatabase),
      performHealthCheck('redis', checkRedis),
      performHealthCheck('ollama', checkOllama),
      performHealthCheck('websocket', () => checkWebSocket(req.app.get('io'))),
      performHealthCheck('system', checkSystem),
      performHealthCheck('security', checkSecurity)
    ]);
    
    const services: ServiceHealth = {
      database,
      redis,
      ollama,
      websocket,
      system,
      security
    };
    
    // Calculate overall status
    const statuses = Object.values(services).map(s => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }
    
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      environment: process.env.NODE_ENV || 'development',
      services: detailed ? services : Object.fromEntries(
        Object.entries(services).map(([key, value]) => [key, {
          status: value.status,
          message: value.message,
          responseTime: value.responseTime
        }])
      )
    };
    
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(response);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Individual service health checks
router.get('/database', async (req, res) => {
  const result = await performHealthCheck('database', checkDatabase);
  res.status(result.status === 'healthy' ? 200 : 503).json(result);
});

router.get('/redis', async (req, res) => {
  const result = await performHealthCheck('redis', checkRedis);
  res.status(result.status === 'healthy' ? 200 : 503).json(result);
});

router.get('/ollama', async (req, res) => {
  const result = await performHealthCheck('ollama', checkOllama);
  res.status(result.status === 'healthy' ? 200 : 503).json(result);
});

router.get('/websocket', async (req, res) => {
  const result = await performHealthCheck('websocket', () => checkWebSocket(req.app.get('io')));
  res.status(result.status === 'healthy' ? 200 : 503).json(result);
});

router.get('/system', async (req, res) => {
  const result = await performHealthCheck('system', checkSystem);
  res.status(result.status === 'healthy' ? 200 : 503).json(result);
});

router.get('/security', async (req, res) => {
  const result = await performHealthCheck('security', checkSecurity);
  res.status(result.status === 'healthy' ? 200 : 503).json(result);
});

// Readiness check (for k8s/docker)
router.get('/ready', async (req, res) => {
  // Check only critical services for readiness
  const [database, ollama, security] = await Promise.all([
    performHealthCheck('database', checkDatabase),
    performHealthCheck('ollama', checkOllama),
    performHealthCheck('security', checkSecurity)
  ]);
  
  const isReady = database.status === 'healthy' && 
                  (ollama.status === 'healthy' || ollama.status === 'degraded') &&
                  security.status !== 'unhealthy';
  
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    services: { database, ollama, security }
  });
});

// Liveness check (for k8s/docker)
router.get('/live', (req, res) => {
  // Simple liveness check - just verify the process is running
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export { router as enhancedHealthRoutes };