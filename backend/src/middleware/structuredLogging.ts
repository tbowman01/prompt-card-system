import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

// Enhanced structured logging with correlation IDs and security context
export interface LogContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  userRole?: string;
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  timestamp: string;
  duration?: number;
  statusCode?: number;
  errorCode?: string;
  securityContext?: {
    authMethod?: string;
    rateLimit?: {
      hits: number;
      remaining: number;
    };
    suspicious?: boolean;
    geoLocation?: string;
    fingerprint?: string;
  };
  metadata?: Record<string, any>;
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private logBuffer: LogContext[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 10000; // 10 seconds

  private constructor() {
    // Flush logs periodically
    setInterval(() => this.flushLogs(), this.FLUSH_INTERVAL);
  }

  public static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  public log(level: 'info' | 'warn' | 'error' | 'debug', context: LogContext, message: string): void {
    const logEntry = {
      level,
      message,
      ...context,
      bufferTimestamp: new Date().toISOString()
    };

    // Enhanced console logging with structured format
    const structuredLog = {
      '@timestamp': context.timestamp,
      '@version': '1',
      level,
      message,
      correlation_id: context.correlationId,
      request_id: context.requestId,
      user: {
        id: context.userId,
        role: context.userRole
      },
      request: {
        method: context.method,
        url: context.url,
        ip: context.ip,
        user_agent: context.userAgent,
        duration_ms: context.duration,
        status_code: context.statusCode
      },
      security: context.securityContext,
      error_code: context.errorCode,
      metadata: context.metadata
    };

    // Color-coded console output for development
    if (process.env.NODE_ENV !== 'production') {
      const colors = {
        info: '\x1b[36m',    // Cyan
        warn: '\x1b[33m',    // Yellow
        error: '\x1b[31m',   // Red
        debug: '\x1b[35m',   // Magenta
        reset: '\x1b[0m'
      };

      console.log(
        `${colors[level]}[${level.toUpperCase()}]${colors.reset} ` +
        `${context.timestamp} ` +
        `[${context.correlationId}] ` +
        `${context.method} ${context.url} ` +
        `${context.statusCode || 'PENDING'} ` +
        `${context.duration ? `${context.duration}ms` : ''} ` +
        `- ${message}`
      );
    }

    // Structured JSON logging for production
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(structuredLog));
    }

    // Add to buffer for batch processing
    this.logBuffer.push(context);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.flushLogs();
    }
  }

  private flushLogs(): void {
    if (this.logBuffer.length === 0) return;

    // In production, this would send to centralized logging system
    // For now, we'll just clear the buffer
    this.logBuffer = [];
  }

  public getMetrics(): { totalLogs: number; errorCount: number; averageResponseTime: number } {
    const logs = this.logBuffer;
    const errorCount = logs.filter(log => log.statusCode && log.statusCode >= 400).length;
    const responseTimes = logs.filter(log => log.duration).map(log => log.duration!);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    return {
      totalLogs: logs.length,
      errorCount,
      averageResponseTime: Math.round(averageResponseTime)
    };
  }
}

export const structuredLogger = StructuredLogger.getInstance();

// Middleware to add correlation ID and structured logging
export const structuredLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const correlationId = (req.headers['x-correlation-id'] as string) || randomBytes(8).toString('hex');
  const requestId = (req.headers['x-request-id'] as string) || randomBytes(8).toString('hex');

  // Add correlation ID to request for downstream use
  req.headers['x-correlation-id'] = correlationId;
  req.headers['x-request-id'] = requestId;

  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', requestId);

  // Create base log context
  const baseContext: Partial<LogContext> = {
    correlationId,
    requestId,
    userId: req.user?.id,
    userRole: req.user?.role,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    securityContext: {
      authMethod: req.headers.authorization ? 'Bearer' : 'none',
      suspicious: false,
      fingerprint: generateFingerprint(req)
    }
  };

  // Log request start
  structuredLogger.log('info', baseContext as LogContext, `Request started: ${req.method} ${req.url}`);

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): any {
    const duration = Date.now() - startTime;
    const finalContext: LogContext = {
      ...baseContext as LogContext,
      duration,
      statusCode: res.statusCode
    };

    // Determine log level based on status code
    let level: 'info' | 'warn' | 'error' = 'info';
    const message = `Request completed: ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`;

    if (res.statusCode >= 500) {
      level = 'error';
      finalContext.errorCode = 'SERVER_ERROR';
    } else if (res.statusCode >= 400) {
      level = 'warn';
      finalContext.errorCode = 'CLIENT_ERROR';
    }

    // Add security context for suspicious activity
    if (res.statusCode === 429) {
      finalContext.securityContext!.suspicious = true;
      finalContext.errorCode = 'RATE_LIMIT_EXCEEDED';
      level = 'warn';
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      finalContext.securityContext!.suspicious = true;
      finalContext.errorCode = res.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN';
      level = 'warn';
    }

    structuredLogger.log(level, finalContext, message);
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Generate a simple fingerprint for request tracking
function generateFingerprint(req: Request): string {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.ip || ''
  ];
  
  // Simple hash of combined components
  return Buffer.from(components.join('|')).toString('base64').substring(0, 12);
}

// Security event logging
export const logSecurityEvent = (
  eventType: 'auth_success' | 'auth_failure' | 'rate_limit' | 'suspicious_activity' | 'vulnerability_detected',
  req: Request,
  details: Record<string, any> = {}
): void => {
  const context: LogContext = {
    correlationId: (req.headers['x-correlation-id'] as string) || 'unknown',
    requestId: (req.headers['x-request-id'] as string) || 'unknown',
    userId: req.user?.id,
    userRole: req.user?.role,
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    securityContext: {
      authMethod: req.headers.authorization ? 'Bearer' : 'none',
      suspicious: true,
      fingerprint: generateFingerprint(req)
    },
    metadata: {
      eventType,
      ...details
    }
  };

  structuredLogger.log('warn', context, `Security event: ${eventType}`);
};

// Performance monitoring middleware
export const performanceLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    const performanceData = {
      correlationId: req.headers['x-correlation-id'],
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      memory: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      }
    };

    // Log performance warning for slow requests
    if (duration > 1000) { // Slower than 1 second
      const context: LogContext = {
        correlationId: performanceData.correlationId as string || 'unknown',
        requestId: performanceData.requestId as string || 'unknown',
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString(),
        duration,
        statusCode: res.statusCode,
        metadata: performanceData
      };

      structuredLogger.log('warn', context, `Slow request detected: ${duration}ms`);
    }
  });

  next();
};