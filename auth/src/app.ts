import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import redis from '@fastify/redis';
import cookie from '@fastify/cookie';

// Import route handlers
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';

// Import types and config
import { AppConfig, loadConfig } from './config/config';
import { errorHandler } from './middleware/error-handler';
import { auditLogger } from './middleware/audit-logger';

export function buildApp(): FastifyInstance {
  const config = loadConfig();
  
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    },
    bodyLimit: 1024 * 1024 // 1MB limit for security
  });

  // Register error handler
  app.setErrorHandler(errorHandler);

  // Security middleware
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  // CORS configuration
  app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  });

  // JWT configuration
  app.register(jwt, {
    secret: config.jwtSecret,
    sign: {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn
    },
    verify: {
      algorithms: ['HS256']
    }
  });

  // Redis for session storage and rate limiting
  app.register(redis, {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db
  });

  // Rate limiting
  app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    redis: app.redis,
    keyGenerator: (request) => {
      return request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Rate limit exceeded',
        message: `Too many requests, please try again in ${Math.round(context.ttl / 1000)} seconds`,
        statusCode: 429
      };
    }
  });

  // Cookie support for secure token handling
  app.register(cookie, {
    secret: config.jwtSecret,
    parseOptions: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict'
    }
  });

  // Audit logging middleware
  app.addHook('onRequest', auditLogger);

  // Register routes
  app.register(healthRoutes, { prefix: '/auth' });
  app.register(authRoutes, { prefix: '/auth' });

  return app;
}

export { AppConfig };