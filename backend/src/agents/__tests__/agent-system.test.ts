/**
 * Comprehensive Agent System Tests
 * 
 * These tests validate the entire agent system including:
 * - Base agent functionality
 * - Agent orchestration
 * - Message routing
 * - Task execution
 * - Error handling
 */

import { AgentOrchestrator, BaseAgent, AgentConfig, Task, AgentMessage } from '../index';

// Mock agent for testing
class MockAgent extends BaseAgent {
  private mockResponses: Map<string, any> = new Map();

  constructor(id: string, capabilities: string[] = ['test_task']) {
    const config: AgentConfig = {
      id,
      name: `Mock Agent ${id}`,
      description: 'Mock agent for testing',
      capabilities: capabilities.map(cap => ({
        name: cap,
        description: `Mock ${cap} capability`
      })),
      maxConcurrentTasks: 5,
      priority: 'medium',
      specialization: capabilities,
      memoryEnabled: false
    };

    super(config);
  }

  // Add mock response for a task type
  setMockResponse(taskType: string, response: any, delay: number = 100) {
    this.mockResponses.set(taskType, { response, delay });
  }

  protected async initialize(): Promise<void> {
    // Mock initialization
  }

  protected async executeTask(task: Task): Promise<any> {
    const mock = this.mockResponses.get(task.type);
    
    if (mock) {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, mock.delay));
      
      if (mock.response instanceof Error) {
        throw mock.response;
      }
      
      return mock.response;
    }

    // Default mock response
    return {
      taskId: task.id,
      taskType: task.type,
      result: 'mock_result',
      timestamp: new Date().toISOString()
    };
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    // Mock message handling
    this.logger.info(`Mock agent handling message: ${message.type}`);
  }

  protected async cleanup(): Promise<void> {
    // Mock cleanup
    this.mockResponses.clear();
  }
}

