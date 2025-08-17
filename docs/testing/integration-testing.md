# Integration Testing Guide

## Overview

This guide covers integration testing for the Prompt Card System, including API integration tests, database integration, service coordination tests, and end-to-end workflow validation.

## Integration Test Strategy

### Test Levels
1. **Service Integration**: Testing service-to-service communication
2. **API Integration**: Testing REST API endpoints with real dependencies
3. **Database Integration**: Testing data persistence and retrieval
4. **System Integration**: Testing complete workflows across all components
5. **External Integration**: Testing third-party service integrations

### Test Environment
Integration tests run against:
- **Test Database**: SQLite in-memory or dedicated test database
- **Test Services**: Real service instances with test configurations
- **Mock External APIs**: Controlled external service responses
- **Isolated Network**: Controlled network environment

## Test Configuration

### Jest Configuration for Integration Tests
```javascript
// jest.config.integration.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.integration.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
  testTimeout: 60000, // Longer timeout for integration tests
  maxWorkers: 1, // Run serially to avoid conflicts
  globalSetup: '<rootDir>/tests/integration/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/integration/globalTeardown.ts',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage/integration',
};
```

### Test Environment Setup
```typescript
// tests/integration/setup.ts
import { TestDatabase } from './testDatabase';
import { TestServer } from './testServer';

let testDb: TestDatabase;
let testServer: TestServer;

beforeAll(async () => {
  // Setup test database
  testDb = new TestDatabase();
  await testDb.initialize();
  
  // Start test server
  testServer = new TestServer();
  await testServer.start();
  
  // Set environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = testDb.getConnectionString();
  process.env.PORT = '0'; // Random available port
});

afterAll(async () => {
  // Cleanup
  await testServer.stop();
  await testDb.cleanup();
});

beforeEach(async () => {
  // Clean data between tests
  await testDb.truncateAll();
  await testDb.seedBasicData();
});
```

## API Integration Tests

### REST API Testing
```typescript
// tests/integration/api/promptCards.integration.test.ts
import request from 'supertest';
import { app } from '../../../src/app';
import { TestDatabase } from '../testDatabase';

describe('Prompt Cards API Integration', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.initialize();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
  });

  describe('POST /api/prompt-cards', () => {
    it('should create and retrieve prompt card', async () => {
      // Arrange
      const cardData = {
        title: 'Integration Test Card',
        description: 'Test card for integration testing',
        prompt: 'Write a test for {{feature}}',
        category: 'testing',
        tags: ['test', 'integration']
      };

      // Act - Create card
      const createResponse = await request(app)
        .post('/api/prompt-cards')
        .send(cardData)
        .expect(201);

      // Assert - Verify creation
      expect(createResponse.body).toMatchObject(cardData);
      expect(createResponse.body.id).toBeDefined();
      expect(createResponse.body.createdAt).toBeDefined();

      // Act - Retrieve card
      const getResponse = await request(app)
        .get(`/api/prompt-cards/${createResponse.body.id}`)
        .expect(200);

      // Assert - Verify retrieval
      expect(getResponse.body).toMatchObject(cardData);
      expect(getResponse.body.id).toBe(createResponse.body.id);
    });

    it('should handle card with test cases', async () => {
      // Arrange
      const cardData = {
        title: 'Card with Test Cases',
        description: 'Card including test cases',
        prompt: 'Generate {{type}} for {{subject}}',
        category: 'generation'
      };

      // Act - Create card
      const cardResponse = await request(app)
        .post('/api/prompt-cards')
        .send(cardData)
        .expect(201);

      const cardId = cardResponse.body.id;

      // Create test cases for the card
      const testCaseData = {
        promptCardId: cardId,
        input: { type: 'documentation', subject: 'API endpoint' },
        expectedOutput: 'Generated documentation for API endpoint',
        description: 'Test documentation generation'
      };

      const testCaseResponse = await request(app)
        .post('/api/test-cases')
        .send(testCaseData)
        .expect(201);

      // Assert - Verify relationship
      expect(testCaseResponse.body.promptCardId).toBe(cardId);

      // Retrieve card with test cases
      const fullCardResponse = await request(app)
        .get(`/api/prompt-cards/${cardId}?include=testCases`)
        .expect(200);

      expect(fullCardResponse.body.testCases).toHaveLength(1);
      expect(fullCardResponse.body.testCases[0]).toMatchObject(testCaseData);
    });
  });

  describe('GET /api/prompt-cards', () => {
    beforeEach(async () => {
      // Seed test data
      await testDb.seedPromptCards([
        {
          title: 'Card 1',
          category: 'development',
          tags: ['coding', 'typescript']
        },
        {
          title: 'Card 2',
          category: 'testing',
          tags: ['jest', 'testing']
        },
        {
          title: 'Card 3',
          category: 'development',
          tags: ['documentation', 'api']
        }
      ]);
    });

    it('should return paginated results', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards?page=1&limit=2')
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2
      });
    });

    it('should filter by category', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards?category=development')
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach(card => {
        expect(card.category).toBe('development');
      });
    });

    it('should search by title and tags', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards?search=typescript')
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Card 1');
    });
  });
});
```

