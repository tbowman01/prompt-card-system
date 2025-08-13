import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'crypto';
import slowDown from 'express-slow-down';

// Security logger interface
interface SecurityLogger {
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
}

// Default security logger implementation
const securityLogger: SecurityLogger = {
  warn: (message: string, meta?: any) => {
    // In production, this would be replaced with structured logging
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn(`[SECURITY] ${message}`, meta || '');
    }
  },
  error: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.error(`[SECURITY] ${message}`, meta || '');
    }
  },
  info: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.info(`[SECURITY] ${message}`, meta || '');
    }
  }
};

// Advanced Security Configuration
interface SecurityConfig {
  maxFailedAttempts: number;
  lockoutDuration: number;
  suspiciousActivityThreshold: number;
  maxPayloadSize: number;
  enableFingerprinting: boolean;
  enableBehaviorAnalysis: boolean;
}

interface SecurityMetrics {
  blockedRequests: number;
  suspiciousActivity: number;
  rateLimitHits: number;
  csrfAttempts: number;
  sqlInjectionAttempts: number;
  xssAttempts: number;
  fileUploadAttempts: number;
}

interface IPAttempts {
  count: number;
  lastAttempt: number;
  blocked: boolean;
  patterns: string[];
}

const defaultConfig: SecurityConfig = {
  maxFailedAttempts: 10,
  lockoutDuration: 24 * 60 * 60 * 1000, // 24 hours
  suspiciousActivityThreshold: 5,
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  enableFingerprinting: true,
  enableBehaviorAnalysis: true
};

// Security tracking
const securityMetrics: SecurityMetrics = {
  blockedRequests: 0,
  suspiciousActivity: 0,
  rateLimitHits: 0,
  csrfAttempts: 0,
  sqlInjectionAttempts: 0,
  xssAttempts: 0,
  fileUploadAttempts: 0
};

const ipAttempts = new Map<string, IPAttempts>();
const suspiciousIPs = new Set<string>();
const trustedIPs = new Set<string>(process.env.TRUSTED_IPS?.split(',') || []);

