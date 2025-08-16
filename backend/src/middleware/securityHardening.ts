import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { z } from 'zod';
import crypto from 'crypto';
import { promisify } from 'util';
import { performance } from 'perf_hooks';

// Critical security error classes
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: 'low' | 'medium' | 'high' | 'critical',
    public metadata?: any
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class PromptInjectionError extends SecurityError {
  constructor(message: string, metadata?: any) {
    super(message, 'PROMPT_INJECTION', 'critical', metadata);
    this.name = 'PromptInjectionError';
  }
}

export class InputValidationError extends SecurityError {
  constructor(message: string, metadata?: any) {
    super(message, 'INPUT_VALIDATION', 'high', metadata);
    this.name = 'InputValidationError';
  }
}

// Prompt injection prevention patterns
const DANGEROUS_PATTERNS = [
  // Direct instruction bypass
  /ignore\s+(previous|all|prior|above|earlier)\s+(instruction|prompt|rule|command)s?/gi,
  /disregard\s+(previous|all|prior|above|earlier)\s+(instruction|prompt|rule|command)s?/gi,
  /forget\s+(everything|all|previous|prior|above|earlier)/gi,
  
  // System manipulation
  /system\s*(prompt|instruction|command|role)/gi,
  /you\s+are\s+(not|now)\s+(a|an)?\s*\w+/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /act\s+as\s+(if\s+you\s+are)?/gi,
  /role\s*play/gi,
  
  // Jailbreak attempts
  /jailbreak/gi,
  /developer\s*mode/gi,
  /debug\s*mode/gi,
  /admin\s*mode/gi,
  
  // Override attempts
  /override\s+(security|safety|filter|rule)/gi,
  /bypass\s+(security|safety|filter|rule)/gi,
  /disable\s+(security|safety|filter|rule)/gi,
  
  // Sensitive information exposure
  /show\s+(me\s+)?(your\s+)?(api\s*key|password|secret|token)/gi,
  /what\s+(is\s+)?(your\s+)?(api\s*key|password|secret|token)/gi,
  /reveal\s+(your\s+)?(api\s*key|password|secret|token)/gi,
  
  // Instruction manipulation
  /end\s+of\s+(instruction|prompt|rule)/gi,
  /new\s+(instruction|prompt|rule|command)/gi,
  /updated\s+(instruction|prompt|rule|command)/gi,
  
  // Social engineering
  /urgent|emergency|immediately|asap/gi,
  /this\s+is\s+(urgent|critical|important)/gi,
  /you\s+must|you\s+have\s+to|you\s+need\s+to/gi,
];

// Content type validation patterns
const SAFE_CONTENT_PATTERNS = {
  prompt: /^[\w\s.,!?;:()\[\]{}"'-]+$/,
  description: /^[\w\s.,!?;:()\[\]{}"'-]+$/,
  name: /^[\w\s-]+$/,
  tag: /^[\w-]+$/,
};

// Input sanitization schemas
export const PromptInputSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt cannot be empty')
    .max(5000, 'Prompt too long')
    .refine((val) => !containsDangerousPatterns(val), {
      message: 'Prompt contains potentially dangerous content'
    }),
  targetMetrics: z.object({
    successRate: z.number().min(0).max(100).optional(),
    responseTime: z.number().min(0).optional(),
    qualityScore: z.number().min(0).max(100).optional(),
  }).optional(),
  constraints: z.object({
    maxLength: z.number().min(10).max(10000).optional(),
    maintainStyle: z.boolean().optional(),
    securityLevel: z.enum(['basic', 'enhanced', 'strict']).default('enhanced'),
  }).optional()
});

export const ABTestSchema = z.object({
  name: z.string().min(1).max(100),
  variants: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    name: z.string().min(1).max(50),
    prompt: z.string()
      .min(1)
      .max(5000)
      .refine((val) => !containsDangerousPatterns(val), {
        message: 'Variant prompt contains potentially dangerous content'
      }),
    weight: z.number().min(0).max(100),
  })).min(2).max(10),
  metrics: z.object({
    primaryMetric: z.enum(['success_rate', 'response_time', 'quality_score']),
    secondaryMetrics: z.array(z.string()).optional(),
  }),
  duration: z.object({
    startDate: z.date(),
    endDate: z.date(),
    minSamples: z.number().min(10).max(10000),
  }),
});

/**
 * Check if content contains dangerous patterns
 */
