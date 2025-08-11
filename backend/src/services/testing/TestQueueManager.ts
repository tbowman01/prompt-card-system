import Bull from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { llmService } from '../llmService';
import { db } from '../../database/connection';
import { Semaphore } from './Semaphore';
import { ResourceManager, ResourceRequirement } from './ResourceManager';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import { LRUCache } from 'lru-cache';
import { promisify } from 'util';
import { setTimeout as setTimeoutPromise } from 'timers/promises';

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
  private testCaseCache: LRUCache<string, TestCase[]>;
  private performanceMetrics: Map<string, number[]>;
  private connectionPool: any[];
  private maxConnections: number;
  private batchProcessor: any;
  private workerPool: Worker[];

  constructor(redisConfig?: Bull.QueueOptions['redis']) {
    super();
    
    this.defaultConfiguration = {
      max_concurrent_tests: Math.min(8, require('os').cpus().length * 2), // Dynamic based on CPU cores
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

    // Initialize caching
    this.testCaseCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 10 // 10 minutes
    });
    
    this.performanceMetrics = new Map();
    this.maxConnections = Math.min(10, require('os').cpus().length * 2);
    this.connectionPool = [];
    this.workerPool = [];

    // Initialize Redis queue with optimized settings
    this.testQueue = new Bull('test-execution', {
      redis: redisConfig as any || {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxLoadingTimeout: 1000
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      },
      settings: {
        stalledInterval: 30000,
        maxStalledCount: 1
      }
    });

    // Initialize resource manager with better defaults
    this.resourceManager = new ResourceManager({
      max_concurrent_tests: parseInt(process.env.MAX_CONCURRENT_TESTS || '20'),
      max_cpu_percent: parseInt(process.env.MAX_CPU_PERCENT || '80'),
      max_memory_mb: parseInt(process.env.MAX_MEMORY_MB || '4096')
    });

    this.setupJobProcessors();
    this.setupEventHandlers();
    this.initializeOptimizations();
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
   * Setup job processors with optimized concurrency
   */
  private setupJobProcessors(): void {
    // Main test execution processor with dynamic concurrency
    const concurrency = Math.min(5, require('os').cpus().length);
    
    this.testQueue.process('execute-tests', concurrency, async (job: Bull.Job<TestJob>) => {
      const { data } = job;
      const startTime = performance.now();
      
      try {
        // Reserve resources with priority handling
        await this.resourceManager.reserveResources(data.test_execution_id, {
          cpu_percent: data.configuration.resource_limits.cpu_percent,
          memory_mb: data.configuration.resource_limits.memory_mb,
          concurrent_tests: data.configuration.max_concurrent_tests,
          priority: data.priority > 5 ? 'high' : data.priority < -5 ? 'low' : 'medium'
        });

        // Initialize progress tracking
        this.updateProgress(data.test_execution_id, 0, 'Starting test execution...', 0, data.test_case_ids.length);

        // Execute tests with optimized parallel processing
        const results = await this.executeTestsParallelOptimized(data, (progress) => {
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

        // Track performance
        const executionTime = performance.now() - startTime;
        this.trackPerformance('executeTests', executionTime);

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
        setTimeout(() => reject(new Error('Test execution timeout')), configuration.timeout_per_test || 30000);
      });

      const executionPromise = llmService.generate(prompt, model);
      const llmResponse = await Promise.race([executionPromise, timeoutPromise]);
      const llmOutput = llmResponse.response;

      // Validate assertions
      const assertionResults = await llmService.validateAssertions(llmOutput, assertions);
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
   * Load test cases from database with caching
   */
  private async loadTestCases(testCaseIds: number[]): Promise<TestCase[]> {
    const cacheKey = testCaseIds.sort().join(',');
    const cached = this.testCaseCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
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

    // Cache the result
    this.testCaseCache.set(cacheKey, testCases);
    
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
   * Optimized parallel test execution
   */
  private async executeTestsParallelOptimized(
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
    
    // Load test cases with caching
    const testCases = await this.loadTestCases(test_case_ids);
    progressCallback({ percent: 10, message: 'Test cases loaded', current_test: 0, total_tests: testCases.length });

    const results: TestExecutionResult[] = new Array(testCases.length);
    const semaphore = new Semaphore(configuration.max_concurrent_tests);
    let completedTests = 0;
    let failedTests = 0;

    // Process tests in batches for better memory management
    const batchSize = Math.min(configuration.max_concurrent_tests * 2, 20);
    const batches = [];
    
    for (let i = 0; i < testCases.length; i += batchSize) {
      batches.push(testCases.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (testCase, batchIndex) => {
        const release = await semaphore.acquire();
        const globalIndex = batches.indexOf(batch) * batchSize + batchIndex;
        
        try {
          const result = await this.executeSingleTestOptimized(testCase, model, configuration, job.test_execution_id);
          results[globalIndex] = result;
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
            current_test: globalIndex + 1,
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
          results[globalIndex] = errorResult;
          
          if (configuration.stop_on_first_failure) {
            throw error;
          }
        } finally {
          release();
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches to prevent overwhelming the system
      if (batches.indexOf(batch) < batches.length - 1) {
        await setTimeoutPromise(100);
      }
    }

    progressCallback({ percent: 95, message: 'Storing results...', current_test: testCases.length, total_tests: testCases.length });

    // Store results in database using batch insertion
    await this.storeResultsOptimized(job.test_execution_id, results);

    return results;
  }
  
  /**
   * Execute a single test case with optimizations
   */
  private async executeSingleTestOptimized(
    testCase: TestCase,
    model: string,
    configuration: TestConfiguration,
    executionId: string
  ): Promise<TestExecutionResult> {
    const startTime = performance.now();
    const testExecutionId = `${executionId}-${testCase.id}`;

    try {
      // Parse JSON fields with error handling
      let inputVariables, assertions;
      try {
        inputVariables = JSON.parse(testCase.input_variables);
        assertions = JSON.parse(testCase.assertions || '[]');
      } catch (parseError) {
        throw new Error(`Invalid JSON in test case ${testCase.id}: ${parseError.message}`);
      }

      // Substitute variables in prompt template
      const prompt = llmService.substituteVariables(testCase.prompt_template, inputVariables);

      // Execute with timeout using Promise.race
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Test execution timeout')), configuration.timeout_per_test || 30000);
      });

      const executionPromise = llmService.generate(prompt, model);
      const llmResponse = await Promise.race([executionPromise, timeoutPromise]);
      const llmOutput = llmResponse.response;

      // Validate assertions
      const assertionResults = await llmService.validateAssertions(llmOutput, assertions);
      const allAssertionsPassed = assertionResults.every(result => result.passed);

      const executionTime = performance.now() - startTime;

      const result: TestExecutionResult = {
        execution_id: testExecutionId,
        test_case_id: testCase.id,
        passed: allAssertionsPassed,
        llm_output: llmOutput,
        assertion_results: assertionResults,
        execution_time_ms: Math.round(executionTime),
        model: llmResponse.model,
        prompt_used: prompt,
        created_at: new Date(),
        metadata: {
          total_tokens: llmResponse.eval_count || 0,
          prompt_tokens: llmResponse.prompt_eval_count || 0,
          completion_tokens: (llmResponse.eval_count || 0) - (llmResponse.prompt_eval_count || 0),
          cache_hit: false // Could be enhanced with actual cache hit detection
        }
      };

      return result;

    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        execution_id: testExecutionId,
        test_case_id: testCase.id,
        passed: false,
        llm_output: `ERROR: ${error.message}`,
        assertion_results: [],
        execution_time_ms: Math.round(executionTime),
        model,
        prompt_used: 'Error occurred before prompt execution',
        created_at: new Date(),
        metadata: { error: error.message }
      };
    }
  }
  
  /**
   * Store test results with optimized batch insertion
   */
  private async storeResultsOptimized(executionId: string, results: TestExecutionResult[]): Promise<void> {
    const transaction = db.transaction((results: TestExecutionResult[]) => {
      const insertStmt = db.prepare(`
        INSERT INTO test_results (
          test_case_id, 
          execution_id, 
          llm_output, 
          passed, 
          assertion_results, 
          execution_time_ms,
          model,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const result of results) {
        insertStmt.run(
          result.test_case_id,
          result.execution_id,
          result.llm_output,
          result.passed ? 1 : 0,
          JSON.stringify(result.assertion_results),
          result.execution_time_ms,
          result.model,
          result.created_at.toISOString()
        );
      }
    });

    transaction(results);
  }
  
  /**
   * Initialize performance optimizations
   */
  private initializeOptimizations(): void {
    // Pre-warm database connections
    this.preWarmConnections();
    
    // Set up periodic cache cleanup
    setInterval(() => {
      this.cleanupCaches();
    }, 1000 * 60 * 5); // Every 5 minutes
    
    console.log('Test queue optimizations initialized');
  }
  
  /**
   * Pre-warm database connections
   */
  private async preWarmConnections(): Promise<void> {
    try {
      // Execute a simple query to warm up the connection
      db.prepare('SELECT 1').get();
      console.log('Database connections pre-warmed');
    } catch (error) {
      console.warn('Failed to pre-warm database connections:', error.message);
    }
  }
  
  /**
   * Clean up caches periodically
   */
  private cleanupCaches(): void {
    // Clean up old performance metrics
    for (const [key, metrics] of this.performanceMetrics) {
      if (metrics.length > 1000) {
        this.performanceMetrics.set(key, metrics.slice(-500));
      }
    }
    
    // Log cache statistics
    console.log(`Cache stats - Test cases: ${this.testCaseCache.size}/${this.testCaseCache.max}`);
  }
  
  /**
   * Track performance metrics
   */
  private trackPerformance(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    // Log slow operations
    if (duration > 60000) { // 1 minute
      console.warn(`Slow test execution: ${operation} took ${duration.toFixed(2)}ms`);
    }
  }
  
  /**
   * Get performance statistics
   */
  public getPerformanceStats(): Record<string, { avg: number; max: number; min: number; count: number }> {
    const stats: Record<string, { avg: number; max: number; min: number; count: number }> = {};
    
    for (const [operation, metrics] of this.performanceMetrics) {
      if (metrics.length > 0) {
        const avg = metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
        const max = Math.max(...metrics);
        const min = Math.min(...metrics);
        
        stats[operation] = {
          avg: Math.round(avg),
          max: Math.round(max),
          min: Math.round(min),
          count: metrics.length
        };
      }
    }
    
    return stats;
  }
  
  /**
   * Clear caches and metrics
   */
  public clearCaches(): void {
    this.testCaseCache.clear();
    this.performanceMetrics.clear();
    console.log('Test queue caches cleared');
  }
  
  /**
   * Initialize the test queue manager
   */
  async initialize(): Promise<void> {
    // Ensure Redis connection and warm up the system
    await this.preWarmConnections();
    console.log('TestQueueManager initialized');
  }

  /**
   * Cleanup the test queue manager
   */
  async cleanup(): Promise<void> {
    await this.shutdown();
    console.log('TestQueueManager cleaned up');
  }

  /**
   * Set queue limit for concurrent executions
   */
  async setQueueLimit(limit: number): Promise<void> {
    this.defaultConfiguration.max_concurrent_tests = limit;
    console.log(`Queue limit set to ${limit}`);
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