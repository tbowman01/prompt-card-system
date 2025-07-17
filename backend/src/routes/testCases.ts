import { Router } from 'express';
import { db } from '../database/connection';
import { validateTestCase } from '../middleware/validation';
import { TestCase, CreateTestCaseRequest } from '../types/testCase';

const router = Router();

// Get test cases for a specific prompt card
router.get('/prompt-card/:promptCardId', (req, res) => {
  try {
    const { promptCardId } = req.params;
    
    const testCases = db.prepare(`
      SELECT * FROM test_cases 
      WHERE prompt_card_id = ? 
      ORDER BY created_at DESC
    `).all(promptCardId) as TestCase[];

    res.json({
      success: true,
      data: testCases.map(tc => ({
        ...tc,
        input_variables: JSON.parse(tc.input_variables),
        assertions: JSON.parse(tc.assertions || '[]')
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch test cases'
    });
  }
});

// Get specific test case
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const testCase = db.prepare(`
      SELECT * FROM test_cases WHERE id = ?
    `).get(id) as TestCase;

    if (!testCase) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...testCase,
        input_variables: JSON.parse(testCase.input_variables),
        assertions: JSON.parse(testCase.assertions || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch test case'
    });
  }
});

// Create new test case
router.post('/', validateTestCase, (req, res) => {
  try {
    const { prompt_card_id, name, input_variables, expected_output, assertions } = req.body as CreateTestCaseRequest;
    
    // Verify prompt card exists
    const promptCard = db.prepare(`
      SELECT id FROM prompt_cards WHERE id = ?
    `).get(prompt_card_id);

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
      expected_output,
      JSON.stringify(assertions || [])
    );

    const newTestCase = db.prepare(`
      SELECT * FROM test_cases WHERE id = ?
    `).get(result.lastInsertRowid) as TestCase;

    res.status(201).json({
      success: true,
      data: {
        ...newTestCase,
        input_variables: JSON.parse(newTestCase.input_variables),
        assertions: JSON.parse(newTestCase.assertions || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create test case'
    });
  }
});

// Update test case
router.put('/:id', validateTestCase, (req, res) => {
  try {
    const { id } = req.params;
    const { prompt_card_id, name, input_variables, expected_output, assertions } = req.body as CreateTestCaseRequest;
    
    const result = db.prepare(`
      UPDATE test_cases 
      SET prompt_card_id = ?, name = ?, input_variables = ?, expected_output = ?, assertions = ?
      WHERE id = ?
    `).run(
      prompt_card_id,
      name,
      JSON.stringify(input_variables),
      expected_output,
      JSON.stringify(assertions || []),
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found'
      });
    }

    const updatedTestCase = db.prepare(`
      SELECT * FROM test_cases WHERE id = ?
    `).get(id) as TestCase;

    res.json({
      success: true,
      data: {
        ...updatedTestCase,
        input_variables: JSON.parse(updatedTestCase.input_variables),
        assertions: JSON.parse(updatedTestCase.assertions || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update test case'
    });
  }
});

// Delete test case
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare(`
      DELETE FROM test_cases WHERE id = ?
    `).run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found'
      });
    }

    res.json({
      success: true,
      message: 'Test case deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete test case'
    });
  }
});

export { router as testCaseRoutes };