### WebSocket Integration Testing
```typescript
// tests/integration/websocket/progress.integration.test.ts
import { io, Socket } from 'socket.io-client';
import { TestServer } from '../testServer';

describe('WebSocket Progress Integration', () => {
  let testServer: TestServer;
  let clientSocket: Socket;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
  });

  afterAll(async () => {
    await testServer.stop();
  });

  beforeEach((done) => {
    clientSocket = io(`http://localhost:${testServer.port}`);
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should receive real-time progress updates', (done) => {
    // Arrange
    const taskId = 'test-task-123';
    let progressUpdates: any[] = [];

    // Listen for progress updates
    clientSocket.on('progress', (data) => {
      progressUpdates.push(data);
      
      if (data.progress === 100) {
        // Assert
        expect(progressUpdates).toHaveLength(3);
        expect(progressUpdates[0]).toMatchObject({
          taskId,
          progress: 0,
          status: 'started'
        });
        expect(progressUpdates[2]).toMatchObject({
          taskId,
          progress: 100,
          status: 'completed'
        });
        done();
      }
    });

    // Act - Start a task that sends progress updates
    clientSocket.emit('start-task', { taskId, type: 'test-execution' });
  });

  it('should handle multiple concurrent tasks', (done) => {
    // Arrange
    const task1Id = 'task-1';
    const task2Id = 'task-2';
    let completedTasks = 0;

    const checkCompletion = () => {
      completedTasks++;
      if (completedTasks === 2) {
        done();
      }
    };

    // Listen for task completions
    clientSocket.on('task-completed', (data) => {
      expect([task1Id, task2Id]).toContain(data.taskId);
      checkCompletion();
    });

    // Act - Start multiple tasks
    clientSocket.emit('start-task', { taskId: task1Id, type: 'prompt-test' });
    clientSocket.emit('start-task', { taskId: task2Id, type: 'prompt-test' });
  });
});
```

## Database Integration Tests

### Database Operations Testing
```typescript
// tests/integration/database/promptCard.integration.test.ts
import { PromptCardRepository } from '../../../src/repositories/PromptCardRepository';
import { TestDatabase } from '../testDatabase';

