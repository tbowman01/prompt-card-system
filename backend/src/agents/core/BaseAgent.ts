import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { MemoryService, AgentMemory, TaskContext } from '../../memory/MemoryService';
import { Logger } from '../../utils/logger';

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: any;
  outputSchema?: any;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  maxConcurrentTasks: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  specialization: string[];
  memoryEnabled: boolean;
}

export interface Task {
  id: string;
  type: string;
  description: string;
  input: any;
  context: TaskContext;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requesterAgent?: string;
  correlationId?: string;
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task_request' | 'task_response' | 'coordination' | 'status' | 'error';
  payload: any;
  correlationId?: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  successRate: number;
  currentLoad: number;
  capabilities: string[];
  uptime: number;
  lastActivity: Date;
}

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected tasks: Map<string, Task> = new Map();
  protected isRunning: boolean = false;
  protected startTime: Date = new Date();
  protected logger: Logger;
  protected memoryService?: MemoryService;
  private messageQueue: AgentMessage[] = [];
  private processingLoop?: NodeJS.Timeout;

  constructor(config: AgentConfig, memoryService?: MemoryService) {
    super();
    this.config = config;
    this.memoryService = memoryService;
    this.logger = new Logger(`Agent:${config.name}`);
    this.setupErrorHandling();
  }

  /**
   * Start the agent and begin processing tasks
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Agent is already running');
      return;
    }

    this.logger.info(`Starting agent: ${this.config.name}`);
    this.isRunning = true;
    this.startTime = new Date();

    await this.initialize();
    this.startProcessingLoop();
    
    this.emit('started', { agentId: this.config.id });
    this.logger.info(`Agent ${this.config.name} started successfully`);
  }

  /**
   * Stop the agent gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info(`Stopping agent: ${this.config.name}`);
    this.isRunning = false;

    if (this.processingLoop) {
      clearInterval(this.processingLoop);
      this.processingLoop = undefined;
    }

    // Wait for current tasks to complete or timeout
    await this.gracefulShutdown();
    await this.cleanup();

    this.emit('stopped', { agentId: this.config.id });
    this.logger.info(`Agent ${this.config.name} stopped`);
  }

  /**
   * Submit a task to this agent
   */
  async submitTask(task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const fullTask: Task = {
      ...task,
      id: nanoid(),
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: task.maxRetries || 3
    };

    if (this.tasks.size >= this.config.maxConcurrentTasks) {
      throw new Error(`Agent ${this.config.name} is at maximum capacity`);
    }

    // Check if agent can handle this task type
    if (!this.canHandleTask(fullTask)) {
      throw new Error(`Agent ${this.config.name} cannot handle task type: ${task.type}`);
    }

    this.tasks.set(fullTask.id, fullTask);
    this.logger.info(`Task ${fullTask.id} submitted to agent ${this.config.name}`);

    // Record task assignment in memory if enabled
    if (this.memoryService && this.config.memoryEnabled) {
      await this.memoryService.recordTaskAssignment(
        this.config.id,
        task.description,
        task.context
      );
    }

    this.emit('taskSubmitted', { task: fullTask });
    return fullTask.id;
  }

  /**
   * Get task status and result
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks with optional filtering
   */
  getTasks(filter?: { status?: Task['status']; type?: string }): Task[] {
    const allTasks = Array.from(this.tasks.values());
    
    if (!filter) return allTasks;

    return allTasks.filter(task => {
      if (filter.status && task.status !== filter.status) return false;
      if (filter.type && task.type !== filter.type) return false;
      return true;
    });
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'completed' || task.status === 'failed') {
      return false;
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    
    this.emit('taskCancelled', { task });
    this.logger.info(`Task ${taskId} cancelled`);
    
    return true;
  }

  /**
   * Send message to another agent
   */
  sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp' | 'from'>): void {
    const fullMessage: AgentMessage = {
      ...message,
      id: nanoid(),
      from: this.config.id,
      timestamp: new Date()
    };

    this.emit('messageOut', fullMessage);
  }

  /**
   * Receive message from another agent
   */
  receiveMessage(message: AgentMessage): void {
    this.messageQueue.push(message);
    this.emit('messageIn', message);
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    const tasks = Array.from(this.tasks.values());
    const completed = tasks.filter(t => t.status === 'completed');
    const failed = tasks.filter(t => t.status === 'failed');
    
    const totalExecutionTime = completed.reduce((sum, task) => {
      if (task.startedAt && task.completedAt) {
        return sum + (task.completedAt.getTime() - task.startedAt.getTime());
      }
      return sum;
    }, 0);

    return {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      failedTasks: failed.length,
      averageExecutionTime: completed.length > 0 ? totalExecutionTime / completed.length : 0,
      successRate: tasks.length > 0 ? completed.length / tasks.length : 0,
      currentLoad: this.tasks.size / this.config.maxConcurrentTasks,
      capabilities: this.config.capabilities.map(c => c.name),
      uptime: new Date().getTime() - this.startTime.getTime(),
      lastActivity: new Date()
    };
  }

  /**
   * Check if agent can handle a specific task
   */
  protected canHandleTask(task: Task): boolean {
    return this.config.capabilities.some(cap => 
      cap.name === task.type || 
      this.config.specialization.includes(task.type)
    );
  }

  /**
   * Abstract method to initialize agent-specific resources
   */
  protected abstract initialize(): Promise<void>;

  /**
   * Abstract method to execute a specific task
   */
  protected abstract executeTask(task: Task): Promise<any>;

  /**
   * Abstract method to handle agent-specific messages
   */
  protected abstract handleMessage(message: AgentMessage): Promise<void>;

  /**
   * Abstract method for cleanup during shutdown
   */
  protected abstract cleanup(): Promise<void>;

  /**
   * Main processing loop
   */
  private startProcessingLoop(): void {
    this.processingLoop = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.processMessages();
        await this.processTasks();
        await this.performMaintenance();
      } catch (error) {
        this.logger.error('Error in processing loop:', error);
        this.emit('error', error);
      }
    }, 100); // Process every 100ms
  }

  /**
   * Process pending messages
   */
  private async processMessages(): Promise<void> {
    while (this.messageQueue.length > 0 && this.isRunning) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          await this.handleMessage(message);
        } catch (error) {
          this.logger.error('Error processing message:', error);
          this.emit('messageError', { message, error });
        }
      }
    }
  }

  /**
   * Process pending and in-progress tasks
   */
  private async processTasks(): Promise<void> {
    const pendingTasks = this.getTasks({ status: 'pending' });
    
    for (const task of pendingTasks) {
      if (!this.isRunning) break;

      try {
        task.status = 'in_progress';
        task.startedAt = new Date();
        
        this.logger.info(`Starting task ${task.id}: ${task.description}`);
        this.emit('taskStarted', { task });

        const result = await this.executeTask(task);
        
        task.result = result;
        task.status = 'completed';
        task.completedAt = new Date();
        
        this.logger.info(`Task ${task.id} completed successfully`);
        this.emit('taskCompleted', { task, result });

        // Record completion in memory
        if (this.memoryService && this.config.memoryEnabled) {
          await this.recordTaskCompletion(task, result);
        }

      } catch (error) {
        await this.handleTaskError(task, error as Error);
      }
    }
  }

  /**
   * Handle task execution errors
   */
  private async handleTaskError(task: Task, error: Error): Promise<void> {
    task.error = error;
    task.retryCount = (task.retryCount || 0) + 1;

    if (task.retryCount < (task.maxRetries || 3)) {
      task.status = 'pending';
      this.logger.warn(`Task ${task.id} failed, retrying (${task.retryCount}/${task.maxRetries}):`, error.message);
      this.emit('taskRetry', { task, error });
    } else {
      task.status = 'failed';
      task.completedAt = new Date();
      this.logger.error(`Task ${task.id} failed permanently:`, error);
      this.emit('taskFailed', { task, error });
    }
  }

  /**
   * Record task completion in memory service
   */
  private async recordTaskCompletion(task: Task, result: any): Promise<void> {
    if (!this.memoryService) return;

    try {
      const patterns = this.extractLearnedPatterns(task, result);
      const metrics = this.calculatePerformanceMetrics(task);

      await this.memoryService.recordTaskCompletion(
        task.id,
        result,
        patterns,
        metrics
      );
    } catch (error) {
      this.logger.warn('Failed to record task completion in memory:', error);
    }
  }

  /**
   * Extract learned patterns from task execution
   */
  private extractLearnedPatterns(task: Task, result: any): string[] {
    const patterns: string[] = [];
    
    // Basic pattern extraction logic
    if (task.status === 'completed') {
      patterns.push(`successful_${task.type}_execution`);
      
      if (task.context.technologyStack) {
        patterns.push(`${task.type}_with_${task.context.technologyStack.join('_')}`);
      }
      
      if (result && typeof result === 'object' && result.optimizations) {
        patterns.push(`optimization_applied_${task.type}`);
      }
    }

    return patterns;
  }

  /**
   * Calculate performance metrics for a task
   */
  private calculatePerformanceMetrics(task: Task): any {
    const metrics: any = {};
    
    if (task.startedAt && task.completedAt) {
      metrics.executionTimeMs = task.completedAt.getTime() - task.startedAt.getTime();
      metrics.executionTimeSeconds = metrics.executionTimeMs / 1000;
    }
    
    metrics.retryCount = task.retryCount || 0;
    metrics.success = task.status === 'completed';
    metrics.taskType = task.type;
    metrics.priority = task.priority;
    
    return metrics;
  }

  /**
   * Perform periodic maintenance tasks
   */
  private async performMaintenance(): Promise<void> {
    // Clean up completed tasks older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [taskId, task] of this.tasks) {
      if (task.completedAt && task.completedAt < oneHourAgo) {
        this.tasks.delete(taskId);
      }
    }
  }

  /**
   * Wait for current tasks to complete during shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    const activeTasks = this.getTasks({ status: 'in_progress' });
    
    if (activeTasks.length === 0) return;

    this.logger.info(`Waiting for ${activeTasks.length} tasks to complete...`);
    
    const timeout = 30000; // 30 seconds timeout
    const startTime = Date.now();
    
    while (this.getTasks({ status: 'in_progress' }).length > 0) {
      if (Date.now() - startTime > timeout) {
        this.logger.warn('Shutdown timeout reached, cancelling remaining tasks');
        for (const task of this.getTasks({ status: 'in_progress' })) {
          await this.cancelTask(task.id);
        }
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Setup error handling for uncaught errors
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      this.logger.error('Agent error:', error);
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception in agent:', error);
      this.emit('error', error);
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection in agent:', reason);
      this.emit('error', reason);
    });
  }
}