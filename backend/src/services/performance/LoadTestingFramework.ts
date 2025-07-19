import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { setTimeout } from 'timers/promises';
import { promisify } from 'util';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { performanceMonitor } from './PerformanceMonitor';
import { db } from '../../database/connection';
import fs from 'fs/promises';
import path from 'path';

export interface LoadTestScenario {
  id: string;
  name: string;
  description: string;
  config: {
    baseUrl: string;
    endpoints: EndpointConfig[];
    users: UserConfig;
    duration: DurationConfig;
    thresholds: ThresholdConfig;
    environment: EnvironmentConfig;
  };
  hooks?: {
    beforeScenario?: () => Promise<void>;
    afterScenario?: () => Promise<void>;
    beforeRequest?: (context: RequestContext) => Promise<void>;
    afterRequest?: (context: RequestContext, result: RequestResult) => Promise<void>;
  };
}

export interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  weight: number; // Relative frequency (0-100)
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  params?: Record<string, any>;
  validation?: {
    statusCode?: number[];
    responseTime?: number;
    bodyContains?: string[];
    headerExists?: string[];
  };
}

export interface UserConfig {
  concurrent: number;
  rampUp: {
    duration: number; // seconds
    strategy: 'linear' | 'exponential' | 'step';
  };
  rampDown: {
    duration: number;
    strategy: 'linear' | 'exponential' | 'immediate';
  };
  thinkTime: {
    min: number;
    max: number;
    distribution: 'uniform' | 'normal' | 'exponential';
  };
}

export interface DurationConfig {
  total: number; // seconds
  warmup?: number; // seconds
  cooldown?: number; // seconds
}

export interface ThresholdConfig {
  responseTime: {
    p95: number;
    p99: number;
    max: number;
  };
  errorRate: {
    max: number; // percentage
  };
  throughput: {
    min: number; // requests per second
  };
}

export interface EnvironmentConfig {
  variables?: Record<string, string>;
  dataFiles?: string[];
  concurrent?: boolean;
  keepAlive?: boolean;
  compression?: boolean;
}

export interface RequestContext {
  userId: string;
  scenario: LoadTestScenario;
  endpoint: EndpointConfig;
  iteration: number;
  startTime: number;
  environment: Record<string, any>;
}

export interface RequestResult {
  success: boolean;
  statusCode: number;
  responseTime: number;
  responseSize: number;
  errorMessage?: string;
  timestamp: number;
  userId: string;
  endpoint: string;
  headers: Record<string, string>;
}

export interface LoadTestResults {
  scenario: LoadTestScenario;
  summary: {
    startTime: Date;
    endTime: Date;
    duration: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    requestsPerSecond: number;
    bytesReceived: number;
    bytesSent: number;
  };
  metrics: {
    responseTime: {
      min: number;
      max: number;
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: {
      avg: number;
      peak: number;
      min: number;
    };
    errorRate: number;
    concurrency: {
      avg: number;
      peak: number;
    };
  };
  timeline: TimelinePoint[];
  errors: ErrorSummary[];
  thresholdResults: ThresholdResult[];
  recommendations: string[];
}

export interface TimelinePoint {
  timestamp: number;
  activeUsers: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  errorRate: number;
  p95ResponseTime: number;
}

export interface ErrorSummary {
  type: string;
  message: string;
  count: number;
  percentage: number;
  endpoints: string[];
  firstOccurrence: number;
  lastOccurrence: number;
}

export interface ThresholdResult {
  name: string;
  value: number;
  threshold: number;
  passed: boolean;
  severity: 'info' | 'warning' | 'error';
}

class WorkerPool {
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private busy: Set<Worker> = new Set();
  private maxWorkers: number;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = maxWorkers;
  }