describe('PromptCard Database Integration', () => {
  let testDb: TestDatabase;
  let repository: PromptCardRepository;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.initialize();
    repository = new PromptCardRepository(testDb.getConnection());
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
  });

  describe('CRUD Operations', () => {
    it('should create, read, update, and delete prompt card', async () => {
      // Create
      const cardData = {
        title: 'Test Card',
        description: 'Test Description',
        prompt: 'Test {{variable}}',
        category: 'testing'
      };

      const createdCard = await repository.create(cardData);
      expect(createdCard.id).toBeDefined();
      expect(createdCard.title).toBe(cardData.title);

      // Read
      const foundCard = await repository.findById(createdCard.id);
      expect(foundCard).toMatchObject(cardData);

      // Update
      const updatedData = { title: 'Updated Title' };
      const updatedCard = await repository.update(createdCard.id, updatedData);
      expect(updatedCard.title).toBe('Updated Title');
      expect(updatedCard.description).toBe(cardData.description); // Unchanged

      // Delete
      await repository.delete(createdCard.id);
      const deletedCard = await repository.findById(createdCard.id);
      expect(deletedCard).toBeNull();
    });

    it('should handle complex queries with relationships', async () => {
      // Arrange - Create card with test cases
      const card = await repository.create({
        title: 'Card with Relations',
        description: 'Test relationships',
        prompt: 'Test prompt',
        category: 'testing'
      });

      await testDb.connection.testCases.create({
        data: {
          promptCardId: card.id,
          input: { param: 'value' },
          expectedOutput: 'Expected result',
          description: 'Test case 1'
        }
      });

      // Act
      const cardWithRelations = await repository.findByIdWithRelations(card.id);

      // Assert
      expect(cardWithRelations.testCases).toHaveLength(1);
      expect(cardWithRelations.testCases[0].description).toBe('Test case 1');
    });
  });

  describe('Query Performance', () => {
    beforeEach(async () => {
      // Seed performance test data
      await testDb.seedLargeDataset();
    });

    it('should efficiently query large datasets', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const results = await repository.findMany({
        category: 'development',
        limit: 100,
        offset: 0
      });

      const queryTime = Date.now() - startTime;

      // Assert
      expect(results.length).toBeLessThanOrEqual(100);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations', async () => {
      // Arrange
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => 
        repository.create({
          title: `Concurrent Card ${i}`,
          description: `Card ${i}`,
          prompt: `Prompt ${i}`,
          category: 'testing'
        })
      );

      // Act
      const results = await Promise.all(concurrentOperations);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((card, index) => {
        expect(card.title).toBe(`Concurrent Card ${index}`);
      });
    });
  });
});
```

## Service Integration Tests

### Service Coordination Testing
```typescript
// tests/integration/services/promptExecution.integration.test.ts
import { PromptExecutionService } from '../../../src/services/PromptExecutionService';
import { PromptCardService } from '../../../src/services/PromptCardService';
import { TestCaseService } from '../../../src/services/TestCaseService';
import { MockLLMService } from '../mocks/MockLLMService';

describe('Prompt Execution Service Integration', () => {
  let executionService: PromptExecutionService;
  let cardService: PromptCardService;
  let testCaseService: TestCaseService;
  let mockLLM: MockLLMService;

  beforeAll(async () => {
    mockLLM = new MockLLMService();
    executionService = new PromptExecutionService(mockLLM);
    cardService = new PromptCardService();
    testCaseService = new TestCaseService();
  });

  describe('End-to-End Prompt Execution', () => {
    it('should execute prompt with test case validation', async () => {
      // Arrange
      const card = await cardService.create({
        title: 'Code Generation Prompt',
        description: 'Generates TypeScript functions',
        prompt: 'Generate a TypeScript function named {{functionName}} that {{description}}',
        category: 'development'
      });

      const testCase = await testCaseService.create({
        promptCardId: card.id,
        input: {
          functionName: 'calculateSum',
          description: 'takes two numbers and returns their sum'
        },
        expectedOutput: 'function calculateSum(a: number, b: number): number { return a + b; }',
        description: 'Basic sum function generation'
      });

      mockLLM.setResponse('function calculateSum(a: number, b: number): number { return a + b; }');

      // Act
      const execution = await executionService.executeWithValidation(card.id, testCase.id);

      // Assert
      expect(execution.success).toBe(true);
      expect(execution.output).toContain('calculateSum');
      expect(execution.validationResult.passed).toBe(true);
      expect(execution.metrics.executionTime).toBeDefined();
    });

    it('should handle multiple test cases in parallel', async () => {
      // Arrange
      const card = await cardService.create({
        title: 'Multi-Test Prompt',
        description: 'Prompt for parallel testing',
        prompt: 'Generate {{type}} for {{subject}}',
        category: 'testing'
      });

      const testCases = await Promise.all([
        testCaseService.create({
          promptCardId: card.id,
          input: { type: 'test', subject: 'function' },
          expectedOutput: 'test for function',
          description: 'Test case 1'
        }),
        testCaseService.create({
          promptCardId: card.id,
          input: { type: 'documentation', subject: 'API' },
          expectedOutput: 'documentation for API',
          description: 'Test case 2'
        })
      ]);

      mockLLM.setMultipleResponses([
        'test for function',
        'documentation for API'
      ]);

      // Act
      const executions = await executionService.executeMultipleTestCases(
        card.id,
        testCases.map(tc => tc.id)
      );

      // Assert
      expect(executions).toHaveLength(2);
      expect(executions.every(exec => exec.success)).toBe(true);
      expect(executions[0].validationResult.passed).toBe(true);
      expect(executions[1].validationResult.passed).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle LLM service failures gracefully', async () => {
      // Arrange
      const card = await cardService.create({
        title: 'Error Test Prompt',
        description: 'Test error handling',
        prompt: 'Test prompt',
        category: 'testing'
      });

      mockLLM.setError(new Error('LLM service unavailable'));

      // Act
      const execution = await executionService.execute(card.id, {});

      // Assert
      expect(execution.success).toBe(false);
      expect(execution.error).toBeDefined();
      expect(execution.error.message).toContain('LLM service unavailable');
      expect(execution.retryCount).toBe(3); // Should retry 3 times
    });

    it('should handle timeout scenarios', async () => {
      // Arrange
      const card = await cardService.create({
        title: 'Timeout Test Prompt',
        description: 'Test timeout handling',
        prompt: 'Long running prompt',
        category: 'testing'
      });

      mockLLM.setDelay(10000); // 10 second delay

      // Act
      const startTime = Date.now();
      const execution = await executionService.execute(card.id, {}, { timeout: 5000 });
      const executionTime = Date.now() - startTime;

      // Assert
      expect(execution.success).toBe(false);
      expect(execution.error.message).toContain('timeout');
      expect(executionTime).toBeLessThan(6000); // Should timeout before 6 seconds
    });
  });
});
```

## End-to-End Workflow Tests

### Complete User Workflows
```typescript
// tests/integration/workflows/promptCard.workflow.test.ts
import request from 'supertest';
import { app } from '../../../src/app';
import { TestDatabase } from '../testDatabase';