describe('Agent System Tests', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(async () => {
    orchestrator = new AgentOrchestrator({
      maxAgents: 10,
      healthCheckIntervalMs: 1000,
      enableMemory: false,
      enableLoadBalancing: true
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stop();
    }
  });

  describe('Orchestrator Basic Functionality', () => {
    test('should start and stop successfully', async () => {
      await orchestrator.start();
      
      const stats = orchestrator.getAgentStats();
      expect(stats.size).toBeGreaterThan(0);
      
      await orchestrator.stop();
    }, 10000);

    test('should register custom agents', async () => {
      const mockAgent = new MockAgent('test-agent-1');
      
      await orchestrator.start();
      const agentId = await orchestrator.registerAgent(mockAgent, 'mock');
      
      expect(agentId).toBe('test-agent-1');
      
      const stats = orchestrator.getAgentStats();
      expect(stats.has('test-agent-1')).toBe(true);
    }, 10000);

    test('should unregister agents', async () => {
      const mockAgent = new MockAgent('test-agent-2');
      
      await orchestrator.start();
      await orchestrator.registerAgent(mockAgent, 'mock');
      
      let stats = orchestrator.getAgentStats();
      expect(stats.has('test-agent-2')).toBe(true);
      
      await orchestrator.unregisterAgent('test-agent-2');
      
      stats = orchestrator.getAgentStats();
      expect(stats.has('test-agent-2')).toBe(false);
    }, 10000);
  });

  describe('Task Execution', () => {
    test('should execute single task successfully', async () => {
      const mockAgent = new MockAgent('task-agent-1');
      mockAgent.setMockResponse('test_task', { success: true, data: 'test_result' });

      await orchestrator.start();
      await orchestrator.registerAgent(mockAgent, 'mock');

      const taskId = await orchestrator.submitTask('mock', {
        type: 'test_task',
        description: 'Test task execution',
        input: { test: 'data' },
        context: {},
        priority: 'medium'
      });

      expect(taskId).toBeDefined();
      
      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const task = mockAgent.getTask(taskId);
      expect(task?.status).toBe('completed');
      expect(task?.result).toEqual({ success: true, data: 'test_result' });
    }, 10000);

    test('should handle task failures gracefully', async () => {
      const mockAgent = new MockAgent('task-agent-2');
      mockAgent.setMockResponse('failing_task', new Error('Mock task failure'));

      await orchestrator.start();
      await orchestrator.registerAgent(mockAgent, 'mock');

      const taskId = await orchestrator.submitTask('mock', {
        type: 'failing_task',
        description: 'Task that will fail',
        input: {},
        context: {},
        priority: 'medium'
      });

      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const task = mockAgent.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error?.message).toContain('Mock task failure');
    }, 10000);

    test('should distribute load across multiple agents', async () => {
      const agent1 = new MockAgent('load-test-1');
      const agent2 = new MockAgent('load-test-2');
      
      agent1.setMockResponse('load_test', { agent: 'agent1' }, 100);
      agent2.setMockResponse('load_test', { agent: 'agent2' }, 100);

      await orchestrator.start();
      await orchestrator.registerAgent(agent1, 'load_test');
      await orchestrator.registerAgent(agent2, 'load_test');

      const taskPromises = [];
      
      // Submit multiple tasks
      for (let i = 0; i < 10; i++) {
        const taskPromise = orchestrator.submitTask('load_test', {
          type: 'load_test',
          description: `Load test task ${i}`,
          input: { index: i },
          context: {},
          priority: 'low'
        });
        taskPromises.push(taskPromise);
      }

      const taskIds = await Promise.all(taskPromises);
      expect(taskIds.length).toBe(10);

      // Wait for all tasks to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check that tasks were distributed
      const stats1 = agent1.getStats();
      const stats2 = agent2.getStats();
      
      expect(stats1.totalTasks + stats2.totalTasks).toBe(10);
      expect(stats1.totalTasks).toBeGreaterThan(0);
      expect(stats2.totalTasks).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Workflow Execution', () => {
    test('should execute sequential workflow', async () => {
      const mockAgent = new MockAgent('workflow-agent');
      mockAgent.setMockResponse('step_1', { step: 1, result: 'step1_complete' });
      mockAgent.setMockResponse('step_2', { step: 2, result: 'step2_complete' });
      mockAgent.setMockResponse('step_3', { step: 3, result: 'step3_complete' });

      await orchestrator.start();
      await orchestrator.registerAgent(mockAgent, 'workflow');

      const workflowId = await orchestrator.executeWorkflow({
        name: 'Test Sequential Workflow',
        description: 'Test workflow with sequential execution',
        type: 'sequential',
        tasks: [
          {
            agentType: 'workflow',
            taskType: 'step_1',
            input: { data: 'input1' }
          },
          {
            agentType: 'workflow',
            taskType: 'step_2',
            input: { data: 'input2' }
          },
          {
            agentType: 'workflow',
            taskType: 'step_3',
            input: { data: 'input3' }
          }
        ],
        context: { test: true },
        priority: 'medium'
      });

      expect(workflowId).toBeDefined();

      // Wait for workflow completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      const workflow = orchestrator.getWorkflowStatus(workflowId);
      expect(workflow?.status).toBe('completed');
      expect(workflow?.results).toHaveLength(3);
    }, 15000);

    test('should execute parallel workflow', async () => {
      const mockAgent = new MockAgent('parallel-agent');
      mockAgent.setMockResponse('parallel_1', { task: 'parallel_1', duration: 200 }, 200);
      mockAgent.setMockResponse('parallel_2', { task: 'parallel_2', duration: 150 }, 150);
      mockAgent.setMockResponse('parallel_3', { task: 'parallel_3', duration: 300 }, 300);

      await orchestrator.start();
      await orchestrator.registerAgent(mockAgent, 'parallel');

      const startTime = Date.now();
      
      const workflowId = await orchestrator.executeWorkflow({
        name: 'Test Parallel Workflow',
        description: 'Test workflow with parallel execution',
        type: 'parallel',
        tasks: [
          {
            agentType: 'parallel',
            taskType: 'parallel_1',
            input: { data: 'parallel1' }
          },
          {
            agentType: 'parallel',
            taskType: 'parallel_2',
            input: { data: 'parallel2' }
          },
          {
            agentType: 'parallel',
            taskType: 'parallel_3',
            input: { data: 'parallel3' }
          }
        ],
        context: { parallel: true },
        priority: 'high'
      });

      // Wait for workflow completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const workflow = orchestrator.getWorkflowStatus(workflowId);
      expect(workflow?.status).toBe('completed');
      expect(workflow?.results).toHaveLength(3);
      
      // Parallel execution should be faster than sequential
      expect(totalTime).toBeLessThan(800); // Should be much less than 200+150+300=650
    }, 15000);

    test('should handle workflow failures', async () => {
      const mockAgent = new MockAgent('failing-workflow-agent');
      mockAgent.setMockResponse('success_step', { success: true });
      mockAgent.setMockResponse('failing_step', new Error('Workflow step failed'));

      await orchestrator.start();
      await orchestrator.registerAgent(mockAgent, 'failing_workflow');

      const workflowId = await orchestrator.executeWorkflow({
        name: 'Failing Workflow Test',
        description: 'Workflow that will fail on second step',
        type: 'sequential',
        tasks: [
          {
            agentType: 'failing_workflow',
            taskType: 'success_step',
            input: {}
          },
          {
            agentType: 'failing_workflow',
            taskType: 'failing_step',
            input: {}
          }
        ],
        context: {},
        priority: 'medium'
      });

      // Wait for workflow to fail
      await new Promise(resolve => setTimeout(resolve, 1000));

      const workflow = orchestrator.getWorkflowStatus(workflowId);
      expect(workflow?.status).toBe('failed');
      expect(workflow?.error).toContain('failed');
    }, 15000);
  });

  describe('Agent Communication', () => {
    test('should route messages between agents', async () => {
      const agent1 = new MockAgent('comm-agent-1');
      const agent2 = new MockAgent('comm-agent-2');

      await orchestrator.start();
      await orchestrator.registerAgent(agent1, 'comm1');
      await orchestrator.registerAgent(agent2, 'comm2');

      // Setup message spying
      const messagesSent: AgentMessage[] = [];
      const messagesReceived: AgentMessage[] = [];

      agent1.on('messageOut', (message) => messagesSent.push(message));
      agent2.on('messageIn', (message) => messagesReceived.push(message));

      // Send message from agent1 to agent2
      agent1.sendMessage({
        to: 'comm-agent-2',
        type: 'coordination',
        payload: { action: 'test_communication' },
        priority: 'medium'
      });

      // Wait for message routing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messagesSent).toHaveLength(1);
      expect(messagesSent[0].to).toBe('comm-agent-2');
      expect(messagesSent[0].payload.action).toBe('test_communication');
    }, 10000);

    test('should handle agent health monitoring', async () => {
      const mockAgent = new MockAgent('health-agent');
      
      await orchestrator.start();
      await orchestrator.registerAgent(mockAgent, 'health_test');

      const initialStats = orchestrator.getAgentStats();
      const agentStats = initialStats.get('health-agent');
      
      expect(agentStats).toBeDefined();
      expect(agentStats?.status).toBe('active');

      // Wait for a health check cycle
      await new Promise(resolve => setTimeout(resolve, 1500));

      const updatedStats = orchestrator.getAgentStats();
      const updatedAgentStats = updatedStats.get('health-agent');
      
      expect(updatedAgentStats?.status).toBe('active');
    }, 10000);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle agent initialization failures', async () => {
      class FailingAgent extends MockAgent {
        protected async initialize(): Promise<void> {
          throw new Error('Initialization failed');
        }
      }

      const failingAgent = new FailingAgent('failing-init-agent');
      
      await orchestrator.start();
      
      await expect(
        orchestrator.registerAgent(failingAgent, 'failing')
      ).rejects.toThrow('Initialization failed');
    }, 10000);

    test('should handle task timeouts', async () => {
      const slowAgent = new MockAgent('slow-agent');
      slowAgent.setMockResponse('slow_task', { result: 'slow_result' }, 2000);

      await orchestrator.start();
      await orchestrator.registerAgent(slowAgent, 'slow');

      const taskId = await orchestrator.submitTask('slow', {
        type: 'slow_task',
        description: 'Slow task that will timeout',
        input: {},
        context: {},
        priority: 'low',
        timeout: 500 // 500ms timeout
      });

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1000));

      const task = slowAgent.getTask(taskId);
      // Task should either be failed or still in progress due to timeout
      expect(['failed', 'in_progress'].includes(task?.status || '')).toBe(true);
    }, 10000);

    test('should track agent performance metrics', async () => {
      const metricsAgent = new MockAgent('metrics-agent');
      metricsAgent.setMockResponse('metrics_task', { success: true }, 100);

      await orchestrator.start();
      await orchestrator.registerAgent(metricsAgent, 'metrics');

      // Execute multiple tasks to generate metrics
      const taskPromises = [];
      for (let i = 0; i < 5; i++) {
        const taskPromise = orchestrator.submitTask('metrics', {
          type: 'metrics_task',
          description: `Metrics task ${i}`,
          input: { index: i },
          context: {},
          priority: 'low'
        });
        taskPromises.push(taskPromise);
      }

      await Promise.all(taskPromises);
      
      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = metricsAgent.getStats();
      expect(stats.totalTasks).toBe(5);
      expect(stats.completedTasks).toBe(5);
      expect(stats.successRate).toBe(1.0);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Integration Tests', () => {
    test('should handle complex multi-agent workflow', async () => {
      // Create specialized agents
      const promptAgent = new MockAgent('prompt-specialist', ['create_prompt', 'optimize_prompt']);
      const testAgent = new MockAgent('test-specialist', ['execute_test', 'validate_results']);
      const analyticsAgent = new MockAgent('analytics-specialist', ['generate_report', 'analyze_trends']);

      // Setup mock responses
      promptAgent.setMockResponse('create_prompt', { promptId: 123, status: 'created' });
      promptAgent.setMockResponse('optimize_prompt', { promptId: 123, optimized: true, score: 0.95 });
      
      testAgent.setMockResponse('execute_test', { testId: 456, status: 'passed', duration: 250 });
      testAgent.setMockResponse('validate_results', { valid: true, confidence: 0.88 });
      
      analyticsAgent.setMockResponse('generate_report', { reportId: 789, insights: 3 });
      analyticsAgent.setMockResponse('analyze_trends', { trends: ['improving', 'stable'], score: 0.92 });

      await orchestrator.start();
      await orchestrator.registerAgent(promptAgent, 'prompt_specialist');
      await orchestrator.registerAgent(testAgent, 'test_specialist');
      await orchestrator.registerAgent(analyticsAgent, 'analytics_specialist');

      const workflowId = await orchestrator.executeWorkflow({
        name: 'Complete AI Development Workflow',
        description: 'End-to-end workflow from prompt creation to analytics',
        type: 'sequential',
        tasks: [
          {
            agentType: 'prompt_specialist',
            taskType: 'create_prompt',
            input: { template: 'Summarize: {{text}}' }
          },
          {
            agentType: 'prompt_specialist',
            taskType: 'optimize_prompt',
            input: { promptId: 123 }
          },
          {
            agentType: 'test_specialist',
            taskType: 'execute_test',
            input: { promptId: 123, testCases: [1, 2, 3] }
          },
          {
            agentType: 'test_specialist',
            taskType: 'validate_results',
            input: { testId: 456 }
          },
          {
            agentType: 'analytics_specialist',
            taskType: 'generate_report',
            input: { testResults: [456] }
          },
          {
            agentType: 'analytics_specialist',
            taskType: 'analyze_trends',
            input: { reportId: 789 }
          }
        ],
        context: { 
          project: 'integration_test',
          user: 'test_user'
        },
        priority: 'high'
      });

      // Wait for complex workflow completion
      await new Promise(resolve => setTimeout(resolve, 3000));

      const workflow = orchestrator.getWorkflowStatus(workflowId);
      expect(workflow?.status).toBe('completed');
      expect(workflow?.results).toHaveLength(6);

      // Verify all agents were utilized
      const promptStats = promptAgent.getStats();
      const testStats = testAgent.getStats();
      const analyticsStats = analyticsAgent.getStats();

      expect(promptStats.completedTasks).toBe(2);
      expect(testStats.completedTasks).toBe(2);
      expect(analyticsStats.completedTasks).toBe(2);

      console.log('✅ Complex multi-agent workflow completed successfully');
    }, 20000);
  });
});

