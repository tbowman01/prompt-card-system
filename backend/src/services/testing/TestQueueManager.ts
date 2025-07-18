import Bull from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { llmService } from '../llmService';
import { db } from '../../database/connection';
import { Semaphore } from './Semaphore';
import { ResourceManager, ResourceRequirement } from './ResourceManager';

export interface TestJob {
  test_execution_id: string;
  prompt_card_id: number;
  test_case_ids: number[];
  model: string;
  configuration: TestConfiguration;
  priority: number;
  user_id?: string;
  created_at: Date;
}

export interface TestConfiguration {
  max_concurrent_tests: number;
  timeout_per_test: number;
  retry_failed_tests: boolean;
  max_retries: number;
  stop_on_first_failure: boolean;
  resource_limits: {
    memory_mb: number;
    cpu_percent: number;
  };
  cache_enabled: boolean;
  progress_updates: boolean;
}

export interface TestCase {
  id: number;
  name: string;
  prompt_card_id: number;
  input_variables: string; // JSON
  assertions: string; // JSON
  expected_output?: string;
  prompt_template: string;
}

export interface TestExecutionResult {
  execution_id: string;
  test_case_id: number;
  passed: boolean;
  llm_output: string;
  assertion_results: Array<{
    assertion: any;
    passed: boolean;
    error?: string;
  }>;
  execution_time_ms: number;
  model: string;
  prompt_used: string;
  created_at: Date;
  metadata?: Record<string, any>;
}

export interface ExecutionProgress {
  job_id: string;
  percent: number;
  message: string;
  current_test: number;
  total_tests: number;
  completed_tests: number;
  failed_tests: number;
  updated_at: Date;
}

export class TestQueueManager extends EventEmitter {
  private testQueue: Bull.Queue<TestJob>;
  private resourceManager: ResourceManager;
  private defaultConfiguration: TestConfiguration;
  private activeJobs: Map<string, ExecutionProgress> = new Map();

