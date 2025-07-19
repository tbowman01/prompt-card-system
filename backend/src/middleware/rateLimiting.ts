import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response } from 'express';

// Redis store for distributed rate limiting (optional)
// import RedisStore from 'rate-limit-redis';
// import Redis from 'ioredis';

// const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

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
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      limit: 100,
      windowMs: 15 * 60 * 1000,
      retryAfter: Math.round(15 * 60),
      ip: req.ip,
      path: req.path
    });
  }
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
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Authentication rate limit exceeded',
      limit: 5,
      windowMs: 15 * 60 * 1000,
      retryAfter: Math.round(15 * 60),
      ip: req.ip,
      path: req.path
    });
  }
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
  legacyHeaders: false
});