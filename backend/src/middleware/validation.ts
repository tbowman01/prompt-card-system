import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { body, validationResult, param, query } from 'express-validator';
import sanitizeHtml from 'sanitize-html';
// import { logSecurityEvent } from './structuredLogging';
import validator from 'validator';

// Enhanced validation schema for prompt cards with security rules

// Generic validation middleware function
export function validation(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
      return;
    }
    
    req.body = value;
    next();
  };
}

// Export validateRequest function for compatibility
export function validateRequest(schema: Joi.ObjectSchema) {
  return validation(schema);
}

// Standard validation schemas
export const promptCardValidation = Joi.object({
  title: Joi.string().min(1).max(200).required().trim(),
  prompt_template: Joi.string().min(1).max(5000).required(),
  variables: Joi.array().items(Joi.string()).default([]),
  category_id: Joi.number().integer().positive().optional(),
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  description: Joi.string().max(1000).optional().allow(''),
  is_active: Joi.boolean().default(true)
});

export const testCaseValidation = Joi.object({
  prompt_card_id: Joi.number().integer().positive().required(),
  input_variables: Joi.object().required(),
  expected_output: Joi.string().required(),
  assertion_type: Joi.string().valid('contains', 'equals', 'regex', 'length', 'custom').required(),
  assertion_value: Joi.string().required(),
  description: Joi.string().max(500).optional().allow('')
});

// Security validation helpers
export function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {}
  });
}

export function validateEmail(email: string): boolean {
  return validator.isEmail(email);
}

export function validateUrl(url: string): boolean {
  return validator.isURL(url);
}

// Missing exports that are imported elsewhere
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObjectInputs(req.body);
  }
  next();
}

export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
}

export function limitRequestSize(limit: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0');
    if (contentLength > limit) {
      res.status(413).json({
        error: 'Request entity too large',
        maxSize: limit,
        actualSize: contentLength
      });
      return;
    }
    next();
  };
}

export function validatePromptCard(req: Request, res: Response, next: NextFunction): void {
  const { error, value } = promptCardValidation.validate(req.body);
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
    return;
  }
  req.body = value;
  next();
}

// Helper function to sanitize object inputs recursively
function sanitizeObjectInputs(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectInputs(item));
  } else if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObjectInputs(value);
    }
    return sanitized;
  }
  return obj;
}