  async getWorker(): Promise<Worker> {
    if (this.available.length > 0) {
      const worker = this.available.pop()!;
      this.busy.add(worker);
      return worker;
    }

    if (this.workers.length < this.maxWorkers) {
      const worker = new Worker(__filename, {
        workerData: { isWorker: true }
      });
      this.workers.push(worker);
      this.busy.add(worker);
      return worker;
    }

    // Wait for available worker
    return new Promise((resolve) => {
      const checkAvailable = () => {
        if (this.available.length > 0) {
          const worker = this.available.pop()!;
          this.busy.add(worker);
          resolve(worker);
        } else {
          setTimeout(checkAvailable, 10);
        }
      };
      checkAvailable();
    });
  }

  releaseWorker(worker: Worker): void {
    this.busy.delete(worker);
    this.available.push(worker);
  }

  async terminate(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
    this.available = [];
    this.busy.clear();
  }
}

export class LoadTestingFramework extends EventEmitter {
  private isRunning: boolean = false;
  private currentTest: LoadTestResults | null = null;
  private workerPool: WorkerPool;
  private scenarios: Map<string, LoadTestScenario> = new Map();
  private baselines: Map<string, LoadTestResults> = new Map();
  private regressionThresholds: Map<string, number> = new Map();

  constructor() {
    super();
    this.workerPool = new WorkerPool();
    this.setupDefaultScenarios();
    this.setupRegressionThresholds();
  }

  /**
   * Register a load test scenario
   */
  registerScenario(scenario: LoadTestScenario): void {
    this.scenarios.set(scenario.id, scenario);
    this.emit('scenarioRegistered', scenario);
  }

