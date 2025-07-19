import request from 'supertest';
import assert from 'assert';
import app from '../../server';
import { TestQueueManager } from '../../services/testing/TestQueueManager';
import { ResourceManager } from '../../services/testing/ResourceManager';
import { Semaphore } from '../../services/testing/Semaphore';

describe('Parallel Testing Infrastructure Integration Tests', () => {
  let testQueueManager: TestQueueManager;
  let resourceManager: ResourceManager;
  let semaphore: Semaphore;
  const testCardId = 'test-parallel-card-123';

  beforeEach(async () => {
    testQueueManager = new TestQueueManager();
    resourceManager = new ResourceManager();
    semaphore = new Semaphore(3); // Allow 3 concurrent tests
    
    // Initialize test infrastructure
    await testQueueManager.initialize();
    await resourceManager.initialize();
  });

  afterEach(async () => {
    await testQueueManager.cleanup();
    await resourceManager.cleanup();
  });

  describe('Queue Management Integration', () => {
    it('should handle multiple test submissions and execute them in parallel', async () => {
      const testPromises = [];
      
      // Submit 10 test executions
      for (let i = 0; i < 10; i++) {
        testPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: [
                {
                  id: `test-${i}-1`,
                  input: `Test input ${i}-1`,
                  expectedOutput: `Expected output ${i}-1`
                },
                {
                  id: `test-${i}-2`,
                  input: `Test input ${i}-2`,
                  expectedOutput: `Expected output ${i}-2`
                }
              ],
              model: 'gpt-3.5-turbo',
              parallelism: 2
            })
        );
      }

      const responses = await Promise.all(testPromises);
      
      // All submissions should be accepted
      for (const response of responses) {
        expect(response.status).to.equal(200);
        assert(response.body.success === true);
        expect(response.body.data).to.have.property('executionId');
        expect(response.body.data).to.have.property('status');
        expect(response.body.data.status).to.be.oneOf(['queued', 'running']);
      }
    });

    it('should respect resource limits and queue appropriately', async () => {
      // Set resource limits
      await resourceManager.setLimits({
        maxConcurrentTests: 3,
        maxMemoryUsage: 1024, // 1GB
        maxCpuUsage: 80
      });

      const testPromises = [];
      
      // Submit more tests than the limit
      for (let i = 0; i < 8; i++) {
        testPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: [
                {
                  id: `limit-test-${i}`,
                  input: `Test input ${i}`,
                  expectedOutput: `Expected output ${i}`
                }
              ],
              model: 'gpt-3.5-turbo',
              priority: i < 3 ? 'high' : 'normal'
            })
        );
      }

      const responses = await Promise.all(testPromises);
      
      // Check queue status
      const queueStatusResponse = await request(app)
        .get('/api/test-execution/queue/status')
        .expect(200);

      assert(queueStatusResponse.body.success === true);
      expect(queueStatusResponse.body.data).to.have.property('running');
      expect(queueStatusResponse.body.data).to.have.property('queued');
      expect(queueStatusResponse.body.data.running).to.be.at.most(3);
    });

    it('should handle queue priority correctly', async () => {
      // Submit tests with different priorities
      const lowPriorityResponse = await request(app)
        .post('/api/test-execution/parallel')
        .send({
          cardId: testCardId,
          testCases: [{ id: 'low-priority', input: 'Low priority test', expectedOutput: 'output' }],
          priority: 'low'
        })
        .expect(200);

      const highPriorityResponse = await request(app)
        .post('/api/test-execution/parallel')
        .send({
          cardId: testCardId,
          testCases: [{ id: 'high-priority', input: 'High priority test', expectedOutput: 'output' }],
          priority: 'high'
        })
        .expect(200);

      const criticalPriorityResponse = await request(app)
        .post('/api/test-execution/parallel')
        .send({
          cardId: testCardId,
          testCases: [{ id: 'critical-priority', input: 'Critical priority test', expectedOutput: 'output' }],
          priority: 'critical'
        })
        .expect(200);

      // Check queue order
      const queueResponse = await request(app)
        .get('/api/test-execution/queue/list')
        .expect(200);

      assert(queueResponse.body.success === true);
      expect(queueResponse.body.data).to.be.an('array');
      
      // Critical should be first, then high, then low
      const priorities = queueResponse.body.data.map(item => item.priority);
      expect(priorities[0]).to.equal('critical');
    });
  });

  describe('Resource Management Integration', () => {
    it('should monitor and manage system resources during parallel execution', async () => {
      // Start resource monitoring
      const monitoringResponse = await request(app)
        .post('/api/test-execution/monitoring/start')
        .send({
          interval: 1000, // 1 second intervals
          metrics: ['cpu', 'memory', 'activeTests', 'queueLength']
        })
        .expect(200);

      // Submit resource-intensive tests
      const heavyTestPromises = [];
      for (let i = 0; i < 5; i++) {
        heavyTestPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: Array.from({ length: 20 }, (_, j) => ({
                id: `heavy-${i}-${j}`,
                input: `Heavy test ${i}-${j}`,
                expectedOutput: `Expected ${i}-${j}`
              })),
              model: 'gpt-4',
              parallelism: 5
            })
        );
      }

      await Promise.all(heavyTestPromises);

      // Wait a bit for monitoring data
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get resource usage data
      const resourceResponse = await request(app)
        .get('/api/test-execution/resources/usage')
        .expect(200);

      assert(resourceResponse.body.success === true);
      expect(resourceResponse.body.data).to.have.property('cpu');
      expect(resourceResponse.body.data).to.have.property('memory');
      expect(resourceResponse.body.data).to.have.property('activeTests');
      expect(resourceResponse.body.data).to.have.property('queueLength');
    });

    it('should handle resource exhaustion gracefully', async () => {
      // Set very low resource limits
      await resourceManager.setLimits({
        maxConcurrentTests: 1,
        maxMemoryUsage: 100, // 100MB
        maxCpuUsage: 50
      });

      // Submit many tests
      const testPromises = [];
      for (let i = 0; i < 10; i++) {
        testPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: [
                {
                  id: `resource-test-${i}`,
                  input: `Resource test ${i}`,
                  expectedOutput: `Expected ${i}`
                }
              ],
              model: 'gpt-3.5-turbo'
            })
        );
      }

      const responses = await Promise.all(testPromises);
      
      // Some should be queued due to resource limits
      let queuedCount = 0;
      let runningCount = 0;
      
      for (const response of responses) {
        if (response.body.data.status === 'queued') queuedCount++;
        if (response.body.data.status === 'running') runningCount++;
      }

      expect(queuedCount).to.be.greaterThan(0);
      expect(runningCount).to.be.at.most(1);
    });
  });

  describe('Semaphore and Concurrency Control', () => {
    it('should control concurrent execution using semaphores', async () => {
      const semaphoreResponse = await request(app)
        .post('/api/test-execution/semaphore/create')
        .send({
          name: 'test-semaphore',
          permits: 3
        })
        .expect(200);

      const semaphoreId = semaphoreResponse.body.data.id;

      // Submit 10 tests that should use the semaphore
      const testPromises = [];
      for (let i = 0; i < 10; i++) {
        testPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: [
                {
                  id: `semaphore-test-${i}`,
                  input: `Semaphore test ${i}`,
                  expectedOutput: `Expected ${i}`
                }
              ],
              model: 'gpt-3.5-turbo',
              semaphoreId: semaphoreId
            })
        );
      }

      const responses = await Promise.all(testPromises);
      
      // Check semaphore status
      const statusResponse = await request(app)
        .get(`/api/test-execution/semaphore/${semaphoreId}/status`)
        .expect(200);

      assert(statusResponse.body.success === true);
      expect(statusResponse.body.data).to.have.property('availablePermits');
      expect(statusResponse.body.data).to.have.property('queuedRequests');
      expect(statusResponse.body.data.availablePermits).to.be.at.most(3);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle test execution failures gracefully', async () => {
      const response = await request(app)
        .post('/api/test-execution/parallel')
        .send({
          cardId: testCardId,
          testCases: [
            {
              id: 'failing-test',
              input: 'This test will fail',
              expectedOutput: 'This should cause an error'
            }
          ],
          model: 'invalid-model', // This should cause an error
          parallelism: 1
        })
        .expect(200);

      const executionId = response.body.data.executionId;

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check execution status
      const statusResponse = await request(app)
        .get(`/api/test-execution/${executionId}/status`)
        .expect(200);

      assert(statusResponse.body.success === true);
      expect(statusResponse.body.data.status).to.be.oneOf(['failed', 'completed']);
      
      if (statusResponse.body.data.status === 'failed') {
        expect(statusResponse.body.data).to.have.property('error');
      }
    });

    it('should handle queue overflow gracefully', async () => {
      // Set a small queue limit
      await testQueueManager.setQueueLimit(5);

      const testPromises = [];
      
      // Submit more tests than the queue can handle
      for (let i = 0; i < 10; i++) {
        testPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: [
                {
                  id: `overflow-test-${i}`,
                  input: `Overflow test ${i}`,
                  expectedOutput: `Expected ${i}`
                }
              ],
              model: 'gpt-3.5-turbo'
            })
        );
      }

      const responses = await Promise.all(testPromises);
      
      // Some should be rejected due to queue overflow
      let acceptedCount = 0;
      let rejectedCount = 0;
      
      for (const response of responses) {
        if (response.status === 200) {
          acceptedCount++;
        } else if (response.status === 429) { // Too many requests
          rejectedCount++;
        }
      }

      expect(acceptedCount).to.be.at.most(5);
      expect(rejectedCount).to.be.greaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume parallel test execution', async () => {
      const startTime = Date.now();
      
      // Submit a large number of tests
      const testPromises = [];
      for (let i = 0; i < 50; i++) {
        testPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: [
                {
                  id: `volume-test-${i}`,
                  input: `Volume test ${i}`,
                  expectedOutput: `Expected ${i}`
                }
              ],
              model: 'gpt-3.5-turbo',
              parallelism: 3
            })
        );
      }

      const responses = await Promise.all(testPromises);
      const submissionTime = Date.now() - startTime;

      // All submissions should complete within reasonable time
      expect(submissionTime).to.be.below(10000); // 10 seconds
      
      // Most should be accepted
      const successfulSubmissions = responses.filter(r => r.status === 200).length;
      expect(successfulSubmissions).to.be.above(40); // At least 80% success rate

      // Check system performance
      const performanceResponse = await request(app)
        .get('/api/test-execution/performance/metrics')
        .expect(200);

      assert(performanceResponse.body.success === true);
      expect(performanceResponse.body.data).to.have.property('throughput');
      expect(performanceResponse.body.data).to.have.property('averageWaitTime');
      expect(performanceResponse.body.data).to.have.property('systemLoad');
    });
  });

  describe('Integration with Analytics', () => {
    it('should track parallel execution metrics', async () => {
      // Submit some parallel tests
      const testPromises = [];
      for (let i = 0; i < 5; i++) {
        testPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: [
                {
                  id: `analytics-test-${i}`,
                  input: `Analytics test ${i}`,
                  expectedOutput: `Expected ${i}`
                }
              ],
              model: 'gpt-3.5-turbo'
            })
        );
      }

      await Promise.all(testPromises);

      // Check analytics data
      const analyticsResponse = await request(app)
        .get('/api/analytics/parallel-execution')
        .expect(200);

      assert(analyticsResponse.body.success === true);
      expect(analyticsResponse.body.data).to.have.property('totalParallelTests');
      expect(analyticsResponse.body.data).to.have.property('averageParallelism');
      expect(analyticsResponse.body.data).to.have.property('resourceEfficiency');
      expect(analyticsResponse.body.data).to.have.property('queueMetrics');
    });
  });
});