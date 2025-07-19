import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { randomBytes, createHash } from 'crypto';

// CSRF Protection
interface CSRFStore {
  [sessionId: string]: {
    token: string;
    expires: number;
  };
}

const csrfTokens: CSRFStore = {};
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

// Generate CSRF token
export const generateCSRFToken = (sessionId: string): string => {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + CSRF_TOKEN_EXPIRY;
  
  csrfTokens[sessionId] = { token, expires };
  
  // Clean up expired tokens
  cleanupExpiredCSRFTokens();
  
  return token;
};

// Validate CSRF token
export const validateCSRFToken = (sessionId: string, token: string): boolean => {
  const stored = csrfTokens[sessionId];
  
  if (!stored || stored.expires < Date.now()) {
    delete csrfTokens[sessionId];
    return false;
  }
  
  return stored.token === token;
};

// Clean up expired CSRF tokens
const cleanupExpiredCSRFTokens = (): void => {
  const now = Date.now();
  Object.keys(csrfTokens).forEach(sessionId => {
    if (csrfTokens[sessionId].expires < now) {
      delete csrfTokens[sessionId];
    }
  });
};

// CSRF middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  
  // Skip CSRF for API endpoints that use Bearer token authentication
  if (req.headers.authorization?.startsWith('Bearer ')) {
    next();
    return;
  }
  
  const sessionId = req.headers['x-session-id'] as string;
  const csrfToken = req.headers['x-csrf-token'] as string;
  
  if (!sessionId || !csrfToken || !validateCSRFToken(sessionId, csrfToken)) {
    res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
    return;
  }
  
  next();
};

// Generate CSRF token endpoint
export const getCSRFToken = (req: Request, res: Response): void => {
  const sessionId = req.headers['x-session-id'] as string || randomBytes(16).toString('hex');
  const token = generateCSRFToken(sessionId);
  
  res.json({
    success: true,
    data: {
      csrfToken: token,
      sessionId: sessionId
    }
  });
};

// Enhanced Helmet configuration
export const enhancedHelmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: { policy: 'credentialless' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true
});

// Request ID middleware for tracing
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || randomBytes(16).toString('hex');
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

// Request logging middleware with security context
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id']
  };
  
  console.log('Security Log - Request:', JSON.stringify(logData));
  
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('X-Powered-By');
  
  next();
};

// Clean up security resources periodically
setInterval(() => {
  cleanupExpiredCSRFTokens();
}, 60 * 60 * 1000); // Clean up every hour