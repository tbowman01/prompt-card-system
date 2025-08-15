import { BaseAgent, AgentConfig, Task, AgentMessage } from './core/BaseAgent';
import { MemoryService } from '../memory/MemoryService';
import { TestCase } from '../types/testCase';
import { TestQueueManager } from '../services/testing/TestQueueManager';
import { ResourceManager } from '../services/testing/ResourceManager';
import { AssertionEngine } from '../services/assertions/AssertionEngine';

export interface TestExecutionResult {
  testCaseId: number;
  status: 'passed' | 'failed' | 'error';
  output?: string;
  executionTime: number;
  assertionResults: AssertionResult[];
  error?: string;
  timestamp: Date;
}

export interface AssertionResult {
  type: string;
  expected: any;
  actual: any;
  passed: boolean;
  message?: string;
}

export interface BatchTestRequest {
  testCaseIds: number[];
  maxConcurrency?: number;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export class TestExecutionAgent extends BaseAgent {
  private testQueueManager?: TestQueueManager;
  private resourceManager?: ResourceManager;
  private assertionEngine?: AssertionEngine;
  private activeExecutions: Map<string, AbortController> = new Map();

  constructor(memoryService?: MemoryService) {
    const config: AgentConfig = {
      id: 'test-execution-agent',
      name: 'Test Execution Agent',
      description: 'Specialized agent for executing test cases with parallel processing and resource management',
      capabilities: [
        {
          name: 'execute_single_test',
          description: 'Execute a single test case with assertions',
          inputSchema: {
            type: 'object',
            properties: {
              testCaseId: { type: 'number' },
              promptCardId: { type: 'number' },
              timeout: { type: 'number', default: 30000 }
            },
            required: ['testCaseId', 'promptCardId']
          }
        },
        {
          name: 'execute_batch_tests',
          description: 'Execute multiple test cases in parallel',
          inputSchema: {
            type: 'object',
            properties: {
              testCaseIds: { 
                type: 'array', 
                items: { type: 'number' } 
              },
              maxConcurrency: { type: 'number', default: 5 },
              timeout: { type: 'number', default: 30000 }
            },
            required: ['testCaseIds']
          }
        },
        {
          name: 'validate_assertions',
          description: 'Validate test assertions against actual output',
          inputSchema: {
            type: 'object',
            properties: {
              output: { type: 'string' },
              assertions: { type: 'array' },
              context: { type: 'object' }
            },
            required: ['output', 'assertions']
          }
        },
        {
          name: 'monitor_test_progress',
          description: 'Monitor and report test execution progress',
          inputSchema: {
            type: 'object',
            properties: {
              batchId: { type: 'string' }
            },
            required: ['batchId']
          }
        }
      ],
      maxConcurrentTasks: 10,
      priority: 'high',
      specialization: ['test_execution', 'parallel_processing', 'assertion_validation'],
      memoryEnabled: true
    };

    super(config, memoryService);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing Test Execution Agent');
    
    try {
      // Initialize testing services
      this.testQueueManager = new TestQueueManager();
      this.resourceManager = new ResourceManager();
      this.assertionEngine = new AssertionEngine();
      
      // Setup resource limits
      await this.resourceManager.initializePool({
        maxConcurrency: 10,
        timeoutMs: 30000,
        maxMemoryMb: 512
      });
      
      this.logger.info('Test Execution Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Test Execution Agent:', error);
      throw error;
    }
  }

  protected async executeTask(task: Task): Promise<any> {
    this.logger.info(`Executing task: ${task.type}`);

    switch (task.type) {
      case 'execute_single_test':
        return await this.executeSingleTest(task.input);
      
      case 'execute_batch_tests':
        return await this.executeBatchTests(task.input);
      
      case 'validate_assertions':
        return await this.validateAssertions(task.input);
      
      case 'monitor_test_progress':
        return await this.monitorTestProgress(task.input);
      
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    this.logger.info(`Handling message from ${message.from}: ${message.type}`);

    switch (message.type) {
      case 'task_request':
        await this.handleTaskRequest(message);
        break;
      
      case 'coordination':
        await this.handleCoordinationMessage(message);
        break;
      
      default:
        this.logger.warn(`Unhandled message type: ${message.type}`);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Test Execution Agent');
    
    // Cancel all active executions
    for (const [taskId, controller] of this.activeExecutions) {
      controller.abort();
      this.logger.info(`Cancelled active execution: ${taskId}`);
    }
    this.activeExecutions.clear();

    // Cleanup resource manager
    if (this.resourceManager) {
      await this.resourceManager.cleanup();
    }
  }

  /**
   * Execute a single test case
   */
  private async executeSingleTest(input: any): Promise<TestExecutionResult> {
    const { testCaseId, promptCardId, timeout = 30000 } = input;
    
    this.logger.info(`Executing single test: ${testCaseId}`);

    if (!this.resourceManager) {
      throw new Error('Resource manager not initialized');
    }

    const startTime = Date.now();
    const abortController = new AbortController();
    const taskKey = `single-${testCaseId}`;
    
    this.activeExecutions.set(taskKey, abortController);

    try {
      // Get test case details (would come from database in real implementation)
      const testCase = await this.getTestCase(testCaseId);
      if (!testCase) {
        throw new Error(`Test case ${testCaseId} not found`);
      }

      // Execute the test with resource management
      const result = await this.resourceManager.executeWithTimeout(
        () => this.runSingleTest(testCase, promptCardId),
        timeout,
        abortController.signal
      );

      const executionTime = Date.now() - startTime;
      
      const testResult: TestExecutionResult = {
        testCaseId,
        status: result.success ? 'passed' : 'failed',
        output: result.output,
        executionTime,
        assertionResults: result.assertionResults || [],
        timestamp: new Date()
      };

      if (!result.success && result.error) {
        testResult.error = result.error;
        testResult.status = 'error';
      }

      this.logger.info(`Test ${testCaseId} completed: ${testResult.status} (${executionTime}ms)`);
      return testResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        testCaseId,
        status: 'error',
        executionTime,
        assertionResults: [],
        error: error.message,
        timestamp: new Date()
      };

    } finally {
      this.activeExecutions.delete(taskKey);
    }
  }

  /**
   * Execute multiple test cases in parallel
   */
  private async executeBatchTests(input: BatchTestRequest): Promise<any> {
    const { testCaseIds, maxConcurrency = 5, timeout = 30000 } = input;
    
    this.logger.info(`Executing batch tests: ${testCaseIds.length} tests with concurrency ${maxConcurrency}`);

    if (!this.testQueueManager) {
      throw new Error('Test queue manager not initialized');
    }

    const batchId = `batch-${Date.now()}`;
    const results: TestExecutionResult[] = [];
    const startTime = Date.now();

    try {
      // Create test execution promises
      const testPromises = testCaseIds.map(async (testCaseId, index) => {
        // Stagger test starts to avoid overwhelming resources
        await new Promise(resolve => setTimeout(resolve, index * 100));

        try {
          const result = await this.executeSingleTest({
            testCaseId,
            promptCardId: input.promptCardId || 1, // Default or from context
            timeout
          });
          results.push(result);
          
          // Emit progress update
          this.emit('testProgress', {
            batchId,
            completed: results.length,
            total: testCaseIds.length,
            current: testCaseId
          });

          return result;

        } catch (error) {
          const errorResult: TestExecutionResult = {
            testCaseId,
            status: 'error',
            executionTime: 0,
            assertionResults: [],
            error: error.message,
            timestamp: new Date()
          };
          results.push(errorResult);
          return errorResult;
        }
      });

      // Execute with concurrency limit
      const concurrentResults = await this.executeConcurrently(
        testPromises, 
        maxConcurrency
      );

      const totalExecutionTime = Date.now() - startTime;
      const passedTests = results.filter(r => r.status === 'passed').length;
      const failedTests = results.filter(r => r.status === 'failed').length;
      const errorTests = results.filter(r => r.status === 'error').length;

      const batchResult = {
        batchId,
        totalTests: testCaseIds.length,
        results,
        summary: {
          passed: passedTests,
          failed: failedTests,
          errors: errorTests,
          successRate: passedTests / testCaseIds.length,
          totalExecutionTime,
          averageExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length
        },
        timestamp: new Date()
      };

      this.logger.info(`Batch execution completed: ${passedTests}/${testCaseIds.length} passed (${totalExecutionTime}ms)`);
      return batchResult;

    } catch (error) {
      this.logger.error('Batch execution failed:', error);
      throw error;
    }
  }

  /**
   * Validate assertions against actual output
   */
  private async validateAssertions(input: any): Promise<any> {
    const { output, assertions, context = {} } = input;
    
    this.logger.info(`Validating ${assertions.length} assertions`);

    if (!this.assertionEngine) {
      throw new Error('Assertion engine not initialized');
    }

    try {
      const results = await Promise.all(
        assertions.map(async (assertion: any) => {
          try {
            const result = await this.assertionEngine!.validateAssertion(
              assertion,
              output,
              context
            );
            
            return {
              type: assertion.type,
              expected: assertion.value,
              actual: output,
              passed: result.passed,
              message: result.message,
              confidence: result.confidence
            };

          } catch (error) {
            return {
              type: assertion.type,
              expected: assertion.value,
              actual: output,
              passed: false,
              message: `Assertion validation failed: ${error.message}`,
              confidence: 0
            };
          }
        })
      );

      const passedCount = results.filter(r => r.passed).length;
      const overallPassed = passedCount === assertions.length;

      return {
        overall_result: overallPassed,
        passed_assertions: passedCount,
        total_assertions: assertions.length,
        success_rate: passedCount / assertions.length,
        assertion_results: results,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error('Assertion validation failed:', error);
      throw error;
    }
  }

  /**
   * Monitor test execution progress
   */
  private async monitorTestProgress(input: any): Promise<any> {
    const { batchId } = input;
    
    // In a real implementation, this would query active test executions
    // For now, return mock progress data
    
    return {
      batchId,
      status: 'running',
      progress: {
        completed: 3,
        total: 10,
        currentTest: 'test_case_4',
        estimatedCompletion: new Date(Date.now() + 30000).toISOString()
      },
      resources: {
        cpuUsage: 45.2,
        memoryUsage: 128.5,
        activeThreads: 3
      },
      timestamp: new Date()
    };
  }

  /**
   * Execute a single test case implementation
   */
  private async runSingleTest(testCase: TestCase, promptCardId: number): Promise<any> {
    // Mock test execution - in real implementation, this would:
    // 1. Get the prompt card template
    // 2. Substitute variables with test case input
    // 3. Send to LLM service
    // 4. Get response
    // 5. Validate against assertions
    
    const mockOutput = `Mock LLM response for test case ${testCase.id}`;
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Validate assertions if available
    let assertionResults: AssertionResult[] = [];
    if (testCase.assertions) {
      const assertions = JSON.parse(testCase.assertions);
      assertionResults = await Promise.all(
        assertions.map(async (assertion: any) => ({
          type: assertion.type,
          expected: assertion.value,
          actual: mockOutput,
          passed: Math.random() > 0.2, // 80% pass rate for testing
          message: assertion.description || `${assertion.type} assertion`
        }))
      );
    }

    const allPassed = assertionResults.length === 0 || assertionResults.every(r => r.passed);
    
    return {
      success: allPassed,
      output: mockOutput,
      assertionResults,
      error: allPassed ? null : 'One or more assertions failed'
    };
  }

  /**
   * Execute promises with concurrency limit
   */
  private async executeConcurrently<T>(
    promises: Promise<T>[], 
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const promise of promises) {
      const wrappedPromise = promise.then((result) => {
        results.push(result);
      });

      executing.push(wrappedPromise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === wrappedPromise),
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Get test case details (mock implementation)
   */
  private async getTestCase(testCaseId: number): Promise<TestCase | null> {
    // Mock test case - in real implementation, this would query the database
    return {
      id: testCaseId,
      prompt_card_id: 1,
      name: `Test Case ${testCaseId}`,
      input_variables: JSON.stringify({ input: 'test input' }),
      expected_output: 'expected output',
      assertions: JSON.stringify([
        { type: 'contains', value: 'expected', description: 'Should contain expected text' }
      ]),
      created_at: new Date().toISOString()
    };
  }

  /**
   * Handle task requests from other agents
   */
  private async handleTaskRequest(message: AgentMessage): Promise<void> {
    try {
      const taskId = await this.submitTask({
        type: message.payload.type,
        description: message.payload.description,
        input: message.payload.input,
        context: message.payload.context,
        priority: message.payload.priority || 'medium',
        correlationId: message.correlationId,
        requesterAgent: message.from
      });

      this.sendMessage({
        to: message.from,
        type: 'task_response',
        payload: {
          status: 'accepted',
          taskId,
          estimated_completion: new Date(Date.now() + 60000).toISOString()
        },
        correlationId: message.correlationId,
        priority: message.priority
      });

    } catch (error) {
      this.sendMessage({
        to: message.from,
        type: 'error',
        payload: {
          error: error.message,
          original_request: message.payload
        },
        correlationId: message.correlationId,
        priority: message.priority
      });
    }
  }

  /**
   * Handle coordination messages
   */
  private async handleCoordinationMessage(message: AgentMessage): Promise<void> {
    switch (message.payload.action) {
      case 'status_request':
        this.sendMessage({
          to: message.from,
          type: 'status',
          payload: {
            ...this.getStats(),
            active_executions: this.activeExecutions.size,
            resource_usage: await this.getResourceUsage()
          },
          correlationId: message.correlationId,
          priority: message.priority
        });
        break;

      case 'abort_tests':
        const { batchId } = message.payload;
        await this.abortTestExecution(batchId);
        
        this.sendMessage({
          to: message.from,
          type: 'coordination',
          payload: {
            action: 'tests_aborted',
            batchId
          },
          correlationId: message.correlationId,
          priority: message.priority
        });
        break;

      default:
        this.logger.warn('Unknown coordination action:', message.payload.action);
    }
  }

  /**
   * Abort test execution for a specific batch
   */
  private async abortTestExecution(batchId: string): Promise<void> {
    for (const [taskKey, controller] of this.activeExecutions) {
      if (taskKey.includes(batchId)) {
        controller.abort();
        this.activeExecutions.delete(taskKey);
        this.logger.info(`Aborted test execution: ${taskKey}`);
      }
    }
  }

  /**
   * Get current resource usage
   */
  private async getResourceUsage(): Promise<any> {
    return {
      cpu_usage_percent: Math.random() * 100,
      memory_usage_mb: Math.random() * 512,
      active_threads: this.activeExecutions.size,
      queue_length: 0 // Would come from test queue manager
    };
  }
}