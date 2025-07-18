import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Validation schema for prompt cards
const promptCardSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  description: Joi.string().allow('').max(1000),
  prompt_template: Joi.string().required().min(1),
  variables: Joi.array().items(Joi.string()).default([])
});

// Validation schema for test cases
const testCaseSchema = Joi.object({
  prompt_card_id: Joi.number().integer().positive().required(),
  name: Joi.string().required().min(1).max(255),
  input_variables: Joi.object().required(),
  expected_output: Joi.string().allow('').max(10000),
  assertions: Joi.array().items(Joi.object()).default([])
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