describe('Prompt Card Workflow Integration', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.initialize();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
  });

  it('should complete full prompt card lifecycle', async () => {
    // Step 1: Create prompt card
    const cardData = {
      title: 'Workflow Test Card',
      description: 'Complete workflow test',
      prompt: 'Generate {{output}} for {{input}}',
      category: 'testing'
    };

    const cardResponse = await request(app)
      .post('/api/prompt-cards')
      .send(cardData)
      .expect(201);

    const cardId = cardResponse.body.id;

    // Step 2: Add test cases
    const testCase1 = await request(app)
      .post('/api/test-cases')
      .send({
        promptCardId: cardId,
        input: { output: 'test', input: 'function' },
        expectedOutput: 'test for function',
        description: 'Test case 1'
      })
      .expect(201);

    const testCase2 = await request(app)
      .post('/api/test-cases')
      .send({
        promptCardId: cardId,
        input: { output: 'docs', input: 'API' },
        expectedOutput: 'docs for API',
        description: 'Test case 2'
      })
      .expect(201);

    // Step 3: Execute test cases
    const execution1 = await request(app)
      .post(`/api/prompt-cards/${cardId}/execute`)
      .send({ testCaseId: testCase1.body.id })
      .expect(200);

    const execution2 = await request(app)
      .post(`/api/prompt-cards/${cardId}/execute`)
      .send({ testCaseId: testCase2.body.id })
      .expect(200);

    // Step 4: Verify execution results
    expect(execution1.body.success).toBe(true);
    expect(execution2.body.success).toBe(true);

    // Step 5: Get execution history
    const historyResponse = await request(app)
      .get(`/api/prompt-cards/${cardId}/executions`)
      .expect(200);

    expect(historyResponse.body.data).toHaveLength(2);

    // Step 6: Generate analytics report
    const analyticsResponse = await request(app)
      .get(`/api/analytics/prompt-cards/${cardId}`)
      .expect(200);

    expect(analyticsResponse.body.totalExecutions).toBe(2);
    expect(analyticsResponse.body.successRate).toBe(100);

    // Step 7: Update prompt card
    const updatedCard = await request(app)
      .put(`/api/prompt-cards/${cardId}`)
      .send({ title: 'Updated Workflow Test Card' })
      .expect(200);

    expect(updatedCard.body.title).toBe('Updated Workflow Test Card');

    // Step 8: Export prompt card
    const exportResponse = await request(app)
      .get(`/api/prompt-cards/${cardId}/export`)
      .expect(200);

    expect(exportResponse.body).toMatchObject({
      card: cardData,
      testCases: expect.arrayContaining([
        expect.objectContaining({ description: 'Test case 1' }),
        expect.objectContaining({ description: 'Test case 2' })
      ]),
      executions: expect.arrayContaining([
        expect.objectContaining({ success: true }),
        expect.objectContaining({ success: true })
      ])
    });
  });

  it('should handle bulk operations workflow', async () => {
    // Step 1: Bulk create prompt cards
    const bulkData = [
      {
        title: 'Bulk Card 1',
        description: 'First bulk card',
        prompt: 'Prompt 1',
        category: 'testing'
      },
      {
        title: 'Bulk Card 2',
        description: 'Second bulk card',
        prompt: 'Prompt 2',
        category: 'testing'
      }
    ];

    const bulkCreateResponse = await request(app)
      .post('/api/prompt-cards/bulk')
      .send({ cards: bulkData })
      .expect(201);

    expect(bulkCreateResponse.body.created).toHaveLength(2);

    // Step 2: Bulk execute all cards
    const cardIds = bulkCreateResponse.body.created.map(card => card.id);
    
    const bulkExecuteResponse = await request(app)
      .post('/api/prompt-cards/bulk-execute')
      .send({ cardIds, input: { param: 'value' } })
      .expect(200);

    expect(bulkExecuteResponse.body.results).toHaveLength(2);
    expect(bulkExecuteResponse.body.results.every(r => r.success)).toBe(true);

    // Step 3: Bulk export
    const bulkExportResponse = await request(app)
      .post('/api/prompt-cards/bulk-export')
      .send({ cardIds })
      .expect(200);

    expect(bulkExportResponse.body.cards).toHaveLength(2);
  });
});
```

## Performance Integration Tests

### Load Testing Integration
```typescript
// tests/integration/performance/load.integration.test.ts
import request from 'supertest';
import { app } from '../../../src/app';
import { TestDatabase } from '../testDatabase';

