import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { performance } from 'perf_hooks';

// Base error class with enhanced metadata
export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  abstract readonly severity: 'low' | 'medium' | 'high' | 'critical';
  abstract readonly isOperational: boolean;
  
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly metadata?: any;
  
  constructor(message: string, metadata?: any, requestId?: string) {
    super(message);
    this.timestamp = new Date();
    this.metadata = metadata;
    this.requestId = requestId;
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  abstract toJSON(): object;
}

// Application-specific error classes
export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly severity = 'medium' as const;
  readonly isOperational = true;
  
  constructor(message: string, public validationErrors?: any[], requestId?: string) {
    super(message, { validationErrors }, requestId);
    this.name = 'ValidationError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId,
        validationErrors: this.validationErrors
      }
    };
  }
}

export class SecurityError extends BaseError {
  readonly statusCode = 403;
  readonly code = 'SECURITY_ERROR';
  readonly severity = 'critical' as const;
  readonly isOperational = true;
  
  constructor(message: string, public securityCode?: string, metadata?: any, requestId?: string) {
    super(message, { securityCode, ...metadata }, requestId);
    this.name = 'SecurityError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId,
        securityCode: this.metadata?.securityCode
      }
    };
  }
}

export class AuthenticationError extends BaseError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR';
  readonly severity = 'high' as const;
  readonly isOperational = true;
  
  constructor(message: string = 'Authentication required', metadata?: any, requestId?: string) {
    super(message, metadata, requestId);
    this.name = 'AuthenticationError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId
      }
    };
  }
}

export class AuthorizationError extends BaseError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_ERROR';
  readonly severity = 'high' as const;
  readonly isOperational = true;
  
  constructor(message: string = 'Insufficient permissions', metadata?: any, requestId?: string) {
    super(message, metadata, requestId);
    this.name = 'AuthorizationError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId
      }
    };
  }
}

export class RateLimitError extends BaseError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_ERROR';
  readonly severity = 'medium' as const;
  readonly isOperational = true;
  
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number,
    metadata?: any,
    requestId?: string
  ) {
    super(message, { retryAfter, ...metadata }, requestId);
    this.name = 'RateLimitError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId,
        retryAfter: this.retryAfter
      }
    };
  }
}

export class OptimizationError extends BaseError {
  readonly statusCode = 422;
  readonly code = 'OPTIMIZATION_ERROR';
  readonly severity = 'medium' as const;
  readonly isOperational = true;
  
  constructor(
    message: string,
    public optimizationCode?: string,
    metadata?: any,
    requestId?: string
  ) {
    super(message, { optimizationCode, ...metadata }, requestId);
    this.name = 'OptimizationError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId,
        optimizationCode: this.metadata?.optimizationCode
      }
    };
  }
}

export class ResourceError extends BaseError {
  readonly statusCode = 503;
  readonly code = 'RESOURCE_ERROR';
  readonly severity = 'high' as const;
  readonly isOperational = true;
  
  constructor(
    message: string,
    public resourceType?: string,
    metadata?: any,
    requestId?: string
  ) {
    super(message, { resourceType, ...metadata }, requestId);
    this.name = 'ResourceError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId,
        resourceType: this.metadata?.resourceType
      }
    };
  }
}

export class DatabaseError extends BaseError {
  readonly statusCode = 500;
  readonly code = 'DATABASE_ERROR';
  readonly severity = 'critical' as const;
  readonly isOperational = true;
  
  constructor(message: string, metadata?: any, requestId?: string) {
    super(message, metadata, requestId);
    this.name = 'DatabaseError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: 'An internal database error occurred',
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId
      }
    };
  }
}

export class SystemError extends BaseError {
  readonly statusCode = 500;
  readonly code = 'SYSTEM_ERROR';
  readonly severity = 'critical' as const;
  readonly isOperational = false;
  
  constructor(message: string, metadata?: any, requestId?: string) {
    super(message, metadata, requestId);
    this.name = 'SystemError';
  }
  
  toJSON() {
    return {
      success: false,
      error: {
        type: this.name,
        code: this.code,
        message: 'An internal system error occurred',
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId
      }
    };
  }
}

// Error factory for creating typed errors
export class ErrorFactory {
  static validation(message: string, validationErrors?: any[], requestId?: string): ValidationError {
    return new ValidationError(message, validationErrors, requestId);
  }
  
  static security(message: string, securityCode?: string, metadata?: any, requestId?: string): SecurityError {
    return new SecurityError(message, securityCode, metadata, requestId);
  }
  
  static authentication(message?: string, metadata?: any, requestId?: string): AuthenticationError {
    return new AuthenticationError(message, metadata, requestId);
  }
  
  static authorization(message?: string, metadata?: any, requestId?: string): AuthorizationError {
    return new AuthorizationError(message, metadata, requestId);
  }
  
