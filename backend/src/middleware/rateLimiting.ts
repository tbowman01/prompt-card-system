import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from './structuredLogging';

// Redis store for distributed rate limiting (optional)
// import RedisStore from 'rate-limit-redis';
// import Redis from 'ioredis';

// const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Enhanced rate limiting with security monitoring
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: object;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipSuccessfulRequests?: boolean;
  handler: (req: Request, res: Response) => void;
}

// Rate limit violation tracking
const rateLimitViolations = new Map<string, { count: number; lastViolation: Date }>();

// Enhanced rate limit handler with security logging
const createRateLimitHandler = (limitType: string, limit: number, windowMs: number) => {
  return (req: Request, res: Response): void => {
    const clientId = req.ip || 'unknown';
    const now = new Date();
    
    // Track violations
    const violations = rateLimitViolations.get(clientId) || { count: 0, lastViolation: new Date(0) };
    violations.count += 1;
    violations.lastViolation = now;
    rateLimitViolations.set(clientId, violations);

    // Log security event
    logSecurityEvent('rate_limit', req, {
      limitType,
      limit,
      windowMs,
      violationCount: violations.count,
      userAgent: req.headers['user-agent'],
      path: req.path
    });

    // Enhanced response with security headers
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      type: limitType,
      limit,
      windowMs,
      retryAfter: Math.round(windowMs / 1000),
      ip: req.ip,
      path: req.path,
      violationCount: violations.count,
      timestamp: now.toISOString()
    });
  };
};

// General API rate limit
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.call(...args),
  // }),
  handler: createRateLimitHandler('general', 100, 15 * 60 * 1000)
});

// Strict rate limit for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: createRateLimitHandler('authentication', 5, 15 * 60 * 1000)
});

// API rate limit for high-frequency endpoints
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 requests per minute
  message: {
    success: false,
    error: 'API rate limit exceeded',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Test execution rate limit (more permissive for testing)
export const testExecutionRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit each IP to 20 test executions per 5 minutes
  message: {
    success: false,
    error: 'Test execution rate limit exceeded',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Slow down middleware for additional protection
export const speedLimiter: any = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes at full speed
  delayMs: (used: number) => {
    return (used - 50) * 500; // Add 500ms delay for each request after delayAfter
  },
  maxDelayMs: 10000, // Maximum delay of 10 seconds
  skipFailedRequests: false,
  skipSuccessfulRequests: false
});

// Heavy operation rate limit (for resource-intensive operations)
export const heavyOperationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 heavy operations per hour
  message: {
    success: false,
    error: 'Heavy operation rate limit exceeded',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// File upload rate limit
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: {
    success: false,
    error: 'Upload rate limit exceeded',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('upload', 20, 60 * 60 * 1000)
});

// Comprehensive endpoint-specific rate limiting
export const endpointRateLimits = {
  // Critical security endpoints
  '/api/auth/login': rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3, // Very strict for login
    handler: createRateLimitHandler('login', 3, 15 * 60 * 1000)
  }),
  
  '/api/auth/register': rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3, // Only 3 registrations per hour per IP
    handler: createRateLimitHandler('register', 3, 60 * 60 * 1000)
  }),

  '/api/auth/refresh': rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10, // 10 token refreshes per 5 minutes
    handler: createRateLimitHandler('refresh', 10, 5 * 60 * 1000)
  }),

  // API endpoints
  '/api/prompt-cards': rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    handler: createRateLimitHandler('prompt-cards', 30, 1 * 60 * 1000)
  }),

  '/api/test-execution': rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 15,
    handler: createRateLimitHandler('test-execution', 15, 5 * 60 * 1000)
  }),

  '/api/analytics': rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 25,
    handler: createRateLimitHandler('analytics', 25, 1 * 60 * 1000)
  }),

  '/api/security': rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    handler: createRateLimitHandler('security', 10, 5 * 60 * 1000)
  })
};

// Dynamic rate limiting based on user behavior
export const dynamicRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const clientId = req.ip || 'unknown';
  const violations = rateLimitViolations.get(clientId);

  // If client has multiple violations, apply stricter limits
  if (violations && violations.count > 5) {
    const timeSinceLastViolation = Date.now() - violations.lastViolation.getTime();
    
    // If recent violations, block temporarily
    if (timeSinceLastViolation < 60 * 60 * 1000) { // 1 hour
      logSecurityEvent('suspicious_activity', req, {
        reason: 'Multiple rate limit violations',
        violationCount: violations.count,
        action: 'temporary_block'
      });

      res.status(429).json({
        success: false,
        error: 'Temporary block due to suspicious activity',
        retryAfter: 3600,
        violationCount: violations.count
      });
      return;
    }
  }

  next();
};

// Cleanup expired violation records
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [clientId, violations] of rateLimitViolations.entries()) {
    if (violations.lastViolation < oneHourAgo) {
      rateLimitViolations.delete(clientId);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

// Rate limiting statistics
export const getRateLimitStats = (): {
  totalViolations: number;
  uniqueClients: number;
  topViolators: Array<{ clientId: string; count: number; lastViolation: Date }>;
} => {
  const totalViolations = Array.from(rateLimitViolations.values())
    .reduce((sum, violations) => sum + violations.count, 0);
  
  const uniqueClients = rateLimitViolations.size;
  
  const topViolators = Array.from(rateLimitViolations.entries())
    .map(([clientId, violations]) => ({ clientId, ...violations }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalViolations,
    uniqueClients,
    topViolators
  };
};