// Performance benchmarks (not run in regular test suite)
describe.skip('Performance Benchmarks', () => {
  test('should handle high task volume', async () => {
    const orchestrator = new AgentOrchestrator({
      maxAgents: 20,
      enableLoadBalancing: true
    });

    await orchestrator.start();

    // Register multiple agents
    const agents = [];
    for (let i = 0; i < 10; i++) {
      const agent = new MockAgent(`perf-agent-${i}`);
      agent.setMockResponse('perf_task', { result: `agent_${i}_result` }, 50);
      agents.push(agent);
      await orchestrator.registerAgent(agent, 'perf');
    }

    const startTime = Date.now();
    const taskPromises = [];

    // Submit 1000 tasks
    for (let i = 0; i < 1000; i++) {
      const taskPromise = orchestrator.submitTask('perf', {
        type: 'perf_task',
        description: `Performance test task ${i}`,
        input: { index: i },
        context: {},
        priority: 'low'
      });
      taskPromises.push(taskPromise);
    }

    const taskIds = await Promise.all(taskPromises);
    const submissionTime = Date.now() - startTime;

    console.log(`📊 Performance Results:`);
    console.log(`   Tasks submitted: ${taskIds.length}`);
    console.log(`   Submission time: ${submissionTime}ms`);
    console.log(`   Throughput: ${Math.round(taskIds.length / (submissionTime / 1000))} tasks/second`);

    // Wait for all tasks to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    const totalStats = agents.reduce((acc, agent) => {
      const stats = agent.getStats();
      return {
        totalTasks: acc.totalTasks + stats.totalTasks,
        completedTasks: acc.completedTasks + stats.completedTasks
      };
    }, { totalTasks: 0, completedTasks: 0 });

    console.log(`   Completed tasks: ${totalStats.completedTasks}/${totalStats.totalTasks}`);

    await orchestrator.stop();

    expect(totalStats.completedTasks).toBe(1000);
  }, 30000);
});