// Enhanced threat detection patterns
const threatPatterns = {
  sqlInjection: [
    /(\b(union|select|insert|delete|update|drop|create|alter|exec|execute)\b)/gi,
    /(\b(or|and)\s+\d+\s*=\s*\d+)/gi,
    /('|")(\s*)(or|and)(\s*)('|")\s*=\s*('|")/gi,
    /(;|\||&|\$|>|<)/g
  ],
  xss: [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /document\./gi,
    /window\./gi,
    /<img[^>]+src[^>]*>/gi
  ],
  pathTraversal: [
    /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/gi,
    /\.\.\//g,
    /\.\.%2f/gi,
    /\.\.%5c/gi
  ],
  commandInjection: [
    /(\||;|&|`|\$\(|\${)/g,
    /(nc|netcat|wget|curl|chmod|rm|cat|ls|ps|id|whoami)/gi
  ]
};

// Advanced IP-based threat detection
export const advancedThreatDetection = (config: Partial<SecurityConfig> = {}) => {
  const finalConfig = { ...defaultConfig, ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Skip trusted IPs
    if (trustedIPs.has(clientIP)) {
      return next();
    }
    
    // Check if IP is blocked
    if (suspiciousIPs.has(clientIP)) {
      securityMetrics.blockedRequests++;
      return res.status(403).json({
        success: false,
        error: 'Access denied due to suspicious activity',
        code: 'IP_BLOCKED',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get or create IP attempts record
    const attempts = ipAttempts.get(clientIP) || {
      count: 0,
      lastAttempt: 0,
      blocked: false,
      patterns: []
    };
    
    // Reset attempts after lockout duration
    if (now - attempts.lastAttempt > finalConfig.lockoutDuration) {
      attempts.count = 0;
      attempts.patterns = [];
    }
    
    // Analyze request for malicious patterns
    const requestData = JSON.stringify({
      url: req.url,
      query: req.query,
      body: req.body,
      headers: req.headers
    });
    
    const suspiciousPatterns: string[] = [];
    
    // Check for SQL injection
    for (const pattern of threatPatterns.sqlInjection) {
      if (pattern.test(requestData)) {
        suspiciousPatterns.push('sql-injection');
        securityMetrics.sqlInjectionAttempts++;
        break;
      }
    }
    
    // Check for XSS
    for (const pattern of threatPatterns.xss) {
      if (pattern.test(requestData)) {
        suspiciousPatterns.push('xss');
        securityMetrics.xssAttempts++;
        break;
      }
    }
    
    // Check for path traversal
    for (const pattern of threatPatterns.pathTraversal) {
      if (pattern.test(requestData)) {
        suspiciousPatterns.push('path-traversal');
        break;
      }
    }
    
    // Check for command injection
    for (const pattern of threatPatterns.commandInjection) {
      if (pattern.test(requestData)) {
        suspiciousPatterns.push('command-injection');
        break;
      }
    }
    
    // Update attempts if suspicious patterns found
    if (suspiciousPatterns.length > 0) {
      attempts.count++;
      attempts.lastAttempt = now;
      attempts.patterns.push(...suspiciousPatterns);
      ipAttempts.set(clientIP, attempts);
      
      // Block IP if threshold exceeded
      if (attempts.count >= finalConfig.maxFailedAttempts) {
        suspiciousIPs.add(clientIP);
        securityMetrics.suspiciousActivity++;
        
        securityLogger.warn(`IP ${clientIP} blocked after ${attempts.count} suspicious attempts. Patterns: ${attempts.patterns.join(', ')}`);
        
        return res.status(403).json({
          success: false,
          error: 'Access denied due to suspicious activity',
          code: 'SUSPICIOUS_ACTIVITY_DETECTED',
          timestamp: new Date().toISOString()
        });
      }
      
      // Log suspicious activity
      securityLogger.warn(`Suspicious activity from IP ${clientIP}. Patterns: ${suspiciousPatterns.join(', ')}`);
    }
    
    next();
  };
};

// Enhanced input validation and sanitization
export const enhancedInputValidation = (req: Request, res: Response, next: NextFunction): void => {
  // Check content length
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > defaultConfig.maxPayloadSize) {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  // Deep sanitization function
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/eval\s*\(/gi, '')
        .replace(/document\./gi, '')
        .replace(/window\./gi, '')
        .replace(/alert\s*\(/gi, '')
        .replace(/confirm\s*\(/gi, '')
        .replace(/prompt\s*\(/gi, '')
        .trim();
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
        if (sanitizedKey) {
          sanitized[sanitizedKey] = sanitizeValue(val);
        }
      }
      return sanitized;
    }
    return value;
  };
  
  // Sanitize request data
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  
  next();
};

// Browser fingerprinting for additional security
export const browserFingerprinting = (req: Request, res: Response, next: NextFunction): void => {
  if (!defaultConfig.enableFingerprinting) {
    return next();
  }
  
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const acceptCharset = req.headers['accept-charset'] || '';
  
  const fingerprint = createHash('sha256')
    .update(userAgent + acceptLanguage + acceptEncoding + acceptCharset)
    .digest('hex');
  
  // Store fingerprint in request for later use
  (req as any).fingerprint = fingerprint;
  
  next();
};

// Advanced rate limiting with different tiers
export const createAdvancedRateLimit = (options: {
  windowMs: number;
  max: number;
  message: string;
  tier: 'low' | 'medium' | 'high' | 'critical';
  skipTrusted?: boolean;
}) => {
  const { windowMs, max, message, tier, skipTrusted = true } = options;
  
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      tier,
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      if (skipTrusted) {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        return trustedIPs.has(clientIP);
      }
      return false;
    },
    handler: (req, res) => {
      securityMetrics.rateLimitHits++;
      const clientIP = req.ip || 'unknown';
      
      // Track rate limit violations
      const attempts = ipAttempts.get(clientIP) || {
        count: 0,
        lastAttempt: 0,
        blocked: false,
        patterns: []
      };
      
      attempts.count++;
      attempts.lastAttempt = Date.now();
      attempts.patterns.push('rate-limit-exceeded');
      ipAttempts.set(clientIP, attempts);
      
      securityLogger.warn(`Rate limit exceeded for IP ${clientIP} on tier ${tier}`);
      
      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        tier,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
  });
};

// Slow down middleware for suspicious behavior
export const createSlowDown = (options: {
  windowMs: number;
  delayAfter: number;
  delayMs: number;
  maxDelayMs: number;
}) => {
  return slowDown({
    windowMs: options.windowMs,
    delayAfter: options.delayAfter,
    delayMs: options.delayMs,
    maxDelayMs: options.maxDelayMs,
    skip: (req) => {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      return trustedIPs.has(clientIP);
    }
  });
};

// Pre-configured rate limits
export const rateLimits = {
  general: createAdvancedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP',
    tier: 'low'
  }),
  
  auth: createAdvancedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts',
    tier: 'high',
    skipTrusted: false
  }),
  
  api: createAdvancedRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: 'API rate limit exceeded',
    tier: 'medium'
  }),
  
  upload: createAdvancedRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Upload rate limit exceeded',
    tier: 'high'
  }),
  
  critical: createAdvancedRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3,
    message: 'Critical operation rate limit exceeded',
    tier: 'critical',
    skipTrusted: false
  })
};

// Slow down configurations
export const slowDownConfigs = {
  general: createSlowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50,
    delayMs: 500,
    maxDelayMs: 20000
  }),
  
  suspicious: createSlowDown({
    windowMs: 5 * 60 * 1000, // 5 minutes
    delayAfter: 3,
    delayMs: 1000,
    maxDelayMs: 60000
  })
};

// Security metrics endpoint
export const getSecurityMetrics = (req: Request, res: Response): void => {
  res.json({
    success: true,
    metrics: {
      ...securityMetrics,
      suspiciousIPs: suspiciousIPs.size,
      trackedIPs: ipAttempts.size,
      trustedIPs: trustedIPs.size,
      timestamp: new Date().toISOString()
    },
    config: {
      maxFailedAttempts: defaultConfig.maxFailedAttempts,
      lockoutDuration: defaultConfig.lockoutDuration,
      maxPayloadSize: defaultConfig.maxPayloadSize
    }
  });
};

// Security status endpoint
export const getSecurityStatus = (req: Request, res: Response): void => {
  const recentActivity = Array.from(ipAttempts.entries())
    .filter(([, attempts]) => Date.now() - attempts.lastAttempt < 60 * 60 * 1000)
    .map(([ip, attempts]) => ({
      ip: ip.replace(/\d+$/, 'xxx'), // Mask last octet for privacy
      attempts: attempts.count,
      patterns: attempts.patterns,
      lastActivity: new Date(attempts.lastAttempt).toISOString()
    }));
  
  res.json({
    success: true,
    status: {
      threatLevel: suspiciousIPs.size > 10 ? 'high' : suspiciousIPs.size > 5 ? 'medium' : 'low',
      blockedIPs: suspiciousIPs.size,
      recentActivity: recentActivity.slice(0, 10), // Limit to 10 most recent
      systemHealth: {
        rateLimitHits: securityMetrics.rateLimitHits,
        blockedRequests: securityMetrics.blockedRequests,
        suspiciousActivity: securityMetrics.suspiciousActivity
      },
      timestamp: new Date().toISOString()
    }
  });
};

// Cleanup function
export const cleanupSecurityData = (): void => {
  const now = Date.now();
  const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours
  
  // Clean up old IP attempts
  for (const [ip, attempts] of ipAttempts.entries()) {
    if (now - attempts.lastAttempt > cleanupThreshold) {
      ipAttempts.delete(ip);
    }
  }
  
  // Reset metrics daily
  if (now % (24 * 60 * 60 * 1000) < 60 * 60 * 1000) { // Reset once per day
    Object.keys(securityMetrics).forEach(key => {
      (securityMetrics as any)[key] = 0;
    });
  }
  
  securityLogger.info(`Security cleanup completed. Tracking ${ipAttempts.size} IPs, ${suspiciousIPs.size} blocked.`);
};

// Start cleanup interval
setInterval(cleanupSecurityData, 60 * 60 * 1000); // Run every hour

export { securityMetrics, ipAttempts, suspiciousIPs, trustedIPs };