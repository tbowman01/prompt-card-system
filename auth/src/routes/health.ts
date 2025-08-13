import { FastifyPluginAsync } from 'fastify';
import { getDatabase } from '../database/connection';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Basic health check
  fastify.get('/health', async (request, reply) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };

    reply.send(health);
  });

  // Detailed health check with dependencies
  fastify.get('/health/detailed', async (request, reply) => {
    const checks: any = {
      service: 'healthy',
      database: 'unknown',
      redis: 'unknown',
      timestamp: new Date().toISOString()
    };

    try {
      // Database check
      const db = getDatabase();
      await db.query('SELECT 1');
      checks.database = 'healthy';
    } catch (error) {
      checks.database = 'unhealthy';
      checks.databaseError = (error as Error).message;
    }

    try {
      // Redis check
      const redis = fastify.redis;
      await redis.ping();
      checks.redis = 'healthy';
    } catch (error) {
      checks.redis = 'unhealthy';
      checks.redisError = (error as Error).message;
    }

    // Overall status
    const isHealthy = checks.database === 'healthy' && checks.redis === 'healthy';
    const status = isHealthy ? 200 : 503;
    
    checks.overall = isHealthy ? 'healthy' : 'degraded';

    reply.status(status).send(checks);
  });

  // Readiness check for Kubernetes
  fastify.get('/ready', async (request, reply) => {
    try {
      // Check critical dependencies
      const db = getDatabase();
      await db.query('SELECT 1');
      
      const redis = fastify.redis;
      await redis.ping();

      reply.send({ status: 'ready' });
    } catch (error) {
      reply.status(503).send({ 
        status: 'not ready',
        error: (error as Error).message 
      });
    }
  });

  // Liveness check for Kubernetes
  fastify.get('/live', async (request, reply) => {
    reply.send({ 
      status: 'alive',
      pid: process.pid,
      uptime: process.uptime()
    });
  });
};

export default healthRoutes;