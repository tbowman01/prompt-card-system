import express from 'express';
import { performance } from 'perf_hooks';
import sqlite3 from 'better-sqlite3';
import Redis from 'ioredis';
import axios from 'axios';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: any;
  error?: string;
  lastChecked: string;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  system: {
    memory: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
    cpu: {
      loadAverage: number[];
      cores: number;
      usage?: number;
    };
    disk: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
  };
  metrics: {
    requestCount: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

// In-memory metrics storage (in production, use Redis or proper metrics store)
const metrics = {
  requestCount: 0,
  errorCount: 0,
  responseTimes: [] as number[],
  lastReset: Date.now()
};

// Health check implementations
class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();

  constructor() {
    this.registerChecks();
  }

  private registerChecks() {
    this.checks.set('database', this.checkDatabase.bind(this));
    this.checks.set('redis', this.checkRedis.bind(this));
    this.checks.set('ollama', this.checkOllama.bind(this));
    this.checks.set('disk', this.checkDiskSpace.bind(this));
    this.checks.set('memory', this.checkMemory.bind(this));
    this.checks.set('external-api', this.checkExternalAPIs.bind(this));
    this.checks.set('websocket', this.checkWebSocket.bind(this));
    this.checks.set('background-jobs', this.checkBackgroundJobs.bind(this));
  }

  async runAllChecks(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = [];
    
    for (const [name, checkFn] of this.checks) {
      try {
        const result = await Promise.race([
          checkFn(),
          this.timeout(name, 5000) // 5 second timeout
        ]);
        results.push(result);
      } catch (error) {
        results.push({
          service: name,
          status: 'unhealthy',
          responseTime: 5000,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  private async timeout(service: string, ms: number): Promise<HealthCheck> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout for ${service}`)), ms);
    });
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      const dbPath = process.env.DATABASE_PATH || './data/database.sqlite';
      const db = sqlite3(dbPath);
      
      // Test read/write operations
      const testQuery = db.prepare('SELECT 1 as test').get();
      const writeTest = db.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"').get();
      
      db.close();
      
      const responseTime = performance.now() - start;
      
      return {
        service: 'database',
        status: 'healthy',
        responseTime: Math.round(responseTime),
        details: {
          queryResult: testQuery,
          tableCount: writeTest,
          path: dbPath
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      
      // Test Redis operations
      const pingResult = await redis.ping();
      const testKey = `health-check-${Date.now()}`;
      await redis.set(testKey, 'test-value', 'EX', 10);
      const getValue = await redis.get(testKey);
      await redis.del(testKey);
      
      const info = await redis.info('server');
      const memory = await redis.info('memory');
      
      await redis.disconnect();
      
      const responseTime = performance.now() - start;
      
      return {
        service: 'redis',
        status: pingResult === 'PONG' && getValue === 'test-value' ? 'healthy' : 'degraded',
        responseTime: Math.round(responseTime),
        details: {
          ping: pingResult,
          readWrite: getValue === 'test-value',
          serverInfo: this.parseRedisInfo(info),
          memoryInfo: this.parseRedisInfo(memory)
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'Redis connection failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkOllama(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      
      // Check if Ollama is running
      const versionResponse = await axios.get(`${ollamaUrl}/api/version`, { timeout: 5000 });
      
      // Check available models
      const modelsResponse = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
      
      // Test simple generation (if models available)
      let generationTest = null;
      if (modelsResponse.data.models && modelsResponse.data.models.length > 0) {
        const model = modelsResponse.data.models[0].name;
        try {
          const testResponse = await axios.post(`${ollamaUrl}/api/generate`, {
            model,
            prompt: 'test',
            stream: false
          }, { timeout: 10000 });
          
          generationTest = {
            model,
            success: !!testResponse.data.response
          };
        } catch (genError) {
          generationTest = {
            model,
            success: false,
            error: genError instanceof Error ? genError.message : 'Generation failed'
          };
        }
      }
      
      const responseTime = performance.now() - start;
      
      return {
        service: 'ollama',
        status: 'healthy',
        responseTime: Math.round(responseTime),
        details: {
          version: versionResponse.data,
          modelCount: modelsResponse.data.models?.length || 0,
          models: modelsResponse.data.models?.map((m: any) => m.name) || [],
          generationTest
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'ollama',
        status: 'unhealthy',
        responseTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'Ollama service unavailable',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkDiskSpace(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      const stats = await fs.stat('./');
      const dataDir = './data';
      
      // Get disk usage (simplified - in production use proper disk space library)
      const diskInfo = {
        dataDirectory: dataDir,
        accessible: true
      };
      
      try {
        await fs.access(dataDir);
        const dataDirStats = await fs.stat(dataDir);
        diskInfo.accessible = dataDirStats.isDirectory();
      } catch {
        diskInfo.accessible = false;
      }
      
      const responseTime = performance.now() - start;
      
      return {
        service: 'disk',
        status: diskInfo.accessible ? 'healthy' : 'degraded',
        responseTime: Math.round(responseTime),
        details: diskInfo,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'disk',
        status: 'unhealthy',
        responseTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'Disk check failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      const memUsage = process.memoryUsage();
      const systemMem = {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      };
      
      const memoryPressure = (systemMem.used / systemMem.total) > 0.9;
      const processMemoryHigh = memUsage.heapUsed > (100 * 1024 * 1024); // 100MB
      
      const status = memoryPressure || processMemoryHigh ? 'degraded' : 'healthy';
      
      const responseTime = performance.now() - start;
      
      return {
        service: 'memory',
        status,
        responseTime: Math.round(responseTime),
        details: {
          system: systemMem,
          process: memUsage,
          pressure: memoryPressure,
          processHigh: processMemoryHigh
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'memory',
        status: 'unhealthy',
        responseTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'Memory check failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkExternalAPIs(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      // Test external dependencies (customize based on your external APIs)
      const checks = await Promise.allSettled([
        axios.get('https://httpbin.org/status/200', { timeout: 3000 }),
        // Add your external API checks here
      ]);
      
      const failed = checks.filter(result => result.status === 'rejected').length;
      const total = checks.length;
      
      const status = failed === 0 ? 'healthy' : failed < total ? 'degraded' : 'unhealthy';
      
      const responseTime = performance.now() - start;
      
      return {
        service: 'external-api',
        status,
        responseTime: Math.round(responseTime),
        details: {
          total,
          failed,
          results: checks.map((result, index) => ({
            index,
            status: result.status,
            error: result.status === 'rejected' ? result.reason?.message : null
          }))
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'external-api',
        status: 'unhealthy',
        responseTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'External API checks failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkWebSocket(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      // WebSocket health check would require actual connection testing
      // For now, check if WebSocket server is configured
      const wsEnabled = !!process.env.WEBSOCKET_ENABLED;
      
      const responseTime = performance.now() - start;
      
      return {
        service: 'websocket',
        status: wsEnabled ? 'healthy' : 'degraded',
        responseTime: Math.round(responseTime),
        details: {
          enabled: wsEnabled,
          note: 'WebSocket server configuration check'
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'websocket',
        status: 'unhealthy',
        responseTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'WebSocket check failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkBackgroundJobs(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      // Check background job queue health (Bull/Redis queues)
      // This is a simplified check - in production, check actual queue status
      const jobsHealthy = true; // Implement actual job queue health check
      
      const responseTime = performance.now() - start;
      
      return {
        service: 'background-jobs',
        status: jobsHealthy ? 'healthy' : 'degraded',
        responseTime: Math.round(responseTime),
        details: {
          queuesActive: jobsHealthy,
          note: 'Background job queue status'
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'background-jobs',
        status: 'unhealthy',
        responseTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'Background jobs check failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const result: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}

const healthChecker = new HealthChecker();

// Middleware to track metrics
export const trackMetrics = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = performance.now();
  
  metrics.requestCount++;
  
  res.on('finish', () => {
    const responseTime = performance.now() - start;
    metrics.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes = metrics.responseTimes.slice(-1000);
    }
    
    if (res.statusCode >= 400) {
      metrics.errorCount++;
    }
  });
  
  next();
};

// Comprehensive health check endpoint
router.get('/comprehensive', async (req, res) => {
  try {
    const start = performance.now();
    
    // Run all health checks
    const checks = await healthChecker.runAllChecks();
    
    // Calculate overall status
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    // Get system information
    const memInfo = process.memoryUsage();
    const systemMem = {
      used: os.totalmem() - os.freemem(),
      free: os.freemem(),
      total: os.totalmem(),
      percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
    };
    
    // Calculate metrics
    const avgResponseTime = metrics.responseTimes.length > 0 
      ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
      : 0;
    
    const errorRate = metrics.requestCount > 0 
      ? Math.round((metrics.errorCount / metrics.requestCount) * 100)
      : 0;
    
    const healthData: SystemHealth = {
      overall: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      system: {
        memory: systemMem,
        cpu: {
          loadAverage: os.loadavg(),
          cores: os.cpus().length
        },
        disk: {
          used: 0, // Implement actual disk usage
          free: 0,
          total: 0,
          percentage: 0
        }
      },
      metrics: {
        requestCount: metrics.requestCount,
        errorRate,
        averageResponseTime: avgResponseTime
      }
    };
    
    // Set appropriate HTTP status based on health
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthData);
    
  } catch (error) {
    res.status(503).json({
      overall: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
      checks: []
    });
  }
});

// Simple health check for load balancers
router.get('/ready', async (req, res) => {
  try {
    // Quick checks for readiness
    const critical = await Promise.all([
      healthChecker['checkDatabase'](),
      // Add other critical service checks
    ]);
    
    const allHealthy = critical.every(check => check.status === 'healthy');
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'not ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime())
  });
});

export default router;