  /**
   * Get all registered scenarios
   */
  getScenarios(): LoadTestScenario[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * Run a load test scenario
   */
  async runLoadTest(scenarioId: string, options?: {
    dryRun?: boolean;
    saveBaseline?: boolean;
    compareBaseline?: boolean;
  }): Promise<LoadTestResults> {
    if (this.isRunning) {
      throw new Error('Load test is already running');
    }

    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    this.isRunning = true;
    this.emit('testStarted', scenario);

    try {
      if (options?.dryRun) {
        return await this.runDryRun(scenario);
      }

      const results = await this.executeLoadTest(scenario);
      
      if (options?.saveBaseline) {
        await this.saveBaseline(scenarioId, results);
      }

      if (options?.compareBaseline) {
        await this.compareWithBaseline(scenarioId, results);
      }

      await this.saveResults(results);
      this.emit('testCompleted', results);
      
      return results;
    } finally {
      this.isRunning = false;
      this.currentTest = null;
    }
  }

  /**
   * Run performance regression test
   */
  async runRegressionTest(scenarioIds: string[]): Promise<{
    passed: boolean;
    results: LoadTestResults[];
    regressions: RegressionResult[];
  }> {
    const results: LoadTestResults[] = [];
    const regressions: RegressionResult[] = [];

    for (const scenarioId of scenarioIds) {
      const result = await this.runLoadTest(scenarioId, { compareBaseline: true });
      results.push(result);

      const regression = await this.detectRegression(scenarioId, result);
      if (regression) {
        regressions.push(regression);
      }
    }

    const passed = regressions.length === 0;
    this.emit('regressionTestCompleted', { passed, results, regressions });

    return { passed, results, regressions };
  }

  /**
   * Get test status
   */
  getStatus(): {
    isRunning: boolean;
    currentTest?: {
      scenario: string;
      progress: number;
      elapsedTime: number;
      estimatedTimeRemaining: number;
    };
  } {
    if (!this.isRunning || !this.currentTest) {
      return { isRunning: false };
    }

    const elapsed = Date.now() - this.currentTest.summary.startTime.getTime();
    const totalDuration = this.currentTest.scenario.config.duration.total * 1000;
    const progress = Math.min((elapsed / totalDuration) * 100, 100);
    const estimatedTimeRemaining = Math.max(totalDuration - elapsed, 0);

    return {
      isRunning: true,
      currentTest: {
        scenario: this.currentTest.scenario.name,
        progress,
        elapsedTime: elapsed,
        estimatedTimeRemaining
      }
    };
  }

  /**
   * Stop current test
   */
  async stopTest(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.emit('testStopping');
    this.isRunning = false;
    await this.workerPool.terminate();
    this.emit('testStopped');
  }

  /**
   * Execute the actual load test
   */
  private async executeLoadTest(scenario: LoadTestScenario): Promise<LoadTestResults> {
    const startTime = new Date();
    const config = scenario.config;
    const results: LoadTestResults = {
      scenario,
      summary: {
        startTime,
        endTime: new Date(),
        duration: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        requestsPerSecond: 0,
        bytesReceived: 0,
        bytesSent: 0
      },
      metrics: {
        responseTime: { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
        throughput: { avg: 0, peak: 0, min: 0 },
        errorRate: 0,
        concurrency: { avg: 0, peak: 0 }
      },
      timeline: [],
      errors: [],
      thresholdResults: [],
      recommendations: []
    };

    this.currentTest = results;

    // Execute hooks
    if (scenario.hooks?.beforeScenario) {
      await scenario.hooks.beforeScenario();
    }

    const requestResults: RequestResult[] = [];
    const userPromises: Promise<void>[] = [];
    const timelineData: TimelinePoint[] = [];

    // Start timeline monitoring
    const timelineInterval = setInterval(() => {
      const now = Date.now();
      const recentResults = requestResults.filter(r => now - r.timestamp < 1000);
      
      const timelinePoint: TimelinePoint = {
        timestamp: now,
        activeUsers: userPromises.filter(p => !this.isPromiseSettled(p)).length,
        requestsPerSecond: recentResults.length,
        avgResponseTime: recentResults.reduce((sum, r) => sum + r.responseTime, 0) / recentResults.length || 0,
        errorRate: (recentResults.filter(r => !r.success).length / recentResults.length) * 100 || 0,
        p95ResponseTime: this.calculatePercentile(recentResults.map(r => r.responseTime), 95)
      };
      
      timelineData.push(timelinePoint);
      results.timeline = timelineData;
      
      this.emit('timelineUpdate', timelinePoint);
    }, 1000);

    try {
      // Ramp up users
      await this.rampUpUsers(scenario, async (userId: string) => {
        const userPromise = this.simulateUser(userId, scenario, requestResults);
        userPromises.push(userPromise);
        return userPromise;
      });

      // Wait for test duration
      await setTimeout(config.duration.total * 1000);

      // Stop all users
      this.isRunning = false;
      await Promise.allSettled(userPromises);

    } finally {
      clearInterval(timelineInterval);
    }

    // Execute hooks
    if (scenario.hooks?.afterScenario) {
      await scenario.hooks.afterScenario();
    }

    // Calculate final results
    const endTime = new Date();
    results.summary.endTime = endTime;
    results.summary.duration = (endTime.getTime() - startTime.getTime()) / 1000;
    results.summary.totalRequests = requestResults.length;
    results.summary.successfulRequests = requestResults.filter(r => r.success).length;
    results.summary.failedRequests = requestResults.filter(r => !r.success).length;
    results.summary.requestsPerSecond = results.summary.totalRequests / results.summary.duration;
    results.summary.bytesReceived = requestResults.reduce((sum, r) => sum + r.responseSize, 0);

    // Calculate metrics
    const responseTimes = requestResults.map(r => r.responseTime);
    if (responseTimes.length > 0) {
      results.metrics.responseTime = {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length,
        p50: this.calculatePercentile(responseTimes, 50),
        p95: this.calculatePercentile(responseTimes, 95),
        p99: this.calculatePercentile(responseTimes, 99)
      };
    }

    results.metrics.throughput = {
      avg: results.summary.requestsPerSecond,
      peak: Math.max(...timelineData.map(t => t.requestsPerSecond)),
      min: Math.min(...timelineData.map(t => t.requestsPerSecond))
    };

    results.metrics.errorRate = (results.summary.failedRequests / results.summary.totalRequests) * 100;
    
    results.metrics.concurrency = {
      avg: timelineData.reduce((sum, t) => sum + t.activeUsers, 0) / timelineData.length,
      peak: Math.max(...timelineData.map(t => t.activeUsers))
    };

    // Analyze errors
    results.errors = this.analyzeErrors(requestResults);

    // Check thresholds
    results.thresholdResults = this.checkThresholds(scenario, results);

    // Generate recommendations
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  /**
   * Ramp up users according to strategy
   */
  private async rampUpUsers(
    scenario: LoadTestScenario,
    createUser: (userId: string) => Promise<void>
  ): Promise<void> {
    const config = scenario.config.users;
    const rampUpDuration = config.rampUp.duration * 1000;
    const totalUsers = config.concurrent;
    
    for (let i = 0; i < totalUsers; i++) {
      const userId = uuidv4();
      await createUser(userId);
      
      // Calculate delay based on strategy
      let delay = 0;
      switch (config.rampUp.strategy) {
        case 'linear':
          delay = rampUpDuration / totalUsers;
          break;
        case 'exponential':
          delay = (rampUpDuration / totalUsers) * Math.pow(1.1, i);
          break;
        case 'step':
          delay = i % 5 === 0 ? rampUpDuration / (totalUsers / 5) : 0;
          break;
      }
      
      if (delay > 0 && i < totalUsers - 1) {
        await setTimeout(delay);
      }
    }
  }

  /**
   * Simulate a virtual user
   */
  private async simulateUser(
    userId: string,
    scenario: LoadTestScenario,
    results: RequestResult[]
  ): Promise<void> {
    const config = scenario.config;
    const environment = { ...config.environment.variables };

    while (this.isRunning) {
      // Select endpoint based on weight
      const endpoint = this.selectEndpoint(config.endpoints);
      
      const context: RequestContext = {
        userId,
        scenario,
        endpoint,
        iteration: results.filter(r => r.userId === userId).length + 1,
        startTime: Date.now(),
        environment
      };

      // Execute hooks
      if (scenario.hooks?.beforeRequest) {
        await scenario.hooks.beforeRequest(context);
      }

      // Make request
      const result = await this.makeRequest(context);
      results.push(result);

      // Execute hooks
      if (scenario.hooks?.afterRequest) {
        await scenario.hooks.afterRequest(context, result);
      }

      // Think time
      const thinkTime = this.calculateThinkTime(config.users.thinkTime);
      if (thinkTime > 0) {
        await setTimeout(thinkTime);
      }
    }
  }

  /**
   * Make HTTP request
   */
  private async makeRequest(context: RequestContext): Promise<RequestResult> {
    const startTime = performance.now();
    const endpoint = context.endpoint;
    const url = `${context.scenario.config.baseUrl}${endpoint.path}`;
    
    try {
      const response = await axios({
        method: endpoint.method,
        url,
        headers: endpoint.headers,
        data: endpoint.body,
        params: endpoint.params,
        timeout: endpoint.timeout || 30000,
        validateStatus: () => true // Don't throw on status codes
      });

      const responseTime = performance.now() - startTime;
      const responseSize = JSON.stringify(response.data).length;

      // Validate response
      let success = true;
      if (endpoint.validation) {
        if (endpoint.validation.statusCode && 
            !endpoint.validation.statusCode.includes(response.status)) {
          success = false;
        }
        if (endpoint.validation.responseTime && 
            responseTime > endpoint.validation.responseTime) {
          success = false;
        }
        if (endpoint.validation.bodyContains) {
          const body = JSON.stringify(response.data);
          success = endpoint.validation.bodyContains.every(text => body.includes(text));
        }
        if (endpoint.validation.headerExists) {
          success = endpoint.validation.headerExists.every(header => 
            response.headers[header] !== undefined);
        }
      } else {
        success = response.status >= 200 && response.status < 400;
      }

      return {
        success,
        statusCode: response.status,
        responseTime,
        responseSize,
        timestamp: Date.now(),
        userId: context.userId,
        endpoint: endpoint.path,
        headers: response.headers
      };

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      return {
        success: false,
        statusCode: 0,
        responseTime,
        responseSize: 0,
        errorMessage: error.message,
        timestamp: Date.now(),
        userId: context.userId,
        endpoint: endpoint.path,
        headers: {}
      };
    }
  }

  /**
   * Setup default load test scenarios
   */
  private setupDefaultScenarios(): void {
    // API Performance Test
    this.registerScenario({
      id: 'api-performance',
      name: 'API Performance Test',
      description: 'General API performance testing',
      config: {
        baseUrl: process.env.BASE_URL || 'http://localhost:3001',
        endpoints: [
          {
            path: '/api/health',
            method: 'GET',
            weight: 30,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/performance/overview',
            method: 'GET',
            weight: 25,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/analytics/metrics',
            method: 'GET',
            weight: 20,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/prompt-cards',
            method: 'GET',
            weight: 15,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/test-cases',
            method: 'GET',
            weight: 10,
            validation: { statusCode: [200] }
          }
        ],
        users: {
          concurrent: 10,
          rampUp: { duration: 30, strategy: 'linear' },
          rampDown: { duration: 10, strategy: 'linear' },
          thinkTime: { min: 1000, max: 3000, distribution: 'uniform' }
        },
        duration: { total: 300, warmup: 30, cooldown: 30 },
        thresholds: {
          responseTime: { p95: 1000, p99: 2000, max: 5000 },
          errorRate: { max: 5 },
          throughput: { min: 5 }
        },
        environment: {
          concurrent: true,
          keepAlive: true,
          compression: true
        }
      }
    });

    // Database Stress Test
    this.registerScenario({
      id: 'database-stress',
      name: 'Database Stress Test',
      description: 'Database-intensive operations testing',
      config: {
        baseUrl: process.env.BASE_URL || 'http://localhost:3001',
        endpoints: [
          {
            path: '/api/analytics/calculate',
            method: 'POST',
            weight: 40,
            body: { period: 'day', limit: 100 },
            validation: { statusCode: [200], responseTime: 5000 }
          },
          {
            path: '/api/reports/generate',
            method: 'POST',
            weight: 30,
            body: { type: 'performance', format: 'json' },
            validation: { statusCode: [200] }
          },
          {
            path: '/api/optimization/analyze',
            method: 'POST',
            weight: 30,
            body: { prompt: 'Test prompt for analysis' },
            validation: { statusCode: [200] }
          }
        ],
        users: {
          concurrent: 5,
          rampUp: { duration: 60, strategy: 'exponential' },
          rampDown: { duration: 30, strategy: 'linear' },
          thinkTime: { min: 2000, max: 5000, distribution: 'normal' }
        },
        duration: { total: 600, warmup: 60, cooldown: 60 },
        thresholds: {
          responseTime: { p95: 3000, p99: 8000, max: 15000 },
          errorRate: { max: 2 },
          throughput: { min: 2 }
        },
        environment: {
          concurrent: false,
          keepAlive: true
        }
      }
    });

    // High Concurrency Test
    this.registerScenario({
      id: 'high-concurrency',
      name: 'High Concurrency Test',
      description: 'Testing system behavior under high concurrent load',
      config: {
        baseUrl: process.env.BASE_URL || 'http://localhost:3001',
        endpoints: [
          {
            path: '/api/health',
            method: 'GET',
            weight: 50,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/performance/health',
            method: 'GET',
            weight: 30,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/analytics/realtime',
            method: 'GET',
            weight: 20,
            validation: { statusCode: [200] }
          }
        ],
        users: {
          concurrent: 50,
          rampUp: { duration: 120, strategy: 'step' },
          rampDown: { duration: 60, strategy: 'immediate' },
          thinkTime: { min: 500, max: 1500, distribution: 'exponential' }
        },
        duration: { total: 300, warmup: 60 },
        thresholds: {
          responseTime: { p95: 2000, p99: 5000, max: 10000 },
          errorRate: { max: 10 },
          throughput: { min: 20 }
        },
        environment: {
          concurrent: true,
          keepAlive: true,
          compression: true
        }
      }
    });
  }

  /**
   * Setup regression detection thresholds
   */
  private setupRegressionThresholds(): void {
    this.regressionThresholds.set('responseTime.p95', 1.2); // 20% increase
    this.regressionThresholds.set('responseTime.avg', 1.15); // 15% increase
    this.regressionThresholds.set('throughput.avg', 0.85); // 15% decrease
    this.regressionThresholds.set('errorRate', 1.5); // 50% increase
  }

  /**
   * Helper methods
   */
  private selectEndpoint(endpoints: EndpointConfig[]): EndpointConfig {
    const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const endpoint of endpoints) {
      currentWeight += endpoint.weight;
      if (random <= currentWeight) {
        return endpoint;
      }
    }
    
    return endpoints[endpoints.length - 1];
  }

  private calculateThinkTime(config: UserConfig['thinkTime']): number {
    const { min, max, distribution } = config;
    
    switch (distribution) {
      case 'uniform':
        return min + Math.random() * (max - min);
      case 'normal':
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const mean = (min + max) / 2;
        const stddev = (max - min) / 6;
        return Math.max(min, Math.min(max, mean + z0 * stddev));
      case 'exponential':
        const lambda = 1 / ((min + max) / 2);
        return min + (-Math.log(Math.random()) / lambda);
      default:
        return min + Math.random() * (max - min);
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private isPromiseSettled(promise: Promise<any>): boolean {
    // This is a simplified check - in real implementation you'd track promise states
    return false;
  }

  private analyzeErrors(results: RequestResult[]): ErrorSummary[] {
    const errorMap = new Map<string, RequestResult[]>();
    
    results.filter(r => !r.success).forEach(result => {
      const key = `${result.statusCode}_${result.errorMessage || 'Unknown'}`;
      if (!errorMap.has(key)) {
        errorMap.set(key, []);
      }
      errorMap.get(key)!.push(result);
    });

    return Array.from(errorMap.entries()).map(([key, errors]) => {
      const [statusCode, message] = key.split('_', 2);
      return {
        type: statusCode === '0' ? 'Network Error' : `HTTP ${statusCode}`,
        message: message || 'Unknown error',
        count: errors.length,
        percentage: (errors.length / results.length) * 100,
        endpoints: [...new Set(errors.map(e => e.endpoint))],
        firstOccurrence: Math.min(...errors.map(e => e.timestamp)),
        lastOccurrence: Math.max(...errors.map(e => e.timestamp))
      };
    });
  }

  private checkThresholds(scenario: LoadTestScenario, results: LoadTestResults): ThresholdResult[] {
    const thresholds = scenario.config.thresholds;
    const thresholdResults: ThresholdResult[] = [];

    // Response time thresholds
    thresholdResults.push({
      name: 'P95 Response Time',
      value: results.metrics.responseTime.p95,
      threshold: thresholds.responseTime.p95,
      passed: results.metrics.responseTime.p95 <= thresholds.responseTime.p95,
      severity: results.metrics.responseTime.p95 > thresholds.responseTime.p95 * 1.5 ? 'error' : 'warning'
    });

    thresholdResults.push({
      name: 'P99 Response Time',
      value: results.metrics.responseTime.p99,
      threshold: thresholds.responseTime.p99,
      passed: results.metrics.responseTime.p99 <= thresholds.responseTime.p99,
      severity: results.metrics.responseTime.p99 > thresholds.responseTime.p99 * 1.5 ? 'error' : 'warning'
    });

    // Error rate threshold
    thresholdResults.push({
      name: 'Error Rate',
      value: results.metrics.errorRate,
      threshold: thresholds.errorRate.max,
      passed: results.metrics.errorRate <= thresholds.errorRate.max,
      severity: results.metrics.errorRate > thresholds.errorRate.max * 2 ? 'error' : 'warning'
    });

    // Throughput threshold
    thresholdResults.push({
      name: 'Throughput',
      value: results.metrics.throughput.avg,
      threshold: thresholds.throughput.min,
      passed: results.metrics.throughput.avg >= thresholds.throughput.min,
      severity: results.metrics.throughput.avg < thresholds.throughput.min * 0.5 ? 'error' : 'warning'
    });

    return thresholdResults;
  }

  private generateRecommendations(results: LoadTestResults): string[] {
    const recommendations: string[] = [];
    const metrics = results.metrics;

    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected. Review error logs and implement better error handling.');
    }

    if (metrics.responseTime.p95 > 2000) {
      recommendations.push('Slow response times detected. Consider implementing caching or optimizing database queries.');
    }

    if (metrics.throughput.avg < 10) {
      recommendations.push('Low throughput detected. Consider scaling horizontally or optimizing application performance.');
    }

    if (results.errors.some(e => e.type.includes('Network'))) {
      recommendations.push('Network errors detected. Check network connectivity and implement retry mechanisms.');
    }

    const failedThresholds = results.thresholdResults.filter(t => !t.passed);
    if (failedThresholds.length > 0) {
      recommendations.push(`Performance thresholds failed: ${failedThresholds.map(t => t.name).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance metrics are within acceptable ranges.');
    }

    return recommendations;
  }

  private async runDryRun(scenario: LoadTestScenario): Promise<LoadTestResults> {
    // Simulate a quick test run for validation
    console.log(`Running dry run for scenario: ${scenario.name}`);
    
    // Return mock results
    return {
      scenario,
      summary: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 10,
        totalRequests: 10,
        successfulRequests: 10,
        failedRequests: 0,
        requestsPerSecond: 1,
        bytesReceived: 1000,
        bytesSent: 500
      },
      metrics: {
        responseTime: { min: 50, max: 200, avg: 100, p50: 95, p95: 180, p99: 195 },
        throughput: { avg: 1, peak: 1, min: 1 },
        errorRate: 0,
        concurrency: { avg: 1, peak: 1 }
      },
      timeline: [],
      errors: [],
      thresholdResults: [],
      recommendations: ['Dry run completed successfully']
    };
  }

  private async saveBaseline(scenarioId: string, results: LoadTestResults): Promise<void> {
    this.baselines.set(scenarioId, results);
    
    // Also save to database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO load_test_baselines 
      (scenario_id, results, created_at)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(scenarioId, JSON.stringify(results), new Date().toISOString());
  }

  private async compareWithBaseline(scenarioId: string, results: LoadTestResults): Promise<void> {
    const baseline = this.baselines.get(scenarioId);
    if (!baseline) {
      console.log(`No baseline found for scenario: ${scenarioId}`);
      return;
    }

    const comparison = {
      responseTime: {
        p95: (results.metrics.responseTime.p95 / baseline.metrics.responseTime.p95) - 1,
        avg: (results.metrics.responseTime.avg / baseline.metrics.responseTime.avg) - 1
      },
      throughput: {
        avg: (results.metrics.throughput.avg / baseline.metrics.throughput.avg) - 1
      },
      errorRate: results.metrics.errorRate - baseline.metrics.errorRate
    };

    console.log(`Baseline comparison for ${scenarioId}:`, comparison);
    this.emit('baselineComparison', { scenarioId, comparison, results, baseline });
  }

  private async detectRegression(scenarioId: string, results: LoadTestResults): Promise<RegressionResult | null> {
    const baseline = this.baselines.get(scenarioId);
    if (!baseline) {
      return null;
    }

    const regressions: RegressionIssue[] = [];

    // Check response time regression
    const p95Threshold = this.regressionThresholds.get('responseTime.p95') || 1.2;
    if (results.metrics.responseTime.p95 > baseline.metrics.responseTime.p95 * p95Threshold) {
      regressions.push({
        metric: 'responseTime.p95',
        baseline: baseline.metrics.responseTime.p95,
        current: results.metrics.responseTime.p95,
        threshold: p95Threshold,
        degradation: (results.metrics.responseTime.p95 / baseline.metrics.responseTime.p95) - 1
      });
    }

    // Check throughput regression
    const throughputThreshold = this.regressionThresholds.get('throughput.avg') || 0.85;
    if (results.metrics.throughput.avg < baseline.metrics.throughput.avg * throughputThreshold) {
      regressions.push({
        metric: 'throughput.avg',
        baseline: baseline.metrics.throughput.avg,
        current: results.metrics.throughput.avg,
        threshold: throughputThreshold,
        degradation: (baseline.metrics.throughput.avg / results.metrics.throughput.avg) - 1
      });
    }

    // Check error rate regression
    const errorRateThreshold = this.regressionThresholds.get('errorRate') || 1.5;
    if (results.metrics.errorRate > baseline.metrics.errorRate * errorRateThreshold) {
      regressions.push({
        metric: 'errorRate',
        baseline: baseline.metrics.errorRate,
        current: results.metrics.errorRate,
        threshold: errorRateThreshold,
        degradation: (results.metrics.errorRate / baseline.metrics.errorRate) - 1
      });
    }

    if (regressions.length > 0) {
      return {
        scenarioId,
        timestamp: new Date(),
        regressions,
        severity: regressions.some(r => r.degradation > 0.5) ? 'critical' : 
                 regressions.some(r => r.degradation > 0.2) ? 'high' : 'medium'
      };
    }

    return null;
  }

  private async saveResults(results: LoadTestResults): Promise<void> {
    try {
      const stmt = db.prepare(`
        INSERT INTO load_test_results 
        (scenario_id, scenario_name, start_time, end_time, duration, total_requests, 
         successful_requests, failed_requests, requests_per_second, avg_response_time, 
         p95_response_time, p99_response_time, error_rate, results_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        results.scenario.id,
        results.scenario.name,
        results.summary.startTime.toISOString(),
        results.summary.endTime.toISOString(),
        results.summary.duration,
        results.summary.totalRequests,
        results.summary.successfulRequests,
        results.summary.failedRequests,
        results.summary.requestsPerSecond,
        results.metrics.responseTime.avg,
        results.metrics.responseTime.p95,
        results.metrics.responseTime.p99,
        results.metrics.errorRate,
        JSON.stringify(results),
        new Date().toISOString()
      );
    } catch (error) {
      console.error('Failed to save load test results:', error);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.workerPool.terminate();
    this.removeAllListeners();
  }
}

// Interfaces for regression detection
interface RegressionResult {
  scenarioId: string;
  timestamp: Date;
  regressions: RegressionIssue[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface RegressionIssue {
  metric: string;
  baseline: number;
  current: number;
  threshold: number;
  degradation: number; // Percentage degradation
}

// Worker thread handler
if (!isMainThread && workerData?.isWorker) {
  // Worker thread logic for load testing
  parentPort?.on('message', async (message) => {
    const { type, data } = message;
    
    switch (type) {
      case 'makeRequest':
        // Handle request in worker thread
        break;
      case 'simulateUser':
        // Handle user simulation in worker thread
        break;
    }
  });
}

// Export singleton instance
export const loadTestingFramework = new LoadTestingFramework();