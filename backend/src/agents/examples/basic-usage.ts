/**
 * Basic Agent Usage Example
 * 
 * This example demonstrates how to use the agent system for common tasks
 * in the prompt card system.
 */

import { AgentOrchestrator, MemoryService } from '../index';
import { Pool } from 'pg';

async function basicAgentExample() {
  console.log('🚀 Starting Agent System Example');
  
  // Initialize memory service (optional - can pass null for no persistence)
  const memoryService = new MemoryService(new Pool({
    // Configure your database connection
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/promptdb'
  }));

  // Create and start orchestrator
  const orchestrator = new AgentOrchestrator({
    maxAgents: 10,
    healthCheckIntervalMs: 30000,
    enableMemory: true,
    enableLoadBalancing: true
  }, memoryService);

  try {
    // Start the orchestrator (this initializes default agents)
    await orchestrator.start();
    console.log('✅ Orchestrator started with default agents');

    // Example 1: Create a prompt card
    console.log('\n📝 Example 1: Creating a prompt card');
    const createPromptTask = await orchestrator.submitTask('prompt_card', {
      type: 'create_prompt_card',
      description: 'Create a new prompt card for code review',
      input: {
        title: 'Code Review Assistant',
        description: 'Helps review code for best practices and bugs',
        prompt_template: 'Please review this {{language}} code for best practices and potential bugs:\n\n{{code}}',
        variables: ['language', 'code']
      },
      context: {
        operationType: 'create',
        technologyStack: ['prompt_management'],
        priority: 'medium'
      },
      priority: 'medium'
    });

    console.log(`✅ Prompt card creation task submitted: ${createPromptTask}`);

    // Example 2: Execute tests in parallel
    console.log('\n🧪 Example 2: Executing tests in parallel');
    const executeTestsTask = await orchestrator.submitTask('test_execution', {
      type: 'execute_batch_tests',
      description: 'Execute multiple test cases in parallel',
      input: {
        testCaseIds: [1, 2, 3, 4, 5],
        maxConcurrency: 3,
        timeout: 30000
      },
      context: {
        operationType: 'test_execution',
        priority: 'high'
      },
      priority: 'high'
    });

    console.log(`✅ Test execution task submitted: ${executeTestsTask}`);

    // Example 3: Generate analytics dashboard
    console.log('\n📊 Example 3: Generating analytics dashboard');
    const analyticsTask = await orchestrator.submitTask('analytics', {
      type: 'generate_dashboard_metrics',
      description: 'Generate dashboard metrics for the last 24 hours',
      input: {
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        metrics: ['test_success_rate', 'prompt_usage', 'api_response_time']
      },
      context: {
        operationType: 'analytics',
        priority: 'medium'
      },
      priority: 'medium'
    });

    console.log(`✅ Analytics task submitted: ${analyticsTask}`);

    // Wait a bit to see some results
    console.log('\n⏳ Waiting for tasks to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check agent statistics
    console.log('\n📈 Agent Statistics:');
    const stats = orchestrator.getAgentStats();
    for (const [agentId, agentStats] of stats) {
      console.log(`  ${agentId}: ${agentStats.stats.totalTasks} tasks, ${Math.round(agentStats.stats.currentLoad * 100)}% load`);
    }

    // Example 4: Complex workflow
    console.log('\n🔄 Example 4: Running a complex workflow');
    const workflowId = await orchestrator.executeWorkflow({
      name: 'Complete Prompt Testing Workflow',
      description: 'Create prompt, run tests, analyze results',
      type: 'sequential',
      tasks: [
        {
          agentType: 'prompt_card',
          taskType: 'optimize_prompt',
          input: {
            prompt: 'Summarize this text: {{text}}',
            optimization_type: 'clarity'
          }
        },
        {
          agentType: 'test_execution',
          taskType: 'execute_single_test',
          input: {
            testCaseId: 1,
            promptCardId: 1
          }
        },
        {
          agentType: 'analytics',
          taskType: 'analyze_performance_trends',
          input: {
            metric: 'test_success_rate',
            period: 'hour'
          }
        }
      ],
      context: {
        workflowType: 'prompt_optimization',
        userId: 'example_user'
      },
      priority: 'medium'
    });

    console.log(`✅ Workflow submitted: ${workflowId}`);

    // Monitor workflow progress
    await monitorWorkflow(orchestrator, workflowId);

  } catch (error) {
    console.error('❌ Example failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await orchestrator.stop();
    console.log('✅ Orchestrator stopped');
  }
}

async function monitorWorkflow(orchestrator: AgentOrchestrator, workflowId: string) {
  let workflow = orchestrator.getWorkflowStatus(workflowId);
  
  while (workflow && workflow.status === 'pending' || workflow?.status === 'in_progress') {
    console.log(`  Workflow ${workflowId}: ${workflow.status}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    workflow = orchestrator.getWorkflowStatus(workflowId);
  }

  if (workflow) {
    console.log(`✅ Workflow ${workflowId} ${workflow.status}`);
    if (workflow.results) {
      console.log(`   Results: ${workflow.results.length} tasks completed`);
    }
  }
}

// Advanced example showing error handling and recovery
async function errorHandlingExample() {
  console.log('\n🛠️  Error Handling Example');

  const orchestrator = new AgentOrchestrator();
  
  // Setup error handlers
  orchestrator.on('agentError', ({ agentId, error }) => {
    console.log(`⚠️  Agent ${agentId} encountered error: ${error.message}`);
  });

  orchestrator.on('agentRestarted', ({ agentId }) => {
    console.log(`🔄 Agent ${agentId} was restarted`);
  });

  orchestrator.on('workflowFailed', ({ workflowId, error }) => {
    console.log(`❌ Workflow ${workflowId} failed: ${error.message}`);
  });

  await orchestrator.start();

  try {
    // Submit a task that might fail
    const taskId = await orchestrator.submitTask('prompt_card', {
      type: 'invalid_task_type', // This will cause an error
      description: 'This task will fail',
      input: {},
      context: {},
      priority: 'low'
    });

    console.log(`Submitted task that will fail: ${taskId}`);

  } catch (error) {
    console.log(`Expected error caught: ${error.message}`);
  }

  await orchestrator.stop();
}

// Performance testing example
async function performanceTestExample() {
  console.log('\n⚡ Performance Test Example');

  const orchestrator = new AgentOrchestrator({
    maxAgents: 5,
    enableLoadBalancing: true
  });

  await orchestrator.start();

  const startTime = Date.now();
  const tasks: Promise<string>[] = [];

  // Submit 50 concurrent tasks
  for (let i = 0; i < 50; i++) {
    const task = orchestrator.submitTask('test_execution', {
      type: 'execute_single_test',
      description: `Performance test ${i}`,
      input: {
        testCaseId: i,
        promptCardId: 1
      },
      context: { testRun: 'performance' },
      priority: 'low'
    });
    tasks.push(task);
  }

  const taskIds = await Promise.all(tasks);
  const endTime = Date.now();

  console.log(`✅ Submitted ${taskIds.length} tasks in ${endTime - startTime}ms`);
  console.log(`   Average: ${Math.round((endTime - startTime) / taskIds.length)}ms per task`);

  // Check load distribution
  const stats = orchestrator.getAgentStats();
  for (const [agentId, agentStats] of stats) {
    if (agentStats.type === 'test_execution') {
      console.log(`  ${agentId}: ${agentStats.stats.totalTasks} tasks assigned`);
    }
  }

  await orchestrator.stop();
}

// Run examples
async function runExamples() {
  try {
    await basicAgentExample();
    await errorHandlingExample();
    await performanceTestExample();
    
    console.log('\n🎉 All examples completed successfully!');
  } catch (error) {
    console.error('❌ Examples failed:', error);
    process.exit(1);
  }
}

// Export for use in other files
export {
  basicAgentExample,
  errorHandlingExample,
  performanceTestExample,
  runExamples
};

// Run if this file is executed directly
if (require.main === module) {
  runExamples();
}