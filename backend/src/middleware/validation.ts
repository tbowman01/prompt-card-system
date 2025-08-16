import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ValidationError } from '../errors/ValidationError';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

export const validateOptimizationRequest = [
  body('prompt')
    .isString()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Prompt must be between 10 and 10000 characters')
    .custom((value) => {
      // Additional prompt validation
      const dangerousPatterns = [
        /ignore\s+.*instructions/i,
        /system\s+.*prompt/i,
        /jailbreak/i
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          throw new Error('Prompt contains potentially dangerous content');
        }
      }
      return true;
    }),
  body('parameters')
    .optional()
    .isObject()
    .withMessage('Parameters must be an object'),
  body('parameters.maxLength')
    .optional()
    .isInt({ min: 1, max: 50000 })
    .withMessage('Max length must be between 1 and 50000'),
  handleValidationErrors
];

export const validateABTestRequest = [
  body('name')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be under 100 characters'),
  body('variants')
    .isArray({ min: 2 })
    .withMessage('At least 2 variants are required'),
  body('variants.*.name')
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Variant name is required'),
  body('variants.*.prompt')
    .isString()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Variant prompt must be between 10 and 10000 characters'),
  handleValidationErrors
];
