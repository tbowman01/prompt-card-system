import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { TestCase, CreateTestCaseRequest } from '../types/testCase';
import Joi from 'joi';

const router = Router();

// Validation schema for test case
const testCaseSchema = Joi.object({
  prompt_card_id: Joi.number().integer().positive().required(),
  name: Joi.string().min(1).max(255).required(),
  input_variables: Joi.object().required(),
  expected_output: Joi.string().allow('').optional(),
  assertions: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('contains', 'not-contains', 'equals', 'not-equals', 'regex', 'length').required(),
      value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      description: Joi.string().optional()
    })
  ).optional()
});

// Get all test cases for a prompt card
router.get('/prompt-cards/:promptCardId/test-cases', (req: Request, res: Response) => {
  try {
    const { promptCardId } = req.params;
    
    // Verify prompt card exists
    const promptCard = db.prepare('SELECT id FROM prompt_cards WHERE id = ?').get(promptCardId);
    if (!promptCard) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    const testCases = db.prepare(`
      SELECT * FROM test_cases 
      WHERE prompt_card_id = ? 
      ORDER BY created_at DESC
    `).all(promptCardId) as TestCase[];

    return res.json({
      success: true,
      data: testCases.map((tc: TestCase) => ({
        ...tc,
        input_variables: JSON.parse(tc.input_variables),
        assertions: JSON.parse(tc.assertions || '[]')
      }))
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch test cases'
    });
  }
});

// Get specific test case
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const testCase = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id) as TestCase;
    
    if (!testCase) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found'
      });
    }

    return res.json({
      success: true,
      data: {
        ...testCase,
        input_variables: JSON.parse(testCase.input_variables),
        assertions: JSON.parse(testCase.assertions || '[]')
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch test case'
    });
  }
});

// Create new test case
router.post('/', (req: Request, res: Response) => {
  try {
    const { error, value } = testCaseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { prompt_card_id, name, input_variables, expected_output, assertions } = value as CreateTestCaseRequest;
    
    // Verify prompt card exists
    const promptCard = db.prepare('SELECT id FROM prompt_cards WHERE id = ?').get(prompt_card_id);
    if (!promptCard) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    const result = db.prepare(`
      INSERT INTO test_cases (prompt_card_id, name, input_variables, expected_output, assertions)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      prompt_card_id,
      name,
      JSON.stringify(input_variables),
      expected_output || null,
      JSON.stringify(assertions || [])
    );

    const newTestCase = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(result.lastInsertRowid) as TestCase;

    return res.status(201).json({
      success: true,
      data: {
        ...newTestCase,
        input_variables: JSON.parse(newTestCase.input_variables),
        assertions: JSON.parse(newTestCase.assertions || '[]')
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create test case'
    });
  }
});

// Update test case
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = testCaseSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { prompt_card_id, name, input_variables, expected_output, assertions } = value as CreateTestCaseRequest;
    
    const result = db.prepare(`
      UPDATE test_cases 
      SET prompt_card_id = ?, name = ?, input_variables = ?, expected_output = ?, assertions = ?
      WHERE id = ?
    `).run(
      prompt_card_id,
      name,
      JSON.stringify(input_variables),
      expected_output || null,
      JSON.stringify(assertions || []),
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found'
      });
    }

    const updatedTestCase = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id) as TestCase;

    return res.json({
      success: true,
      data: {
        ...updatedTestCase,
        input_variables: JSON.parse(updatedTestCase.input_variables),
        assertions: JSON.parse(updatedTestCase.assertions || '[]')
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update test case'
    });
  }
});

// Delete test case
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare('DELETE FROM test_cases WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found'
      });
    }

    return res.json({
      success: true,
      message: 'Test case deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete test case'
    });
  }
});

export { router as testCaseRoutes };