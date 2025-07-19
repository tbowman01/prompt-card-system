import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { body, validationResult, param, query } from 'express-validator';
import sanitizeHtml from 'sanitize-html';

// Enhanced validation schema for prompt cards with security rules

// Generic validation middleware function
export function validation(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
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

// Validation schema for prompt cards
const promptCardSchema = Joi.object({
  title: Joi.string()
    .required()
    .min(1)
    .max(255)
    .pattern(/^[a-zA-Z0-9\s\-_.,!?()]+$/) // Allow only safe characters
    .messages({
      'string.pattern.base': 'Title contains invalid characters'
    }),
  description: Joi.string()
    .allow('')
    .max(1000)
    .pattern(/^[a-zA-Z0-9\s\-_.,!?()\n\r]*$/) // Allow safe characters and newlines
    .messages({
      'string.pattern.base': 'Description contains invalid characters'
    }),
  prompt_template: Joi.string()
    .required()
    .min(1)
    .max(10000) // Reasonable limit for prompt templates
    .custom((value, helpers) => {
      // Check for potential injection patterns
      const dangerousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /eval\s*\(/gi,
        /Function\s*\(/gi
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          return helpers.error('any.invalid', { message: 'Prompt template contains potentially dangerous content' });
        }
      }
      
      return value;
    }),
  variables: Joi.array()
    .items(Joi.string().max(100).pattern(/^[a-zA-Z0-9_]+$/)) // Variable names should be alphanumeric
    .default([])
    .max(50) // Limit number of variables
});

// Enhanced validation schema for test cases with security rules
const testCaseSchema = Joi.object({
  prompt_card_id: Joi.number().integer().positive().required().max(1000000), // Reasonable upper limit
  name: Joi.string()
    .required()
    .min(1)
    .max(255)
    .pattern(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
    .messages({
      'string.pattern.base': 'Test case name contains invalid characters'
    }),
  input_variables: Joi.object()
    .required()
    .pattern(/^[a-zA-Z0-9_]+$/, Joi.string().max(1000)) // Key validation and value size limit
    .max(20), // Limit number of input variables
  expected_output: Joi.string()
    .allow('')
    .max(50000) // Reasonable limit for expected output
    .custom((value, helpers) => {
      if (value && value.length > 0) {
        // Sanitize HTML content
        const sanitized = sanitizeHtml(value, {
          allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
          allowedAttributes: {}
        });
        return sanitized;
      }
      return value;
    }),
  assertions: Joi.array()
    .items(Joi.object({
      type: Joi.string().valid('equals', 'contains', 'regex', 'length', 'semantic_similarity').required(),
      value: Joi.alternatives().try(Joi.string().max(1000), Joi.number()),
      threshold: Joi.number().min(0).max(1)
    }))
    .default([])
    .max(10) // Limit number of assertions
});

// Middleware to validate prompt card requests
export function validatePromptCard(req: Request, res: Response, next: NextFunction): void {
  const { error, value } = promptCardSchema.validate(req.body);
  
  if (error) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
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

// Sanitization utilities
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return input;
  
  // Sanitize HTML content
  const sanitized = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {}
  });
  
  return sanitized.trim();
};

// General input sanitization middleware
export const sanitizeRequestBody = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeInput(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  next();
};

// Request size limiting middleware
export const limitRequestSize = (maxSize: number = 1024 * 1024) => { // Default 1MB
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    
    if (contentLength > maxSize) {
      res.status(413).json({
        success: false,
        error: 'Request entity too large',
        maxSize: maxSize,
        receivedSize: contentLength
      });
      return;
    }
    
    next();
  };
};

// Express-validator based validation chains
export const validatePromptCardExpressValidator = [
  body('title')
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
    .withMessage('Title contains invalid characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .matches(/^[a-zA-Z0-9\s\-_.,!?()\n\r]*$/)
    .withMessage('Description contains invalid characters'),
  body('prompt_template')
    .isLength({ min: 1, max: 10000 })
    .custom((value) => {
      const dangerousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /eval\s*\(/gi,
        /Function\s*\(/gi
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          throw new Error('Prompt template contains potentially dangerous content');
        }
      }
      
      return true;
    }),
  body('variables')
    .optional()
    .isArray({ max: 50 })
    .custom((variables) => {
      if (!Array.isArray(variables)) return true;
      
      for (const variable of variables) {
        if (typeof variable !== 'string' || !/^[a-zA-Z0-9_]+$/.test(variable) || variable.length > 100) {
          throw new Error('Invalid variable name format');
        }
      }
      
      return true;
    })
];

export const validateTestCaseExpressValidator = [
  body('prompt_card_id')
    .isInt({ min: 1, max: 1000000 })
    .withMessage('Invalid prompt card ID'),
  body('name')
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
    .withMessage('Test case name contains invalid characters'),
  body('input_variables')
    .isObject()
    .custom((variables) => {
      if (Object.keys(variables).length > 20) {
        throw new Error('Too many input variables');
      }
      
      for (const [key, value] of Object.entries(variables)) {
        if (!/^[a-zA-Z0-9_]+$/.test(key)) {
          throw new Error(`Invalid variable name: ${key}`);
        }
        
        if (typeof value === 'string' && value.length > 1000) {
          throw new Error(`Variable value too long: ${key}`);
        }
      }
      
      return true;
    }),
  body('expected_output')
    .optional()
    .isLength({ max: 50000 })
    .customSanitizer((value) => {
      if (typeof value === 'string' && value.length > 0) {
        return sanitizeHtml(value, {
          allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
          allowedAttributes: {}
        });
      }
      return value;
    }),
  body('assertions')
    .optional()
    .isArray({ max: 10 })
    .custom((assertions) => {
      if (!Array.isArray(assertions)) return true;
      
      const validTypes = ['equals', 'contains', 'regex', 'length', 'semantic_similarity'];
      
      for (const assertion of assertions) {
        if (!assertion.type || !validTypes.includes(assertion.type)) {
          throw new Error('Invalid assertion type');
        }
        
        if (assertion.value !== undefined) {
          if (typeof assertion.value === 'string' && assertion.value.length > 1000) {
            throw new Error('Assertion value too long');
          }
        }
        
        if (assertion.threshold !== undefined) {
          if (typeof assertion.threshold !== 'number' || assertion.threshold < 0 || assertion.threshold > 1) {
            throw new Error('Invalid threshold value');
          }
        }
      }
      
      return true;
    })
];

// Middleware to handle express-validator errors
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    });
    return;
  }
  
  next();
};

// Middleware to validate test case requests
export function validateTestCase(req: Request, res: Response, next: NextFunction): void {
  const { error, value } = testCaseSchema.validate(req.body);
  
  if (error) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
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