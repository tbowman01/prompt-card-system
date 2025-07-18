import { Router } from 'express';
import { db } from '../database/connection';
import { llmService } from '../services/llmService';
import { v4 as uuidv4 } from 'uuid';
import { EnhancedAssertionType, EnhancedAssertionResult } from '../services/assertions/AssertionEngine';

const router = Router();

export interface TestExecutionResult {
  execution_id: string;
  test_case_id: number;
  passed: boolean;
  llm_output: string;
  assertion_results: EnhancedAssertionResult[];
  execution_time_ms: number;
  model: string;
  prompt_used: string;
}

export interface BatchExecutionResult {
  execution_id: string;
  prompt_card_id: number;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  results: TestExecutionResult[];
  overall_passed: boolean;
  execution_time_ms: number;
}

/**
 * Execute a single test case
 * POST /api/test-cases/:id/execute
 */
router.post('/:id/execute', async (req, res) => {
  const startTime = Date.now();
  let executionId = '';

  try {
    const { id } = req.params;
    const { model } = req.body; // Optional model override
    
    executionId = uuidv4();

    // Get test case with prompt card
    const testCase = db.prepare(`
      SELECT 
        tc.*,
        pc.prompt_template,
        pc.title as prompt_card_title
      FROM test_cases tc
      JOIN prompt_cards pc ON tc.prompt_card_id = pc.id
      WHERE tc.id = ?
    `).get(id) as any;

    if (!testCase) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found'
      });
    }

    // Parse JSON fields
    const inputVariables = JSON.parse(testCase.input_variables);
    const assertions = JSON.parse(testCase.assertions || '[]');

    // Substitute variables in prompt template
    const prompt = llmService.substituteVariables(testCase.prompt_template, inputVariables);

    // Execute prompt with LLM
    const llmResponse = await llmService.generate(prompt, model);
    const llmOutput = llmResponse.response;

    // Validate assertions
    const assertionResults = await llmService.validateAssertions(llmOutput, assertions, {
      prompt: prompt,
      variables: inputVariables,
      model: model || llmService.defaultModel,
      executionTime: Date.now() - startTime
    });
    const allAssertionsPassed = assertionResults.every(result => result.passed);

    const executionTime = Date.now() - startTime;

    // Store result in database
    const insertResult = db.prepare(`
      INSERT INTO test_results (
        test_case_id, 
        execution_id, 
        llm_output, 
        passed, 
        assertion_results, 
        execution_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      executionId,
      llmOutput,
      allAssertionsPassed ? 1 : 0,
      JSON.stringify(assertionResults),
      executionTime
    );

    const result: TestExecutionResult = {
      execution_id: executionId,
      test_case_id: parseInt(id),
      passed: allAssertionsPassed,
      llm_output: llmOutput,
      assertion_results: assertionResults,
      execution_time_ms: executionTime,
      model: llmResponse.model,
      prompt_used: prompt
    };

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    // Log error but still try to store failed result
    try {
      if (executionId) {
        db.prepare(`
          INSERT INTO test_results (
            test_case_id, 
            execution_id, 
            llm_output, 
            passed, 
            assertion_results, 
            execution_time_ms
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          req.params.id,
          executionId,
          `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          0,
          JSON.stringify([]),
          Date.now() - startTime
        );
      }
    } catch (dbError) {
      console.error('Failed to store error result:', dbError);
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test execution failed',
      execution_id: executionId
    });
  }
});

/**
 * Execute all test cases for a prompt card
 * POST /api/prompt-cards/:id/execute-all
 */
router.post('/prompt-cards/:id/execute-all', async (req, res) => {
  const startTime = Date.now();
  const executionId = uuidv4();

  try {
    const { id } = req.params;
    const { model, stopOnFirstFailure = false } = req.body;

    // Get prompt card
    const promptCard = db.prepare(`
      SELECT * FROM prompt_cards WHERE id = ?
    `).get(id) as any;

    if (!promptCard) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    // Get all test cases for this prompt card
    const testCases = db.prepare(`
      SELECT * FROM test_cases WHERE prompt_card_id = ? ORDER BY created_at ASC
    `).all(id) as any[];

    if (testCases.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No test cases found for this prompt card'
      });
    }

    const results: TestExecutionResult[] = [];
    let shouldStop = false;

    // Execute each test case
    for (const testCase of testCases) {
      if (shouldStop) break;

      const testStartTime = Date.now();
      const testExecutionId = `${executionId}-${testCase.id}`;

      try {
        // Parse JSON fields
        const inputVariables = JSON.parse(testCase.input_variables);
        const assertions = JSON.parse(testCase.assertions || '[]');

        // Substitute variables in prompt template
        const prompt = llmService.substituteVariables(promptCard.prompt_template, inputVariables);

        // Execute prompt with LLM
        const llmResponse = await llmService.generate(prompt, model);
        const llmOutput = llmResponse.response;

        const testExecutionTime = Date.now() - testStartTime;

        // Validate assertions
        const assertionResults = await llmService.validateAssertions(llmOutput, assertions, {
          prompt: prompt,
          variables: inputVariables,
          model: model || llmService.defaultModel,
          executionTime: testExecutionTime
        });
        const allAssertionsPassed = assertionResults.every(result => result.passed);

        // Store individual result
        db.prepare(`
          INSERT INTO test_results (
            test_case_id, 
            execution_id, 
            llm_output, 
            passed, 
            assertion_results, 
            execution_time_ms
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          testCase.id,
          testExecutionId,
          llmOutput,
          allAssertionsPassed ? 1 : 0,
          JSON.stringify(assertionResults),
          testExecutionTime
        );

        const result: TestExecutionResult = {
          execution_id: testExecutionId,
          test_case_id: testCase.id,
          passed: allAssertionsPassed,
          llm_output: llmOutput,
          assertion_results: assertionResults,
          execution_time_ms: testExecutionTime,
          model: llmResponse.model,
          prompt_used: prompt
        };

        results.push(result);

        // Stop on first failure if requested
        if (stopOnFirstFailure && !allAssertionsPassed) {
          shouldStop = true;
        }

      } catch (testError) {
        // Store failed test result
        const testExecutionTime = Date.now() - testStartTime;
        
        try {
          db.prepare(`
            INSERT INTO test_results (
              test_case_id, 
              execution_id, 
              llm_output, 
              passed, 
              assertion_results, 
              execution_time_ms
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            testCase.id,
            testExecutionId,
            `ERROR: ${testError instanceof Error ? testError.message : 'Unknown error'}`,
            0,
            JSON.stringify([]),
            testExecutionTime
          );
        } catch (dbError) {
          console.error('Failed to store failed test result:', dbError);
        }

        const errorResult: TestExecutionResult = {
          execution_id: testExecutionId,
          test_case_id: testCase.id,
          passed: false,
          llm_output: `ERROR: ${testError instanceof Error ? testError.message : 'Unknown error'}`,
          assertion_results: [],
          execution_time_ms: testExecutionTime,
          model: model || 'unknown',
          prompt_used: 'Error occurred before prompt execution'
        };

        results.push(errorResult);

        // Stop on first failure if requested
        if (stopOnFirstFailure) {
          shouldStop = true;
        }
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;
    const overallPassed = failedTests === 0;

    const batchResult: BatchExecutionResult = {
      execution_id: executionId,
      prompt_card_id: parseInt(id),
      total_tests: results.length,
      passed_tests: passedTests,
      failed_tests: failedTests,
      results,
      overall_passed: overallPassed,
      execution_time_ms: totalExecutionTime
    };

    return res.json({
      success: true,
      data: batchResult
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch execution failed',
      execution_id: executionId
    });
  }
});

/**
 * Get test execution history for a test case
 * GET /api/test-cases/:id/executions
 */
router.get('/:id/executions', (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Verify test case exists
    const testCase = db.prepare('SELECT id FROM test_cases WHERE id = ?').get(id) as any;
    if (!testCase) {
      return res.status(404).json({
        success: false,
        error: 'Test case not found'
      });
    }

    // Get total count
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total FROM test_results WHERE test_case_id = ?
    `).get(id) as { total: number };

    // Get paginated results
    const results = db.prepare(`
      SELECT * FROM test_results 
      WHERE test_case_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(id, limit, offset) as any[];

    const totalPages = Math.ceil(totalResult.total / limit);

    return res.json({
      success: true,
      data: results.map(result => ({
        ...result,
        assertion_results: JSON.parse(result.assertion_results || '[]'),
        passed: Boolean(result.passed)
      })),
      pagination: {
        page,
        limit,
        total: totalResult.total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch execution history'
    });
  }
});

/**
 * Get specific test execution result
 * GET /api/test-executions/:executionId
 */
router.get('/executions/:executionId', (req, res) => {
  try {
    const { executionId } = req.params;

    const result = db.prepare(`
      SELECT 
        tr.*,
        tc.name as test_case_name,
        pc.title as prompt_card_title
      FROM test_results tr
      JOIN test_cases tc ON tr.test_case_id = tc.id
      JOIN prompt_cards pc ON tc.prompt_card_id = pc.id
      WHERE tr.execution_id = ?
    `).get(executionId) as any;

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Execution result not found'
      });
    }

    return res.json({
      success: true,
      data: {
        ...result,
        assertion_results: JSON.parse(result.assertion_results || '[]'),
        passed: Boolean(result.passed)
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch execution result'
    });
  }
});

/**
 * Execute tests in parallel with queue management
 * POST /api/test-cases/execute-parallel
 */
router.post('/execute-parallel', async (req, res) => {
  try {
    const { 
      prompt_card_id, 
      test_case_ids, 
      model, 
      configuration = {
        max_concurrent_tests: 3,
        timeout_per_test: 30000,
        retry_failed_tests: false,
        max_retries: 1,
        resource_limits: {
          memory_mb: 1024,
          cpu_percent: 50
        }
      },
      priority = 0
    } = req.body;

    // Validate required fields
    if (!prompt_card_id || !test_case_ids || !Array.isArray(test_case_ids) || test_case_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'prompt_card_id and test_case_ids are required'
      });
    }

    // Verify prompt card exists
    const promptCard = db.prepare('SELECT id FROM prompt_cards WHERE id = ?').get(prompt_card_id);
    if (!promptCard) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    // Verify test cases exist
    const placeholders = test_case_ids.map(() => '?').join(',');
    const testCases = db.prepare(`
      SELECT id FROM test_cases WHERE id IN (${placeholders}) AND prompt_card_id = ?
    `).all(...test_case_ids, prompt_card_id);

    if (testCases.length !== test_case_ids.length) {
      return res.status(400).json({
        success: false,
        error: 'Some test cases not found or do not belong to the specified prompt card'
      });
    }

    // Queue the execution
    const queueManager = req.app.locals.queueManager;
    const executionId = await queueManager.queueTestExecution({
      prompt_card_id,
      test_case_ids,
      model: model || 'llama3.1',
      configuration,
      priority
    });

    return res.json({
      success: true,
      data: {
        execution_id: executionId,
        status: 'queued',
        message: 'Test execution queued successfully'
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue test execution'
    });
  }
});

/**
 * Get progress for a test execution
 * GET /api/test-cases/executions/:executionId/progress
 */
router.get('/executions/:executionId/progress', async (req, res) => {
  try {
    const { executionId } = req.params;
    const progressService = req.app.locals.progressService;
    
    const progress = await progressService.getProgress(executionId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Execution progress not found'
      });
    }

    return res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch execution progress'
    });
  }
});

/**
 * Cancel a test execution
 * POST /api/test-cases/executions/:executionId/cancel
 */
router.post('/executions/:executionId/cancel', async (req, res) => {
  try {
    const { executionId } = req.params;
    const { reason = 'User requested cancellation' } = req.body;
    
    const queueManager = req.app.locals.queueManager;
    await queueManager.cancelTestExecution(executionId, reason);

    return res.json({
      success: true,
      data: {
        execution_id: executionId,
        status: 'cancelled',
        message: 'Test execution cancelled successfully'
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel test execution'
    });
  }
});

/**
 * Get queue statistics
 * GET /api/test-cases/queue/stats
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const queueManager = req.app.locals.queueManager;
    const stats = await queueManager.getQueueStats();

    return res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch queue statistics'
    });
  }
});

/**
 * Get active test executions
 * GET /api/test-cases/executions/active
 */
router.get('/executions/active', async (req, res) => {
  try {
    const progressService = req.app.locals.progressService;
    const activeExecutions = await progressService.getActiveExecutions();

    return res.json({
      success: true,
      data: activeExecutions
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch active executions'
    });
  }
});

export { router as testExecutionRoutes };