  static rateLimit(message?: string, retryAfter?: number, metadata?: any, requestId?: string): RateLimitError {
    return new RateLimitError(message, retryAfter, metadata, requestId);
  }
  
  static optimization(message: string, optimizationCode?: string, metadata?: any, requestId?: string): OptimizationError {
    return new OptimizationError(message, optimizationCode, metadata, requestId);
  }
  
  static resource(message: string, resourceType?: string, metadata?: any, requestId?: string): ResourceError {
    return new ResourceError(message, resourceType, metadata, requestId);
  }
  
  static database(message: string, metadata?: any, requestId?: string): DatabaseError {
    return new DatabaseError(message, metadata, requestId);
  }
  
  static system(message: string, metadata?: any, requestId?: string): SystemError {
    return new SystemError(message, metadata, requestId);
  }
}

// Error logger with different severity levels
class ErrorLogger {
  static log(error: BaseError, req?: Request): void {
    const logEntry = {
      timestamp: error.timestamp.toISOString(),
      type: error.name,
      code: error.code,
      message: error.message,
      severity: error.severity,
      statusCode: error.statusCode,
      requestId: error.requestId,
      metadata: error.metadata,
      request: req ? {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id
      } : undefined,
      stack: error.severity === 'critical' ? error.stack : undefined
    };
    
    switch (error.severity) {
      case 'critical':
        console.error('CRITICAL ERROR:', logEntry);
        // Could integrate with external monitoring service
        break;
      case 'high':
        console.error('HIGH SEVERITY ERROR:', logEntry);
        break;
      case 'medium':
        console.warn('MEDIUM SEVERITY ERROR:', logEntry);
        break;
      case 'low':
        console.log('LOW SEVERITY ERROR:', logEntry);
        break;
    }
  }
}

// Enhanced error handler middleware
export function typedErrorHandler() {
  return (error: any, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || 
                     req.headers['request-id'] as string ||
                     `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let typedError: BaseError;
    
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const validationErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
        received: err.input
      }));
      
      typedError = ErrorFactory.validation(
        'Input validation failed',
        validationErrors,
        requestId
      );
    }
    // Handle existing typed errors
    else if (error instanceof BaseError) {
      typedError = error;
      if (!typedError.requestId) {
        (typedError as any).requestId = requestId;
      }
    }
    // Handle generic errors
    else {
      const message = error.message || 'An unexpected error occurred';
      const isOperational = error.isOperational || false;
      
      if (isOperational) {
        typedError = ErrorFactory.system(message, { originalError: error.name }, requestId);
      } else {
        typedError = ErrorFactory.system(message, { originalError: error.name }, requestId);
      }
    }
    
    // Log the error
    ErrorLogger.log(typedError, req);
    
    // Set response headers
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Error-Code', typedError.code);
    
    // Send error response
    res.status(typedError.statusCode).json(typedError.toJSON());
  };
}

// Async error handler wrapper
export function asyncErrorHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || 
                     `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    req.headers['x-request-id'] = requestId;
    
    Promise.resolve(fn(req, res, next)).catch((error) => {
      next(error);
    });
  };
}

// Error metrics collection
class ErrorMetrics {
  private static errorCounts = new Map<string, number>();
  private static errorTrends = new Map<string, number[]>();
  
  static track(error: BaseError): void {
    const key = `${error.code}_${error.severity}`;
    
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    
    if (!this.errorTrends.has(key)) {
      this.errorTrends.set(key, []);
    }
    
    const trends = this.errorTrends.get(key)!;
    trends.push(Date.now());
    
    // Keep only last hour of data
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.errorTrends.set(key, trends.filter(timestamp => timestamp > oneHourAgo));
  }
  
  static getMetrics() {
    const metrics = {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorsByType: Object.fromEntries(this.errorCounts),
      recentTrends: Object.fromEntries(
        Array.from(this.errorTrends.entries()).map(([key, timestamps]) => [
          key,
          {
            count: timestamps.length,
            rate: timestamps.length / 60 // errors per minute
          }
        ])
      )
    };
    
    return metrics;
  }
  
  static reset(): void {
    this.errorCounts.clear();
    this.errorTrends.clear();
  }
}

// Middleware to add error metrics tracking
export function errorMetricsMiddleware() {
  return (error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof BaseError) {
      ErrorMetrics.track(error);
    }
    next(error);
  };
}

// Export error metrics for monitoring endpoints
export { ErrorMetrics };

// Health check for error system
export function errorSystemHealthCheck() {
  const metrics = ErrorMetrics.getMetrics();
  const criticalErrorRate = Object.entries(metrics.recentTrends)
    .filter(([key]) => key.includes('critical'))
    .reduce((sum, [, data]) => sum + (data as any).rate, 0);
  
  return {
    healthy: criticalErrorRate < 1, // Less than 1 critical error per minute
    metrics,
    criticalErrorRate,
    timestamp: new Date().toISOString()
  };
}
