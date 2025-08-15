import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { BaseAgent, AgentMessage, Task } from './core/BaseAgent';
import { PromptCardAgent } from './PromptCardAgent';
import { TestExecutionAgent } from './TestExecutionAgent';
import { AnalyticsAgent } from './AnalyticsAgent';
import { MemoryService, AntiCollisionResult } from '../memory/MemoryService';
import { Logger } from '../utils/logger';

export interface WorkflowTask {
  id: string;
  name: string;
  description: string;
  type: 'sequential' | 'parallel';
  tasks: TaskDefinition[];
  context: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  results?: any[];
  error?: string;
}

export interface TaskDefinition {
  agentType: string;
  taskType: string;
  input: any;
  dependencies?: string[];
  timeout?: number;
}

export interface AgentRegistration {
  agent: BaseAgent;
  type: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'busy';
  currentLoad: number;
  lastHealthCheck: Date;
}

export interface OrchestratorConfig {
  maxAgents: number;
  healthCheckIntervalMs: number;
  taskTimeoutMs: number;
  enableMemory: boolean;
  enableLoadBalancing: boolean;
}

export class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, AgentRegistration> = new Map();
  private workflows: Map<string, WorkflowTask> = new Map();
  private messageRouter: Map<string, string[]> = new Map();
  private memoryService?: MemoryService;
  private logger: Logger;
  private config: OrchestratorConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: Partial<OrchestratorConfig> = {}, memoryService?: MemoryService) {
    super();
    
    this.config = {
      maxAgents: config.maxAgents || 10,
      healthCheckIntervalMs: config.healthCheckIntervalMs || 30000,
      taskTimeoutMs: config.taskTimeoutMs || 60000,
      enableMemory: config.enableMemory ?? true,
      enableLoadBalancing: config.enableLoadBalancing ?? true
    };
    
    this.memoryService = memoryService;
    this.logger = new Logger('AgentOrchestrator');
    this.setupEventHandlers();
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Orchestrator is already running');
      return;
    }

    this.logger.info('Starting Agent Orchestrator');
    this.isRunning = true;

    // Initialize default agents
    await this.initializeDefaultAgents();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    this.emit('started');
    this.logger.info('Agent Orchestrator started successfully');
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping Agent Orchestrator');
    this.isRunning = false;

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Stop all agents
    for (const [agentId, registration] of this.agents) {
      try {
        await registration.agent.stop();
        this.logger.info(`Stopped agent: ${agentId}`);
      } catch (error) {
        this.logger.error(`Failed to stop agent ${agentId}:`, error);
      }
    }

    this.agents.clear();
    this.workflows.clear();
    
    this.emit('stopped');
    this.logger.info('Agent Orchestrator stopped');
  }

  /**
   * Register a new agent
   */
  async registerAgent(agent: BaseAgent, type: string): Promise<string> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error('Maximum number of agents reached');
    }

    const agentId = agent['config'].id;
    
    if (this.agents.has(agentId)) {
      throw new Error(`Agent ${agentId} is already registered`);
    }

    // Setup message routing
    agent.on('messageOut', (message: AgentMessage) => {
      this.routeMessage(message);
    });

    // Setup task completion handling
    agent.on('taskCompleted', (data) => {
      this.handleAgentTaskCompletion(agentId, data);
    });

    // Setup error handling
    agent.on('error', (error) => {
      this.handleAgentError(agentId, error);
    });

    const registration: AgentRegistration = {
      agent,
      type,
      capabilities: agent['config'].capabilities.map(c => c.name),
      status: 'active',
      currentLoad: 0,
      lastHealthCheck: new Date()
    };

    this.agents.set(agentId, registration);
    
    // Start the agent
    await agent.start();
    
    this.logger.info(`Registered agent: ${agentId} (type: ${type})`);
    this.emit('agentRegistered', { agentId, type });
    
    return agentId;
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const registration = this.agents.get(agentId);
    
    if (!registration) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await registration.agent.stop();
    this.agents.delete(agentId);
    
    this.logger.info(`Unregistered agent: ${agentId}`);
    this.emit('agentUnregistered', { agentId });
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflow: Omit<WorkflowTask, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const workflowId = nanoid();
    
    const workflowTask: WorkflowTask = {
      ...workflow,
      id: workflowId,
      status: 'pending',
      createdAt: new Date()
    };

    this.workflows.set(workflowId, workflowTask);
    
    this.logger.info(`Executing workflow: ${workflowId} (${workflow.name})`);
    
    // Execute workflow asynchronously
    this.processWorkflow(workflowTask).catch(error => {
      this.logger.error(`Workflow ${workflowId} failed:`, error);
      workflowTask.status = 'failed';
      workflowTask.error = error.message;
      workflowTask.completedAt = new Date();
      this.emit('workflowFailed', { workflowId, error });
    });

    return workflowId;
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): WorkflowTask | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Submit task to appropriate agent
   */
  async submitTask(agentType: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const agent = this.selectAgent(agentType, task);
    
    if (!agent) {
      throw new Error(`No available agent of type: ${agentType}`);
    }

    // Check for task collision if memory is enabled
    if (this.config.enableMemory && this.memoryService) {
      const taskHash = this.memoryService.generateTaskHash(
        task.description,
        task.context
      );
      
      const availableAgents = Array.from(this.agents.entries())
        .filter(([_, reg]) => reg.type === agentType && reg.status === 'active')
        .map(([id]) => id);
      
      const collisionResult = await this.memoryService.checkTaskCollision(
        taskHash,
        availableAgents
      );
      
      if (collisionResult.suggestedAgent) {
        const suggestedReg = this.agents.get(collisionResult.suggestedAgent);
        if (suggestedReg) {
          return await suggestedReg.agent.submitTask(task);
        }
      }
    }

    return await agent.submitTask(task);
  }

  /**
   * Get agent statistics
   */
  getAgentStats(): Map<string, any> {
    const stats = new Map();
    
    for (const [agentId, registration] of this.agents) {
      stats.set(agentId, {
        type: registration.type,
        status: registration.status,
        currentLoad: registration.agent.getStats().currentLoad,
        stats: registration.agent.getStats()
      });
    }
    
    return stats;
  }

  /**
   * Initialize default agents
   */
  private async initializeDefaultAgents(): Promise<void> {
    this.logger.info('Initializing default agents');

    try {
      // Create and register Prompt Card Agent
      const promptCardAgent = new PromptCardAgent(this.memoryService);
      await this.registerAgent(promptCardAgent, 'prompt_card');

      // Create and register Test Execution Agent
      const testExecutionAgent = new TestExecutionAgent(this.memoryService);
      await this.registerAgent(testExecutionAgent, 'test_execution');

      // Create and register Analytics Agent
      const analyticsAgent = new AnalyticsAgent(this.memoryService);
      await this.registerAgent(analyticsAgent, 'analytics');

      this.logger.info('Default agents initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize default agents:', error);
      throw error;
    }
  }

  /**
   * Process a workflow
   */
  private async processWorkflow(workflow: WorkflowTask): Promise<void> {
    workflow.status = 'in_progress';
    workflow.startedAt = new Date();
    workflow.results = [];

    this.emit('workflowStarted', { workflowId: workflow.id });

    try {
      if (workflow.type === 'sequential') {
        await this.processSequentialTasks(workflow);
      } else {
        await this.processParallelTasks(workflow);
      }

      workflow.status = 'completed';
      workflow.completedAt = new Date();
      
      this.logger.info(`Workflow ${workflow.id} completed successfully`);
      this.emit('workflowCompleted', { 
        workflowId: workflow.id, 
        results: workflow.results 
      });

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = error.message;
      workflow.completedAt = new Date();
      throw error;
    }
  }

  /**
   * Process tasks sequentially
   */
  private async processSequentialTasks(workflow: WorkflowTask): Promise<void> {
    for (const taskDef of workflow.tasks) {
      try {
        const result = await this.executeTaskDefinition(taskDef, workflow.context);
        workflow.results!.push(result);
        
        this.emit('taskCompleted', {
          workflowId: workflow.id,
          task: taskDef,
          result
        });

      } catch (error) {
        throw new Error(`Task failed: ${taskDef.taskType} - ${error.message}`);
      }
    }
  }

  /**
   * Process tasks in parallel
   */
  private async processParallelTasks(workflow: WorkflowTask): Promise<void> {
    const taskPromises = workflow.tasks.map(taskDef =>
      this.executeTaskDefinition(taskDef, workflow.context)
        .then(result => {
          workflow.results!.push(result);
          this.emit('taskCompleted', {
            workflowId: workflow.id,
            task: taskDef,
            result
          });
          return result;
        })
    );

    await Promise.all(taskPromises);
  }

  /**
   * Execute a task definition
   */
  private async executeTaskDefinition(taskDef: TaskDefinition, context: any): Promise<any> {
    const task: Omit<Task, 'id' | 'status' | 'createdAt'> = {
      type: taskDef.taskType,
      description: `${taskDef.agentType}: ${taskDef.taskType}`,
      input: taskDef.input,
      context,
      priority: 'medium',
      timeout: taskDef.timeout
    };

    const taskId = await this.submitTask(taskDef.agentType, task);
    
    // Wait for task completion (simplified - real implementation would use events)
    return await this.waitForTaskCompletion(taskDef.agentType, taskId, taskDef.timeout || this.config.taskTimeoutMs);
  }

  /**
   * Wait for task completion
   */
  private async waitForTaskCompletion(agentType: string, taskId: string, timeout: number): Promise<any> {
    const registration = Array.from(this.agents.values())
      .find(reg => reg.type === agentType);
    
    if (!registration) {
      throw new Error(`Agent type not found: ${agentType}`);
    }

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const task = registration.agent.getTask(taskId);
      
      if (task) {
        if (task.status === 'completed') {
          return task.result;
        }
        
        if (task.status === 'failed') {
          throw new Error(task.error?.message || 'Task failed');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Task timeout');
  }

  /**
   * Select best agent for a task
   */
  private selectAgent(agentType: string, task: any): BaseAgent | null {
    const availableAgents = Array.from(this.agents.entries())
      .filter(([_, reg]) => 
        reg.type === agentType && 
        reg.status === 'active' &&
        reg.currentLoad < 0.8
      )
      .sort((a, b) => a[1].currentLoad - b[1].currentLoad);

    if (availableAgents.length === 0) {
      return null;
    }

    // Select agent with lowest load if load balancing is enabled
    if (this.config.enableLoadBalancing) {
      return availableAgents[0][1].agent;
    }

    // Random selection if load balancing is disabled
    const randomIndex = Math.floor(Math.random() * availableAgents.length);
    return availableAgents[randomIndex][1].agent;
  }

  /**
   * Route message between agents
   */
  private routeMessage(message: AgentMessage): void {
    const targetAgent = this.agents.get(message.to);
    
    if (targetAgent) {
      targetAgent.agent.receiveMessage(message);
      this.logger.debug(`Routed message from ${message.from} to ${message.to}`);
    } else {
      this.logger.warn(`Target agent not found: ${message.to}`);
    }
  }

  /**
   * Handle agent task completion
   */
  private handleAgentTaskCompletion(agentId: string, data: any): void {
    this.logger.info(`Agent ${agentId} completed task: ${data.task.id}`);
    
    const registration = this.agents.get(agentId);
    if (registration) {
      registration.currentLoad = registration.agent.getStats().currentLoad;
    }

    this.emit('agentTaskCompleted', { agentId, ...data });
  }

  /**
   * Handle agent errors
   */
  private handleAgentError(agentId: string, error: Error): void {
    this.logger.error(`Agent ${agentId} error:`, error);
    
    const registration = this.agents.get(agentId);
    if (registration) {
      registration.status = 'inactive';
      
      // Attempt to restart agent
      this.restartAgent(agentId).catch(err => {
        this.logger.error(`Failed to restart agent ${agentId}:`, err);
      });
    }

    this.emit('agentError', { agentId, error });
  }

  /**
   * Restart an agent
   */
  private async restartAgent(agentId: string): Promise<void> {
    const registration = this.agents.get(agentId);
    
    if (!registration) {
      throw new Error(`Agent ${agentId} not found`);
    }

    this.logger.info(`Restarting agent: ${agentId}`);

    try {
      await registration.agent.stop();
      await registration.agent.start();
      registration.status = 'active';
      registration.lastHealthCheck = new Date();
      
      this.logger.info(`Agent ${agentId} restarted successfully`);
      this.emit('agentRestarted', { agentId });
      
    } catch (error) {
      this.logger.error(`Failed to restart agent ${agentId}:`, error);
      registration.status = 'inactive';
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        this.logger.error('Health check failed:', error);
      });
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Perform health checks on all agents
   */
  private async performHealthChecks(): Promise<void> {
    for (const [agentId, registration] of this.agents) {
      try {
        const stats = registration.agent.getStats();
        registration.currentLoad = stats.currentLoad;
        registration.lastHealthCheck = new Date();

        // Check if agent is responsive
        if (Date.now() - stats.lastActivity.getTime() > 60000) {
          this.logger.warn(`Agent ${agentId} appears unresponsive`);
          registration.status = 'inactive';
        } else {
          registration.status = 'active';
        }

      } catch (error) {
        this.logger.error(`Health check failed for agent ${agentId}:`, error);
        registration.status = 'inactive';
      }
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('error', (error) => {
      this.logger.error('Orchestrator error:', error);
    });

    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, shutting down gracefully');
      this.stop().catch(error => {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, shutting down gracefully');
      this.stop().catch(error => {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      });
    });
  }
}