describe('Load Testing Integration', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.initialize();
    await testDb.seedLargeDataset();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it('should handle concurrent API requests', async () => {
    // Arrange
    const concurrentRequests = 50;
    const requests = Array.from({ length: concurrentRequests }, (_, i) =>
      request(app)
        .get('/api/prompt-cards')
        .query({ page: Math.floor(i / 10) + 1, limit: 10 })
    );

    // Act
    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const endTime = Date.now();

    // Assert
    expect(responses.every(res => res.status === 200)).toBe(true);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    // Verify response consistency
    responses.forEach(response => {
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });
  });

  it('should maintain performance under sustained load', async () => {
    // Arrange
    const duration = 10000; // 10 seconds
    const intervalMs = 100; // Request every 100ms
    const startTime = Date.now();
    const responseTimes: number[] = [];

    // Act
    while (Date.now() - startTime < duration) {
      const requestStart = Date.now();
      const response = await request(app)
        .get('/api/prompt-cards')
        .query({ page: 1, limit: 10 });
      
      const requestTime = Date.now() - requestStart;
      responseTimes.push(requestTime);
      
      expect(response.status).toBe(200);
      
      // Wait for next interval
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    // Assert
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    expect(averageResponseTime).toBeLessThan(500); // Average under 500ms
    expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds
    expect(responseTimes.length).toBeGreaterThan(50); // At least 50 requests
  });
});
```

## Running Integration Tests

### Commands
```bash
# Run all integration tests
npm run test:integration

# Run specific integration test suite
npm run test:integration -- --testNamePattern="API Integration"

# Run with coverage
npm run test:integration:coverage

# Run in watch mode (development)
npm run test:integration:watch

# Run against different environments
NODE_ENV=staging npm run test:integration
```

### Docker Integration Testing
```bash
# Run integration tests in Docker
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Run with specific services
docker-compose -f docker-compose.test.yml run --rm integration-tests

# Clean up test containers
docker-compose -f docker-compose.test.yml down -v
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration:ci
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/testdb
          NODE_ENV: test
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: integration-test-results
          path: |
            coverage/integration/
            test-results/
```

## Best Practices

### 1. Test Isolation
- Use fresh database state for each test
- Clean up resources after tests
- Avoid dependencies between tests

### 2. Realistic Test Data
- Use representative data volumes
- Test with realistic user scenarios
- Include edge cases and error conditions

### 3. Performance Monitoring
- Track test execution times
- Monitor resource usage
- Set performance assertions

### 4. Environment Management
- Use dedicated test environments
- Mock external dependencies appropriately
- Maintain environment parity

## Next Steps

1. Review [performance testing guide](./performance-testing.md) for load testing details
2. Check [unit testing guide](./unit-testing.md) for foundational testing
3. See [deployment guide](../deployment/ghcr-deployment.md) for production testing strategies