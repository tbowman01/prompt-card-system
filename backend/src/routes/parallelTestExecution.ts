import { Router } from 'express';
import { TestQueueManager } from '../services/testing/TestQueueManager';
import { db } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize the test queue manager
const testQueueManager = new TestQueueManager();

// Setup event handlers for real-time updates
testQueueManager.on('progressUpdated', (progress) => {
  // In a real implementation, this would emit to WebSocket clients
  console.log('Progress updated:', progress);
});

testQueueManager.on('jobCompleted', (event) => {
  console.log('Job completed:', event.executionId);
});

testQueueManager.on('jobFailed', (event) => {
  console.error('Job failed:', event.executionId, event.error);
});

/**
 * Queue parallel test execution for a prompt card
 * POST /api/parallel-test-execution/queue
 */
router.post('/queue', async (req, res) => {
  try {
    const {
      prompt_card_id,
      test_case_ids,
      model,
      configuration,
      priority = 0
    } = req.body;

    // Validate required fields
    if (!prompt_card_id || !test_case_ids || !Array.isArray(test_case_ids) || test_case_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'prompt_card_id and test_case_ids (array) are required'
      });
    }

    // Verify prompt card exists
    const promptCard = db.prepare('SELECT id, title FROM prompt_cards WHERE id = ?').get(prompt_card_id);
    if (!promptCard) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    // Verify test cases exist
    const existingTestCases = db.prepare(`
      SELECT id FROM test_cases 
      WHERE id IN (${test_case_ids.map(() => '?').join(',')}) 
      AND prompt_card_id = ?
    `).all(...test_case_ids, prompt_card_id);

    if (existingTestCases.length !== test_case_ids.length) {
      return res.status(400).json({
        success: false,
        error: 'Some test cases not found or do not belong to the specified prompt card'
      });
    }

    // Queue the test execution
    const executionId = await testQueueManager.queueTestExecution(
      prompt_card_id,
      test_case_ids,
      model || 'llama3',
      configuration,
      priority
    );

    return res.status(202).json({
      success: true,
      data: {
        execution_id: executionId,
        status: 'queued',
        prompt_card_id,
        test_case_ids,
        model: model || 'llama3',
        configuration: configuration || testQueueManager['defaultConfiguration'],
        priority
      }
    });

  } catch (error) {
    console.error('Error queuing test execution:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue test execution'
    });
  }
});

/**
 * Get execution progress
 * GET /api/parallel-test-execution/:executionId/progress
 */
router.get('/:executionId/progress', (req, res) => {
  try {
    const { executionId } = req.params;
    
    const progress = testQueueManager.getExecutionProgress(executionId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found or not active'
      });
    }

    return res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('Error getting execution progress:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get execution progress'
    });
  }
});

/**
 * Get all active executions
 * GET /api/parallel-test-execution/active
 */
router.get('/active', (req, res) => {
  try {
    const activeExecutions = testQueueManager.getActiveExecutions();
    
    return res.json({
      success: true,
      data: activeExecutions
    });

  } catch (error) {
    console.error('Error getting active executions:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get active executions'
    });
  }
});

/**
 * Cancel test execution
 * DELETE /api/parallel-test-execution/:executionId
 */
router.delete('/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    
    const cancelled = await testQueueManager.cancelExecution(executionId);
    
    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found or cannot be cancelled'
      });
    }

    return res.json({
      success: true,
      message: 'Test execution cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling test execution:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel test execution'
    });
  }
});

/**
 * Get queue statistics
 * GET /api/parallel-test-execution/queue/stats
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await testQueueManager.getQueueStats();
    
    return res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting queue stats:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get queue statistics'
    });
  }
});

/**
 * Get test execution results
 * GET /api/parallel-test-execution/:executionId/results
 */
router.get('/:executionId/results', (req, res) => {
  try {
    const { executionId } = req.params;
    
    // Get results from database
    const results = db.prepare(`
      SELECT 
        tr.*,
        tc.name as test_case_name,
        pc.title as prompt_card_title
      FROM test_results tr
      JOIN test_cases tc ON tr.test_case_id = tc.id
      JOIN prompt_cards pc ON tc.prompt_card_id = pc.id
      WHERE tr.execution_id LIKE ?
      ORDER BY tr.created_at ASC
    `).all(`${executionId}%`);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No results found for this execution'
      });
    }

    // Parse JSON fields and format results
    const formattedResults = results.map(result => ({
      ...result,
      assertion_results: JSON.parse(result.assertion_results || '[]'),
      passed: Boolean(result.passed)
    }));

    // Calculate summary statistics
    const summary = {
      total_tests: formattedResults.length,
      passed_tests: formattedResults.filter(r => r.passed).length,
      failed_tests: formattedResults.filter(r => !r.passed).length,
      total_execution_time: formattedResults.reduce((sum, r) => sum + r.execution_time_ms, 0),
      average_execution_time: formattedResults.reduce((sum, r) => sum + r.execution_time_ms, 0) / formattedResults.length
    };

    return res.json({
      success: true,
      data: {
        execution_id: executionId,
        summary,
        results: formattedResults
      }
    });

  } catch (error) {
    console.error('Error getting execution results:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get execution results'
    });
  }
});

/**
 * Get system resource status
 * GET /api/parallel-test-execution/system/resources
 */
router.get('/system/resources', (req, res) => {
  try {
    const resourceManager = testQueueManager['resourceManager'];
    const currentUsage = resourceManager.getCurrentUsage();
    const limits = resourceManager.getLimits();
    const reservedSummary = resourceManager.getReservedResourcesSummary();
    const isUnderStress = resourceManager.isSystemUnderStress();
    const optimalConcurrency = resourceManager.getOptimalConcurrency();

    return res.json({
      success: true,
      data: {
        current_usage: currentUsage,
        limits,
        reserved_resources: reservedSummary,
        system_under_stress: isUnderStress,
        optimal_concurrency: optimalConcurrency
      }
    });

  } catch (error) {
    console.error('Error getting system resources:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get system resources'
    });
  }
});

/**
 * Batch execute multiple prompt cards
 * POST /api/parallel-test-execution/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { executions } = req.body;

    if (!Array.isArray(executions) || executions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'executions array is required'
      });
    }

    const results = [];
    const batchId = uuidv4();

    for (const execution of executions) {
      try {
        const executionId = await testQueueManager.queueTestExecution(
          execution.prompt_card_id,
          execution.test_case_ids,
          execution.model || 'llama3',
          execution.configuration,
          execution.priority || 0
        );

        results.push({
          execution_id: executionId,
          prompt_card_id: execution.prompt_card_id,
          status: 'queued',
          error: null
        });

      } catch (error) {
        results.push({
          execution_id: null,
          prompt_card_id: execution.prompt_card_id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return res.status(202).json({
      success: true,
      data: {
        batch_id: batchId,
        total_executions: executions.length,
        successful_queued: results.filter(r => r.status === 'queued').length,
        failed_to_queue: results.filter(r => r.status === 'failed').length,
        results
      }
    });

  } catch (error) {
    console.error('Error batch executing tests:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to batch execute tests'
    });
  }
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Gracefully shutting down test queue manager...');
  await testQueueManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Gracefully shutting down test queue manager...');
  await testQueueManager.shutdown();
  process.exit(0);
});

export { router as parallelTestExecutionRoutes };