function containsDangerousPatterns(content: string): boolean {
  const normalizedContent = content.toLowerCase().trim();
  
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(normalizedContent)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Advanced prompt sanitization
 */
export function sanitizePrompt(prompt: string): {
  sanitized: string;
  issues: string[];
  safe: boolean;
} {
  const issues: string[] = [];
  let sanitized = prompt;
  
  // Basic sanitization
  sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
  sanitized = validator.escape(sanitized);
  
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      issues.push(`Potential security issue detected: ${pattern.source}`);
    }
  }
  
  // Remove potentially dangerous content
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Check length
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000);
    issues.push('Content truncated due to length');
  }
  
  const safe = issues.length === 0 && sanitized.length > 0;
  
  return {
    sanitized,
    issues,
    safe
  };
}

/**
 * Structured prompt construction to prevent injection
 */
export function buildStructuredPrompt(template: string, data: Record<string, any>): string {
  // Use template literals with escaped data
  const escapedData: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      const sanitizeResult = sanitizePrompt(value);
      if (!sanitizeResult.safe) {
        throw new PromptInjectionError(
          `Unsafe content in ${key}: ${sanitizeResult.issues.join(', ')}`,
          { key, value, issues: sanitizeResult.issues }
        );
      }
      escapedData[key] = sanitizeResult.sanitized;
    } else {
      escapedData[key] = String(value);
    }
  }
  
  // Use safer template replacement
  let result = template;
  for (const [key, value] of Object.entries(escapedData)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  
  return result;
}

/**
 * Middleware for prompt injection prevention
 */
export function promptInjectionPrevention() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = performance.now();
    
    try {
      // Check common fields for prompt injection
      const fieldsToCheck = ['prompt', 'originalPrompt', 'optimizedPrompt', 'description', 'content'];
      
      for (const field of fieldsToCheck) {
        if (req.body[field]) {
          const sanitizeResult = sanitizePrompt(req.body[field]);
          
          if (!sanitizeResult.safe) {
            throw new PromptInjectionError(
              `Potentially dangerous content detected in ${field}`,
              {
                field,
                issues: sanitizeResult.issues,
                originalContent: req.body[field].substring(0, 100) + '...'
              }
            );
          }
          
          // Replace with sanitized version
          req.body[field] = sanitizeResult.sanitized;
        }
      }
      
      // Add security metadata to request
      req.security = {
        promptSanitized: true,
        processingTime: performance.now() - startTime,
        timestamp: new Date()
      };
      
      next();
    } catch (error) {
      if (error instanceof SecurityError) {
        // Log security event
        console.error('Security violation detected:', {
          error: error.message,
          code: error.code,
          severity: error.severity,
          metadata: error.metadata,
          request: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            url: req.url,
            method: req.method
          }
        });
        
        return res.status(400).json({
          success: false,
          error: 'Security validation failed',
          code: error.code,
          message: error.message
        });
      }
      
      next(error);
    }
  };
}

/**
 * Enhanced input validation middleware
 */
export function enhancedInputValidation(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.input
        }));
        
        throw new InputValidationError(
          'Input validation failed',
          { errors: validationErrors }
        );
      }
      
      next(error);
    }
  };
}

/**
 * Security audit logging
 */
export function securityAuditLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    const startTime = performance.now();
    
    res.json = function(data: any) {
      const duration = performance.now() - startTime;
      
      // Log security-relevant events
      if (req.url.includes('/optimization') || req.url.includes('/prompt')) {
        console.log('Security audit log:', {
          timestamp: new Date().toISOString(),
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: Math.round(duration),
          contentLength: JSON.stringify(data).length,
          security: req.security || {},
          suspicious: res.statusCode >= 400
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Content Security Policy for API responses
 */
export function apiContentSecurityPolicy() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
    
    next();
  };
}

/**
 * Rate limiting for security-sensitive endpoints
 */
export function securityRateLimit() {
  const requests = new Map<string, { count: number; resetTime: number }>();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_REQUESTS = 10; // 10 security-sensitive requests per window
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip;
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, { count: 1, resetTime: now + WINDOW_MS });
      return next();
    }
    
    const record = requests.get(key)!;
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + WINDOW_MS;
      return next();
    }
    
    if (record.count >= MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        error: 'Security rate limit exceeded',
        resetTime: new Date(record.resetTime).toISOString()
      });
    }
    
    record.count++;
    next();
  };
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      security?: {
        promptSanitized: boolean;
        processingTime: number;
        timestamp: Date;
      };
    }
  }
}

export {
  DANGEROUS_PATTERNS,
  SAFE_CONTENT_PATTERNS,
  containsDangerousPatterns,
  buildStructuredPrompt
};
