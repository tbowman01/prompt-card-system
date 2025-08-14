import { EventEmitter } from 'events';
import { loadTestingFramework } from './LoadTestingFramework';
import { performanceRegressionDetector } from './PerformanceRegressionDetector';
import { performanceBenchmark } from './PerformanceBenchmark';
import { db } from '../../database/connection';
import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledTest {
  id: string;
  name: string;
  scenarioId: string;
  schedule: string; // Cron expression
  enabled: boolean;
  options: {
    saveBaseline?: boolean;
    compareBaseline?: boolean;
    notifyOnRegression?: boolean;
    runBenchmarks?: boolean;
  };
  lastRun?: Date;
  nextRun?: Date;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestExecutionResult {
  scheduledTestId: string;
  executionId: string;
  startTime: Date;
  endTime: Date;
  success: boolean;
  error?: string;
  results?: any;
  regressionAlerts?: any[];
  benchmarkResults?: any;
}

export interface SchedulerConfiguration {
  enabled: boolean;
  maxConcurrentTests: number;
  defaultTimeout: number; // milliseconds
  retryFailedTests: boolean;
  maxRetries: number;
  retryDelay: number; // milliseconds
  cleanupOldResults: boolean;
  resultsRetentionDays: number;
  notifications: {
    enabled: boolean;
    channels: string[]; // email, slack, webhook
    onSuccess: boolean;
    onFailure: boolean;
    onRegression: boolean;
  };
}

export class LoadTestScheduler extends EventEmitter {
  private scheduledTests: Map<string, ScheduledTest> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();
  private activeExecutions: Map<string, TestExecutionResult> = new Map();
  private configuration: SchedulerConfiguration;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.configuration = this.getDefaultConfiguration();
  }

  /**
   * Initialize the scheduler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.createTables();
      await this.loadScheduledTests();
      await this.loadConfiguration();
      
      if (this.configuration.enabled) {
        this.startAllScheduledTests();
      }

      // Start cleanup job (daily at 2 AM)
      if (this.configuration.cleanupOldResults) {
        this.scheduleCleanupJob();
      }

      this.isInitialized = true;
      this.emit('initialized');
      console.log('Load test scheduler initialized');
    } catch (error) {
      console.error('Failed to initialize load test scheduler:', error);
      throw error;
    }
  }

  /**
   * Create a new scheduled test
   */
  async createScheduledTest(test: Omit<ScheduledTest, 'id' | 'createdAt' | 'updatedAt' | 'consecutiveFailures'>): Promise<string> {
    const scheduledTest: ScheduledTest = {
      ...test,
      id: uuidv4(),
      consecutiveFailures: 0,
      maxConsecutiveFailures: test.maxConsecutiveFailures || 3,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate cron expression
    try {
      new CronJob(test.schedule, () => {}, null, false);
    } catch (error) {
      throw new Error(`Invalid cron expression: ${test.schedule}`);
    }

    // Save to database
    await this.saveScheduledTest(scheduledTest);
    
    // Add to memory
    this.scheduledTests.set(scheduledTest.id, scheduledTest);

    // Start cron job if enabled
    if (scheduledTest.enabled && this.configuration.enabled) {
      this.startCronJob(scheduledTest);
    }

    this.emit('scheduledTestCreated', scheduledTest);
    return scheduledTest.id;
  }

  /**
   * Update a scheduled test
   */
  async updateScheduledTest(id: string, updates: Partial<ScheduledTest>): Promise<void> {
    const scheduledTest = this.scheduledTests.get(id);
    if (!scheduledTest) {
      throw new Error(`Scheduled test not found: ${id}`);
    }

    const updatedTest = {
      ...scheduledTest,
      ...updates,
      updatedAt: new Date()
    };

    // Validate cron expression if changed
    if (updates.schedule && updates.schedule !== scheduledTest.schedule) {
      try {
        new CronJob(updates.schedule, () => {}, null, false);
      } catch (error) {
        throw new Error(`Invalid cron expression: ${updates.schedule}`);
      }
    }

    // Update database
    await this.saveScheduledTest(updatedTest);
    
    // Update memory
    this.scheduledTests.set(id, updatedTest);

    // Restart cron job if schedule or enabled status changed
    if (updates.schedule || updates.enabled !== undefined) {
      this.stopCronJob(id);
      if (updatedTest.enabled && this.configuration.enabled) {
        this.startCronJob(updatedTest);
      }
    }

    this.emit('scheduledTestUpdated', updatedTest);
  }

  /**
   * Delete a scheduled test
   */
  async deleteScheduledTest(id: string): Promise<void> {
    const scheduledTest = this.scheduledTests.get(id);
    if (!scheduledTest) {
      throw new Error(`Scheduled test not found: ${id}`);
    }

    // Stop cron job
    this.stopCronJob(id);

    // Remove from database
    const stmt = db.prepare('DELETE FROM scheduled_tests WHERE id = ?');
    stmt.run(id);

    // Remove from memory
    this.scheduledTests.delete(id);

    this.emit('scheduledTestDeleted', id);
  }

  /**
   * Get all scheduled tests
   */
  getScheduledTests(): ScheduledTest[] {
    return Array.from(this.scheduledTests.values());
  }

  /**
   * Get a specific scheduled test
   */
  getScheduledTest(id: string): ScheduledTest | undefined {
    return this.scheduledTests.get(id);
  }

  /**
   * Get test execution history
   */
  async getExecutionHistory(scheduledTestId?: string, limit: number = 50, offset: number = 0): Promise<TestExecutionResult[]> {
    const query = `
      SELECT * FROM test_executions 
      ${scheduledTestId ? 'WHERE scheduled_test_id = ?' : ''}
      ORDER BY start_time DESC 
      LIMIT ? OFFSET ?
    `;
    
    const params = scheduledTestId ? [scheduledTestId, limit, offset] : [limit, offset];
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      scheduledTestId: row.scheduled_test_id,
      executionId: row.execution_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      success: Boolean(row.success),
      error: row.error,
      results: row.results ? JSON.parse(row.results) : undefined,
      regressionAlerts: row.regression_alerts ? JSON.parse(row.regression_alerts) : undefined,
      benchmarkResults: row.benchmark_results ? JSON.parse(row.benchmark_results) : undefined
    }));
  }

  /**
   * Manually execute a scheduled test
   */
  async executeTest(scheduledTestId: string): Promise<TestExecutionResult> {
    const scheduledTest = this.scheduledTests.get(scheduledTestId);
    if (!scheduledTest) {
      throw new Error(`Scheduled test not found: ${scheduledTestId}`);
    }

    if (this.activeExecutions.has(scheduledTestId)) {
      throw new Error('Test is already running');
    }

    const executionId = uuidv4();
    const execution: TestExecutionResult = {
      scheduledTestId,
      executionId,
      startTime: new Date(),
      endTime: new Date(),
      success: false
    };

    this.activeExecutions.set(scheduledTestId, execution);
    this.emit('testExecutionStarted', execution);

    try {
      // Execute load test
      const loadTestResults = await loadTestingFramework.runLoadTest(
        scheduledTest.scenarioId,
        {
          saveBaseline: scheduledTest.options.saveBaseline,
          compareBaseline: scheduledTest.options.compareBaseline
        }
      );

      execution.results = loadTestResults;

      // Check for regressions if enabled
      if (scheduledTest.options.compareBaseline) {
        const regressionAlerts = await performanceRegressionDetector.analyzeResults(
          scheduledTest.scenarioId,
          loadTestResults
        );
        execution.regressionAlerts = regressionAlerts;
      }

      // Run benchmarks if enabled
      if (scheduledTest.options.runBenchmarks) {
        const benchmarkResults = await performanceBenchmark.runBenchmarkSuite(
          `Scheduled Benchmark - ${scheduledTest.name}`
        );
        execution.benchmarkResults = benchmarkResults;
      }

      execution.success = true;
      execution.endTime = new Date();

      // Reset consecutive failures on success
      if (scheduledTest.consecutiveFailures > 0) {
        await this.updateScheduledTest(scheduledTestId, { 
          consecutiveFailures: 0,
          lastRun: new Date()
        });
      } else {
        await this.updateScheduledTest(scheduledTestId, { 
          lastRun: new Date()
        });
      }

      // Send notifications if configured
      if (this.configuration.notifications.enabled && this.configuration.notifications.onSuccess) {
        await this.sendNotification('success', scheduledTest, execution);
      }

      if (execution.regressionAlerts && execution.regressionAlerts.length > 0 && 
          this.configuration.notifications.onRegression) {
        await this.sendNotification('regression', scheduledTest, execution);
      }

    } catch (error) {
      execution.success = false;
      execution.error = error.message;
      execution.endTime = new Date();

      // Increment consecutive failures
      const newFailureCount = scheduledTest.consecutiveFailures + 1;
      await this.updateScheduledTest(scheduledTestId, { 
        consecutiveFailures: newFailureCount,
        lastRun: new Date()
      });

      // Disable test if max consecutive failures reached
      if (newFailureCount >= scheduledTest.maxConsecutiveFailures) {
        await this.updateScheduledTest(scheduledTestId, { enabled: false });
        console.log(`Disabled scheduled test ${scheduledTest.name} due to consecutive failures`);
      }

      // Send failure notification
      if (this.configuration.notifications.enabled && this.configuration.notifications.onFailure) {
        await this.sendNotification('failure', scheduledTest, execution);
      }

      console.error(`Scheduled test execution failed: ${scheduledTest.name}`, error);
    } finally {
      this.activeExecutions.delete(scheduledTestId);
      await this.saveExecution(execution);
      this.emit('testExecutionCompleted', execution);
    }

    return execution;
  }

  /**
   * Update scheduler configuration
   */
  async updateConfiguration(config: Partial<SchedulerConfiguration>): Promise<void> {
    this.configuration = { ...this.configuration, ...config };
    await this.saveConfiguration();

    // Restart scheduler if enabled status changed
    if (config.enabled !== undefined) {
      if (config.enabled) {
        this.startAllScheduledTests();
      } else {
        this.stopAllScheduledTests();
      }
    }

    this.emit('configurationUpdated', this.configuration);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): SchedulerConfiguration {
    return { ...this.configuration };
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    enabled: boolean;
    scheduledTestsCount: number;
    activeExecutionsCount: number;
    activeExecutions: Array<{
      scheduledTestId: string;
      executionId: string;
      startTime: Date;
      testName: string;
    }>;
    nextExecutions: Array<{
      scheduledTestId: string;
      testName: string;
      nextRun: Date;
    }>;
  } {
    const activeExecutions = Array.from(this.activeExecutions.values()).map(execution => ({
      scheduledTestId: execution.scheduledTestId,
      executionId: execution.executionId,
      startTime: execution.startTime,
      testName: this.scheduledTests.get(execution.scheduledTestId)?.name || 'Unknown'
    }));

    const nextExecutions = Array.from(this.scheduledTests.values())
      .filter(test => test.enabled && test.nextRun)
      .sort((a, b) => a.nextRun!.getTime() - b.nextRun!.getTime())
      .slice(0, 10)
      .map(test => ({
        scheduledTestId: test.id,
        testName: test.name,
        nextRun: test.nextRun!
      }));

    return {
      enabled: this.configuration.enabled,
      scheduledTestsCount: this.scheduledTests.size,
      activeExecutionsCount: this.activeExecutions.size,
      activeExecutions,
      nextExecutions
    };
  }

  /**
   * Clean up old test results
   */
  async cleanupOldResults(): Promise<{ deletedExecutions: number; deletedAlerts: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.configuration.resultsRetentionDays);
    
    // Delete old executions
    const deleteExecutionsStmt = db.prepare(
      'DELETE FROM test_executions WHERE start_time < ?'
    );
    const executionResult = deleteExecutionsStmt.run(cutoffDate.toISOString());
    
    // Delete old regression alerts
    const deleteAlertsStmt = db.prepare(
      'DELETE FROM regression_alerts WHERE timestamp < ? AND acknowledged = 1'
    );
    const alertResult = deleteAlertsStmt.run(cutoffDate.toISOString());
    
    const result = {
      deletedExecutions: executionResult.changes,
      deletedAlerts: alertResult.changes
    };
    
    this.emit('cleanupCompleted', result);
    console.log('Cleanup completed:', result);
    
    return result;
  }

  /**
   * Shutdown the scheduler
   */
  async shutdown(): Promise<void> {
    this.stopAllScheduledTests();
    this.removeAllListeners();
    console.log('Load test scheduler shutdown completed');
  }

  /**
   * Private methods
   */
  private async createTables(): Promise<void> {
    // Create scheduled tests table
    db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        schedule TEXT NOT NULL,
        enabled BOOLEAN NOT NULL,
        options_json TEXT NOT NULL,
        last_run TEXT,
        consecutive_failures INTEGER DEFAULT 0,
        max_consecutive_failures INTEGER DEFAULT 3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create test executions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scheduled_test_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        error TEXT,
        results TEXT,
        regression_alerts TEXT,
        benchmark_results TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (scheduled_test_id) REFERENCES scheduled_tests (id)
      )
    `);

    // Create scheduler configuration table
    db.exec(`
      CREATE TABLE IF NOT EXISTS scheduler_configuration (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        config_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_test_executions_scheduled_test_id 
      ON test_executions(scheduled_test_id);
      
      CREATE INDEX IF NOT EXISTS idx_test_executions_start_time 
      ON test_executions(start_time);
    `);
  }

  private async loadScheduledTests(): Promise<void> {
    const stmt = db.prepare('SELECT * FROM scheduled_tests');
    const rows = stmt.all() as any[];
    
    for (const row of rows) {
      const scheduledTest: ScheduledTest = {
        id: row.id,
        name: row.name,
        scenarioId: row.scenario_id,
        schedule: row.schedule,
        enabled: Boolean(row.enabled),
        options: JSON.parse(row.options_json),
        lastRun: row.last_run ? new Date(row.last_run) : undefined,
        consecutiveFailures: row.consecutive_failures,
        maxConsecutiveFailures: row.max_consecutive_failures,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
      
      this.scheduledTests.set(scheduledTest.id, scheduledTest);
    }
    
    console.log(`Loaded ${rows.length} scheduled tests`);
  }

  private async saveScheduledTest(test: ScheduledTest): Promise<void> {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO scheduled_tests 
      (id, name, scenario_id, schedule, enabled, options_json, last_run, 
       consecutive_failures, max_consecutive_failures, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      test.id,
      test.name,
      test.scenarioId,
      test.schedule,
      test.enabled,
      JSON.stringify(test.options),
      test.lastRun?.toISOString(),
      test.consecutiveFailures,
      test.maxConsecutiveFailures,
      test.createdAt.toISOString(),
      test.updatedAt.toISOString()
    );
  }

  private async saveExecution(execution: TestExecutionResult): Promise<void> {
    const stmt = db.prepare(`
      INSERT INTO test_executions 
      (scheduled_test_id, execution_id, start_time, end_time, success, error, 
       results, regression_alerts, benchmark_results)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      execution.scheduledTestId,
      execution.executionId,
      execution.startTime.toISOString(),
      execution.endTime.toISOString(),
      execution.success,
      execution.error,
      execution.results ? JSON.stringify(execution.results) : null,
      execution.regressionAlerts ? JSON.stringify(execution.regressionAlerts) : null,
      execution.benchmarkResults ? JSON.stringify(execution.benchmarkResults) : null
    );
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const stmt = db.prepare('SELECT config_json FROM scheduler_configuration WHERE id = 1');
      const row = stmt.get() as any;
      
      if (row) {
        this.configuration = { ...this.configuration, ...JSON.parse(row.config_json) };
      }
    } catch (error) {
      console.log('Using default scheduler configuration');
    }
  }

  private async saveConfiguration(): Promise<void> {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO scheduler_configuration (id, config_json, updated_at)
      VALUES (1, ?, ?)
    `);
    
    stmt.run(JSON.stringify(this.configuration), new Date().toISOString());
  }

  private getDefaultConfiguration(): SchedulerConfiguration {
    return {
      enabled: true,
      maxConcurrentTests: 3,
      defaultTimeout: 600000, // 10 minutes
      retryFailedTests: true,
      maxRetries: 2,
      retryDelay: 60000, // 1 minute
      cleanupOldResults: true,
      resultsRetentionDays: 30,
      notifications: {
        enabled: false,
        channels: ['console'],
        onSuccess: false,
        onFailure: true,
        onRegression: true
      }
    };
  }

  private startAllScheduledTests(): void {
    for (const scheduledTest of this.scheduledTests.values()) {
      if (scheduledTest.enabled) {
        this.startCronJob(scheduledTest);
      }
    }
    console.log('Started all enabled scheduled tests');
  }

  private stopAllScheduledTests(): void {
    for (const jobId of this.cronJobs.keys()) {
      this.stopCronJob(jobId);
    }
    console.log('Stopped all scheduled tests');
  }

  private startCronJob(scheduledTest: ScheduledTest): void {
    if (this.cronJobs.has(scheduledTest.id)) {
      this.stopCronJob(scheduledTest.id);
    }

    try {
      const job = new CronJob(
        scheduledTest.schedule,
        () => {
          this.executeTest(scheduledTest.id).catch(error => {
            console.error(`Scheduled test execution failed: ${scheduledTest.name}`, error);
          });
        },
        null,
        true, // Start immediately
        'UTC'
      );

      this.cronJobs.set(scheduledTest.id, job);
      
      // Update next run time
      const nextRun = job.nextDate()?.toJSDate();
      if (nextRun) {
        scheduledTest.nextRun = nextRun;
      }

      console.log(`Started cron job for: ${scheduledTest.name} (${scheduledTest.schedule})`);
    } catch (error) {
      console.error(`Failed to start cron job for: ${scheduledTest.name}`, error);
    }
  }

  private stopCronJob(scheduledTestId: string): void {
    const job = this.cronJobs.get(scheduledTestId);
    if (job) {
      job.stop();
      this.cronJobs.delete(scheduledTestId);
    }
  }

  private scheduleCleanupJob(): void {
    // Run cleanup daily at 2 AM UTC
    new CronJob(
      '0 2 * * *',
      () => {
        this.cleanupOldResults().catch(error => {
          console.error('Cleanup job failed:', error);
        });
      },
      null,
      true,
      'UTC'
    );
  }

  private async sendNotification(type: 'success' | 'failure' | 'regression', scheduledTest: ScheduledTest, execution: TestExecutionResult): Promise<void> {
    // Simple console logging for now
    // In production, implement actual notification channels (email, Slack, etc.)
    
    const message = this.formatNotificationMessage(type, scheduledTest, execution);
    
    switch (type) {
      case 'success':
        console.log(`✅ ${message}`);
        break;
      case 'failure':
        console.error(`❌ ${message}`);
        break;
      case 'regression':
        console.warn(`⚠️ ${message}`);
        break;
    }
    
    this.emit('notificationSent', { type, scheduledTest, execution, message });
  }

  private formatNotificationMessage(type: 'success' | 'failure' | 'regression', scheduledTest: ScheduledTest, execution: TestExecutionResult): string {
    const duration = execution.endTime.getTime() - execution.startTime.getTime();
    const durationStr = `${Math.round(duration / 1000)}s`;
    
    switch (type) {
      case 'success':
        return `Load test '${scheduledTest.name}' completed successfully in ${durationStr}`;
      case 'failure':
        return `Load test '${scheduledTest.name}' failed after ${durationStr}: ${execution.error}`;
      case 'regression':
        const alertCount = execution.regressionAlerts?.length || 0;
        return `Load test '${scheduledTest.name}' detected ${alertCount} performance regression(s)`;
      default:
        return `Load test '${scheduledTest.name}' completed`;
    }
  }
}

// Export singleton instance
export const loadTestScheduler = new LoadTestScheduler();