  constructor(redisConfig?: Bull.QueueOptions['redis']) {
    super();
    
    this.defaultConfiguration = {
      max_concurrent_tests: 3,
      timeout_per_test: 30000, // 30 seconds
      retry_failed_tests: true,
      max_retries: 2,
      stop_on_first_failure: false,
      resource_limits: {
        memory_mb: 512,
        cpu_percent: 20
      },
      cache_enabled: true,
      progress_updates: true
    };

    // Initialize Redis queue
    this.testQueue = new Bull('test-execution', {
      redis: redisConfig || {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    // Initialize resource manager
    this.resourceManager = new ResourceManager({
      max_concurrent_tests: parseInt(process.env.MAX_CONCURRENT_TESTS || '10'),
      max_cpu_percent: parseInt(process.env.MAX_CPU_PERCENT || '80'),
      max_memory_mb: parseInt(process.env.MAX_MEMORY_MB || '4096')
    });

    this.setupJobProcessors();
    this.setupEventHandlers();
  }

  /**
   * Queue a test execution job
   */
  async queueTestExecution(
    promptCardId: number,
    testCaseIds: number[],
    model: string,
    configuration?: Partial<TestConfiguration>,
    priority: number = 0
  ): Promise<string> {
    const executionId = uuidv4();
    const config = { ...this.defaultConfiguration, ...configuration };

    // Check resource availability
    const resourceReq: ResourceRequirement = {
      cpu_percent: config.resource_limits.cpu_percent,
      memory_mb: config.resource_limits.memory_mb,
      concurrent_tests: config.max_concurrent_tests,
      priority: priority > 5 ? 'high' : priority < -5 ? 'low' : 'medium'
    };

    const hasResources = await this.resourceManager.checkResourceAvailability(resourceReq);
    if (!hasResources) {
      throw new Error('Insufficient system resources for test execution');
    }

    const job: TestJob = {
      test_execution_id: executionId,
      prompt_card_id: promptCardId,
      test_case_ids: testCaseIds,
      model,
      configuration: config,
      priority,
      created_at: new Date()
    };

    // Add to queue
    const queueJob = await this.testQueue.add('execute-tests', job, {
      priority: priority,
      delay: 0,
      jobId: executionId
    });

    this.emit('jobQueued', { executionId, jobId: queueJob.id });
    return executionId;
  }

  /**
   * Get execution progress
   */
  getExecutionProgress(executionId: string): ExecutionProgress | null {
    return this.activeJobs.get(executionId) || null;
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): ExecutionProgress[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel a test execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const job = await this.testQueue.getJob(executionId);
    if (job) {
      await job.remove();
      this.activeJobs.delete(executionId);
      
      // Release resources
      await this.resourceManager.releaseResources(executionId);
      
      this.emit('jobCancelled', { executionId });
      return true;
    }
    return false;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const waiting = await this.testQueue.getWaiting();
    const active = await this.testQueue.getActive();
    const completed = await this.testQueue.getCompleted();
    const failed = await this.testQueue.getFailed();
    const delayed = await this.testQueue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    };
  }

  /**
   * Setup job processors
   */
  private setupJobProcessors(): void {
    // Main test execution processor
    this.testQueue.process('execute-tests', 3, async (job: Bull.Job<TestJob>) => {
      const { data } = job;
      
      try {
        // Reserve resources
        await this.resourceManager.reserveResources(data.test_execution_id, {
          cpu_percent: data.configuration.resource_limits.cpu_percent,
          memory_mb: data.configuration.resource_limits.memory_mb,
          concurrent_tests: data.configuration.max_concurrent_tests,
          priority: data.priority > 5 ? 'high' : data.priority < -5 ? 'low' : 'medium'
        });

        // Initialize progress tracking
        this.updateProgress(data.test_execution_id, 0, 'Starting test execution...', 0, data.test_case_ids.length);

        // Execute tests
        const results = await this.executeTestsParallel(data, (progress) => {
          this.updateProgress(
            data.test_execution_id,
            progress.percent,
            progress.message,
            progress.current_test,
            progress.total_tests,
            progress.completed_tests,
            progress.failed_tests
          );
        });

        // Update final progress
        this.updateProgress(data.test_execution_id, 100, 'Test execution completed', data.test_case_ids.length, data.test_case_ids.length);

        this.emit('jobCompleted', { executionId: data.test_execution_id, results });
        return results;

      } catch (error) {
        this.updateProgress(data.test_execution_id, -1, `Error: ${error.message}`, 0, data.test_case_ids.length);
        this.emit('jobFailed', { executionId: data.test_execution_id, error: error.message });
        throw error;
      } finally {
        // Release resources
        await this.resourceManager.releaseResources(data.test_execution_id);
        this.activeJobs.delete(data.test_execution_id);
      }
    });
  }

  /**
   * Execute tests in parallel with resource management
   */
  private async executeTestsParallel(
    job: TestJob,
    progressCallback: (progress: {
      percent: number;
      message: string;
      current_test: number;
      total_tests: number;
      completed_tests?: number;
      failed_tests?: number;
    }) => void
  ): Promise<TestExecutionResult[]> {
    const { test_case_ids, model, configuration } = job;
    
    // Load test cases with prompt template
    const testCases = await this.loadTestCases(test_case_ids);
    progressCallback({ percent: 10, message: 'Test cases loaded', current_test: 0, total_tests: testCases.length });

    const results: TestExecutionResult[] = [];
    const semaphore = new Semaphore(configuration.max_concurrent_tests);
    let completedTests = 0;
    let failedTests = 0;

    const executeTest = async (testCase: TestCase, index: number): Promise<void> => {
      const release = await semaphore.acquire();
      
      try {
        const result = await this.executeSingleTest(testCase, model, configuration, job.test_execution_id);
        results[index] = result;
        completedTests++;
        
        if (!result.passed) {
          failedTests++;
          
          // Stop on first failure if configured
          if (configuration.stop_on_first_failure) {
            throw new Error(`Test failed: ${testCase.name}`);
          }
        }

        const progress = ((completedTests) / testCases.length) * 80 + 10;
        progressCallback({
          percent: progress,
          message: `Completed test ${completedTests}/${testCases.length}`,
          current_test: index + 1,
          total_tests: testCases.length,
          completed_tests: completedTests,
          failed_tests: failedTests
        });

      } catch (error) {
        failedTests++;
        const errorResult: TestExecutionResult = {
          execution_id: `${job.test_execution_id}-${testCase.id}`,
          test_case_id: testCase.id,
          passed: false,
          llm_output: `ERROR: ${error.message}`,
          assertion_results: [],
          execution_time_ms: 0,
          model,
          prompt_used: 'Error occurred before prompt execution',
          created_at: new Date(),
          metadata: { error: error.message }
        };
        results[index] = errorResult;
        
        if (configuration.stop_on_first_failure) {
          throw error;
        }
      } finally {
        release();
      }
    };

    // Execute all tests in parallel with concurrency control
    await Promise.all(
      testCases.map((testCase, index) => executeTest(testCase, index))
    );

    progressCallback({ percent: 95, message: 'Storing results...', current_test: testCases.length, total_tests: testCases.length });

    // Store results in database
    await this.storeResults(job.test_execution_id, results);

    return results;
  }

  /**
   * Execute a single test case
   */
  private async executeSingleTest(
    testCase: TestCase,
    model: string,
    configuration: TestConfiguration,
    executionId: string
  ): Promise<TestExecutionResult> {
    const startTime = Date.now();
    const testExecutionId = `${executionId}-${testCase.id}`;

    try {
      // Parse JSON fields
      const inputVariables = JSON.parse(testCase.input_variables);
      const assertions = JSON.parse(testCase.assertions || '[]');

      // Substitute variables in prompt template
      const prompt = llmService.substituteVariables(testCase.prompt_template, inputVariables);

      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Test execution timeout')), configuration.timeout_per_test);
      });

      const executionPromise = llmService.generate(prompt, model);
      const llmResponse = await Promise.race([executionPromise, timeoutPromise]);
      const llmOutput = llmResponse.response;

      // Validate assertions
      const assertionResults = llmService.validateAssertions(llmOutput, assertions);
      const allAssertionsPassed = assertionResults.every(result => result.passed);

      const executionTime = Date.now() - startTime;

      const result: TestExecutionResult = {
        execution_id: testExecutionId,
        test_case_id: testCase.id,
        passed: allAssertionsPassed,
        llm_output: llmOutput,
        assertion_results: assertionResults,
        execution_time_ms: executionTime,
        model: llmResponse.model,
        prompt_used: prompt,
        created_at: new Date(),
        metadata: {
          total_tokens: llmResponse.eval_count || 0,
          prompt_tokens: llmResponse.prompt_eval_count || 0,
          completion_tokens: (llmResponse.eval_count || 0) - (llmResponse.prompt_eval_count || 0)
        }
      };

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        execution_id: testExecutionId,
        test_case_id: testCase.id,
        passed: false,
        llm_output: `ERROR: ${error.message}`,
        assertion_results: [],
        execution_time_ms: executionTime,
        model,
        prompt_used: 'Error occurred before prompt execution',
        created_at: new Date(),
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Load test cases from database
   */
  private async loadTestCases(testCaseIds: number[]): Promise<TestCase[]> {
    const placeholders = testCaseIds.map(() => '?').join(',');
    const query = `
      SELECT 
        tc.*,
        pc.prompt_template,
        pc.title as prompt_card_title
      FROM test_cases tc
      JOIN prompt_cards pc ON tc.prompt_card_id = pc.id
      WHERE tc.id IN (${placeholders})
      ORDER BY tc.id ASC
    `;

    const testCases = db.prepare(query).all(...testCaseIds) as TestCase[];
    
    if (testCases.length !== testCaseIds.length) {
      throw new Error(`Some test cases not found. Expected ${testCaseIds.length}, got ${testCases.length}`);
    }

    return testCases;
  }

  /**
   * Store test results in database
   */
  private async storeResults(executionId: string, results: TestExecutionResult[]): Promise<void> {
    const transaction = db.transaction((results: TestExecutionResult[]) => {
      const insertStmt = db.prepare(`
        INSERT INTO test_results (
          test_case_id, 
          execution_id, 
          llm_output, 
          passed, 
          assertion_results, 
          execution_time_ms,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const result of results) {
        insertStmt.run(
          result.test_case_id,
          result.execution_id,
          result.llm_output,
          result.passed ? 1 : 0,
          JSON.stringify(result.assertion_results),
          result.execution_time_ms,
          result.created_at.toISOString()
        );
      }
    });

    transaction(results);
  }

  /**
   * Update execution progress
   */
  private updateProgress(
    executionId: string,
    percent: number,
    message: string,
    currentTest: number,
    totalTests: number,
    completedTests: number = 0,
    failedTests: number = 0
  ): void {
    const progress: ExecutionProgress = {
      job_id: executionId,
      percent,
      message,
      current_test: currentTest,
      total_tests: totalTests,
      completed_tests: completedTests,
      failed_tests: failedTests,
      updated_at: new Date()
    };

    this.activeJobs.set(executionId, progress);
    this.emit('progressUpdated', progress);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle failed jobs
    this.testQueue.on('failed', (job: Bull.Job<TestJob>, error: Error) => {
      console.error(`Job ${job.id} failed:`, error);
      this.emit('jobFailed', { executionId: job.data.test_execution_id, error: error.message });
    });

    // Handle stalled jobs
    this.testQueue.on('stalled', (job: Bull.Job<TestJob>) => {
      console.warn(`Job ${job.id} stalled`);
      this.emit('jobStalled', { executionId: job.data.test_execution_id });
    });

    // Handle resource manager events
    this.resourceManager.on('systemStress', (usage) => {
      console.warn('System under stress:', usage);
      this.emit('systemStress', usage);
    });

    this.resourceManager.on('emergencyThreshold', (event) => {
      console.error('Emergency threshold reached:', event);
      this.emit('emergencyThreshold', event);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.testQueue.close();
    this.resourceManager.destroy();
    this.removeAllListeners();
  }
}