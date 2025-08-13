import request from 'supertest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import assert from 'assert';
import { TestTimeouts, HookTimeouts } from '../jest.timeouts';

const execAsync = promisify(exec);

interface DockerService {
  name: string;
  container: string;
  port: number;
  healthEndpoint: string;
  expectedResponse?: any;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  networkLatency: number;
  responseTime: number;
  throughput: number;
}

describe('Docker Integration Tests - Complete System Verification', () => {
  // Skip Docker integration tests in CI environment
  const describeMethod = process.env.CI === 'true' ? describe.skip : describe;
  
  // Set timeout for entire test suite
  jest.setTimeout(TestTimeouts.DOCKER);
  const services: DockerService[] = [
    {
      name: 'frontend',
      container: 'prompt-frontend',
      port: 3000,
      healthEndpoint: '/api/health'
    },
    {
      name: 'backend',
      container: 'prompt-backend',
      port: 3001,
      healthEndpoint: '/api/health/comprehensive'
    },
    {
      name: 'ollama',
      container: 'prompt-ollama',
      port: 11434,
      healthEndpoint: '/api/version'
    },
    {
      name: 'redis',
      container: 'prompt-redis',
      port: 6379,
      healthEndpoint: '/ping'
    },
    {
      name: 'postgres',
      container: 'prompt-postgres',
      port: 5432,
      healthEndpoint: ''
    }
  ];

  let baselineMetrics: SystemMetrics;
  const testData = {
    cardId: 'docker-integration-test-card',
    testExecutionId: '',
    analyticsSessionId: ''
  };

  beforeAll(async () => {
    
    console.log('🐳 Starting Docker Integration Test Suite');
    console.log('📊 Establishing baseline performance metrics...');
    
    // Establish baseline metrics
    baselineMetrics = await captureSystemMetrics();
    
    console.log('✅ Baseline metrics captured:', baselineMetrics);
  });

  afterAll(async () => {
    
    console.log('🧹 Cleaning up Docker integration test resources...');
    await cleanupTestResources();
  });

  describe('🏥 Service Health and Connectivity', () => {
    it('should verify all Docker services are running and healthy', async () => {
      const healthResults = [];
      
      for (const service of services) {
        const isHealthy = await checkServiceHealth(service);
        healthResults.push({ service: service.name, healthy: isHealthy });
        
        expect(isHealthy).toBe(true); 
        // `Service ${service.name} is not healthy`;
      }
      
      console.log('✅ All services are healthy:', healthResults);
    });

    it('should verify inter-service network connectivity', async () => {
      // Test frontend -> backend connectivity
      const frontendToBackend = await testNetworkConnectivity(
        'prompt-frontend', 
        'prompt-backend:3001'
      );
      expect(frontendToBackend).toBe(true);

      // Test backend -> ollama connectivity
      const backendToOllama = await testNetworkConnectivity(
        'prompt-backend', 
        'prompt-ollama:11434'
      );
      expect(backendToOllama).toBe(true);

      // Test backend -> redis connectivity
      const backendToRedis = await testNetworkConnectivity(
        'prompt-backend', 
        'prompt-redis:6379'
      );
      expect(backendToRedis).toBe(true);

      // Test backend -> postgres connectivity
      const backendToPostgres = await testNetworkConnectivity(
        'prompt-backend', 
        'prompt-postgres:5432'
      );
      expect(backendToPostgres).toBe(true);

      console.log('✅ All inter-service network connections verified');
    });

    it('should verify service startup order and dependencies', async () => {
      const startupOrder = await getServiceStartupOrder();
      
      // Verify postgres started before backend
      expect(startupOrder.postgres).toBeLessThan(startupOrder.backend);
      
      // Verify redis started before backend
      expect(startupOrder.redis).toBeLessThan(startupOrder.backend);
      
      // Verify ollama started before backend
      expect(startupOrder.ollama).toBeLessThan(startupOrder.backend);
      
      // Verify backend started before frontend
      expect(startupOrder.backend).toBeLessThan(startupOrder.frontend);
      
      console.log('✅ Service startup order verified:', startupOrder);
    });
  });

  describe('🔄 End-to-End Data Flow', () => {
    it('should complete full prompt card creation and testing workflow', async () => {
      // 1. Create a prompt card via API
      const createResponse = await request(`http://localhost:3001`)
        .post('/api/prompt-cards')
        .send({
          name: 'Docker Integration Test Card',
          description: 'Test card for Docker integration testing',
          prompts: [
            {
              role: 'user',
              content: 'What is 2 + 2?'
            }
          ],
          model: 'llama2:7b',
          parameters: {
            temperature: 0.1,
            maxTokens: 100
          }
        })
        .expect(201);

      testData.cardId = createResponse.body.data.id;
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data).toHaveProperty('id');

      // 2. Execute tests on the prompt card
      const testResponse = await request(`http://localhost:3001`)
        .post('/api/test-execution')
        .send({
          cardId: testData.cardId,
          testCases: [
            {
              id: 'math-test-1',
              input: 'What is 2 + 2?',
              expectedOutput: '4'
            },
            {
              id: 'math-test-2', 
              input: 'What is 5 + 3?',
              expectedOutput: '8'
            }
          ],
          model: 'llama2:7b'
        })
        .expect(200);

      testData.testExecutionId = testResponse.body.data.executionId;
      expect(testResponse.body.success).toBe(true);
      
      // 3. Wait for test completion and verify results
      await waitForTestCompletion(testData.testExecutionId);
      
      const resultsResponse = await request(`http://localhost:3001`)
        .get(`/api/test-execution/${testData.testExecutionId}/results`)
        .expect(200);

      expect(resultsResponse.body.success).toBe(true);
      expect(resultsResponse.body.data).toHaveProperty('testResults');
      expect(Array.isArray(resultsResponse.body.data.testResults)).toBe(true);

      console.log('✅ Complete workflow verified successfully');
    });

    it('should verify real-time WebSocket communication', async () => {
      const WebSocket = require('ws');
      const ws = new WebSocket('ws://localhost:3001');
      
      let connectionEstablished = false;
      let progressUpdatesReceived = 0;

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket test timed out'));
        }, 30000);

        ws.on('open', () => {
          connectionEstablished = true;
          
          // Subscribe to test execution updates
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'test-execution',
            executionId: testData.testExecutionId
          }));
        });

        ws.on('message', (data: string) => {
          const message = JSON.parse(data);
          
          if (message.type === 'progress' || message.type === 'update') {
            progressUpdatesReceived++;
          }
          
          if (message.type === 'completed' || progressUpdatesReceived >= 2) {
            clearTimeout(timeout);
            expect(connectionEstablished).toBe(true);
            expect(progressUpdatesReceived).toBeGreaterThan(0);
            ws.close();
            resolve(undefined);
          }
        });

        ws.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    it('should verify analytics data collection and aggregation', async () => {
      // Trigger analytics collection
      const analyticsResponse = await request(`http://localhost:3001`)
        .post('/api/analytics/collect')
        .send({
          event: 'test_execution_completed',
          cardId: testData.cardId,
          executionId: testData.testExecutionId,
          metadata: {
            testType: 'docker-integration',
            environment: 'container'
          }
        })
        .expect(200);

      testData.analyticsSessionId = analyticsResponse.body.data.sessionId;
      
      // Retrieve analytics data
      const metricsResponse = await request(`http://localhost:3001`)
        .get('/api/analytics/metrics')
        .query({ 
          sessionId: testData.analyticsSessionId,
          timeRange: '1h'
        })
        .expect(200);

      expect(metricsResponse.body.success).toBe(true);
      expect(metricsResponse.body.data).toHaveProperty('executionMetrics');
      expect(metricsResponse.body.data).toHaveProperty('performanceMetrics');

      console.log('✅ Analytics data collection verified');
    });
  });

  describe('⚡ Performance and Load Testing', () => {
    it('should handle concurrent requests across services', async () => {
      const concurrentRequests = 20;
      const requests = [];
      
      // Create concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(`http://localhost:3001`)
            .get('/api/health/comprehensive')
            .timeout(10000)
        );
        
        requests.push(
          request(`http://localhost:3000`)
            .get('/api/health')
            .timeout(10000)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;
      
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      const successRate = (successful / responses.length) * 100;
      
      expect(successRate).toBeGreaterThan(90); // 90% success rate
      expect(duration).toBeLessThan(15000); // Under 15 seconds
      
      console.log(`✅ Concurrent load test: ${successRate}% success rate in ${duration}ms`);
    });

    it('should maintain performance under sustained load', async () => {
      const loadTestDuration = 30000; // 30 seconds
      const requestInterval = 500; // 500ms between requests
      
      const metricsStart = await captureSystemMetrics();
      const startTime = Date.now();
      let requestCount = 0;
      let successCount = 0;
      
      const loadTestPromise = new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          if (Date.now() - startTime >= loadTestDuration) {
            clearInterval(interval);
            resolve();
            return;
          }
          
          requestCount++;
          try {
            const response = await request(`http://localhost:3001`)
              .get('/api/health')
              .timeout(5000);
            
            if (response.status === 200) {
              successCount++;
            }
          } catch (error) {
            // Request failed
          }
        }, requestInterval);
      });
      
      await loadTestPromise;
      const metricsEnd = await captureSystemMetrics();
      
      const successRate = (successCount / requestCount) * 100;
      const performanceDegradation = calculatePerformanceDegradation(
        metricsStart, 
        metricsEnd
      );
      
      expect(successRate).toBeGreaterThan(85); // 85% success rate under load
      expect(performanceDegradation).toBeLessThan(30); // Less than 30% degradation
      
      console.log(`✅ Sustained load test: ${successRate}% success rate, ${performanceDegradation}% performance degradation`);
    });

    it('should verify container resource utilization', async () => {
      const resourceMetrics = await getContainerResourceMetrics();
      
      // Verify no container is using excessive resources
      for (const [containerName, metrics] of Object.entries(resourceMetrics)) {
        expect(metrics.cpuPercent).toBeLessThan(80); // Less than 80% CPU
        expect(metrics.memoryPercent).toBeLessThan(85); // Less than 85% memory
        
        console.log(`📊 ${containerName}: CPU ${metrics.cpuPercent}%, Memory ${metrics.memoryPercent}%`);
      }
      
      console.log('✅ Container resource utilization within acceptable limits');
    });
  });

  describe('🛡️ Security and Error Handling', () => {
    it('should handle service failures gracefully', async () => {
      // Skip Redis failure test in CI environment
      if (process.env.CI === 'true') {
        console.log('⏭️ Skipping Redis failure test in CI environment');
        return;
      }
      
      // Temporarily stop Redis to test error handling
      console.log('🔄 Testing Redis failure scenario...');
      await execAsync('docker stop prompt-redis');
      
      try {
        // Backend should still respond but with degraded functionality
        const response = await request(`http://localhost:3001`)
          .get('/api/health')
          .expect(200);
        
        expect(response.body).toHaveProperty('status');
        // Health check might report degraded status
        
        // Test caching functionality (should gracefully degrade)
        const cacheTestResponse = await request(`http://localhost:3001`)
          .post('/api/test-execution')
          .send({
            cardId: testData.cardId,
            testCases: [
              {
                id: 'cache-test',
                input: 'Test without Redis',
                expectedOutput: 'Should work without cache'
              }
            ],
            model: 'llama2:7b'
          });
        
        // Should still work but might be slower
        expect([200, 503]).toContain(cacheTestResponse.status);
        
      } finally {
        // Restart Redis
        await execAsync('docker start prompt-redis');
        
        // Wait for Redis to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verify Redis is back online
        const redisHealth = await checkServiceHealth(services.find(s => s.name === 'redis')!);
        expect(redisHealth).toBe(true);
      }
      
      console.log('✅ Service failure handling verified');
    });

    it('should enforce proper security headers and CORS', async () => {
      const response = await request(`http://localhost:3001`)
        .get('/api/health')
        .expect(200);
      
      // Check security headers
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      
      // Test CORS
      const corsResponse = await request(`http://localhost:3001`)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      
      expect(corsResponse.headers['access-control-allow-origin']).toBeDefined();
      
      console.log('✅ Security headers and CORS verified');
    });

    it('should handle database connection issues', async () => {
      // Test database connection resilience
      const dbTestResponse = await request(`http://localhost:3001`)
        .get('/api/prompt-cards')
        .expect(200);
      
      expect(dbTestResponse.body.success).toBe(true);
      
      // Verify database is properly connected
      const dbHealthResponse = await request(`http://localhost:3001`)
        .get('/api/health/database')
        .expect(200);
      
      expect(dbHealthResponse.body.database).toHaveProperty('connected');
      expect(dbHealthResponse.body.database.connected).toBe(true);
      
      console.log('✅ Database connection handling verified');
    });
  });

  describe('📊 Monitoring and Observability', () => {
    it('should provide comprehensive health monitoring', async () => {
      const healthResponse = await request(`http://localhost:3001`)
        .get('/api/health/comprehensive')
        .expect(200);
      
      expect(healthResponse.body).toHaveProperty('status');
      expect(healthResponse.body).toHaveProperty('timestamp');
      expect(healthResponse.body).toHaveProperty('services');
      expect(healthResponse.body).toHaveProperty('database');
      expect(healthResponse.body).toHaveProperty('cache');
      expect(healthResponse.body).toHaveProperty('llm');
      expect(healthResponse.body).toHaveProperty('system');
      
      // Verify all service statuses
      expect(healthResponse.body.services.backend).toBe('healthy');
      expect(healthResponse.body.database.connected).toBe(true);
      expect(healthResponse.body.cache.connected).toBe(true);
      expect(healthResponse.body.llm.available).toBe(true);
      
      console.log('✅ Comprehensive health monitoring verified');
    });

    it('should collect and export metrics for monitoring', async () => {
      const metricsResponse = await request(`http://localhost:3001`)
        .get('/api/metrics')
        .expect(200);
      
      // Should return Prometheus-format metrics
      expect(metricsResponse.text).toContain('# HELP');
      expect(metricsResponse.text).toContain('# TYPE');
      expect(metricsResponse.text).toContain('http_requests_total');
      expect(metricsResponse.text).toContain('process_cpu_user_seconds_total');
      
      console.log('✅ Metrics collection and export verified');
    });
  });

  // Helper Functions
  async function checkServiceHealth(service: DockerService): Promise<boolean> {
    try {
      if (service.name === 'redis') {
        // In CI environment, use direct Redis connection instead of docker exec
        if (process.env.CI === 'true') {
          const response = await request('http://localhost:6379').get('/').timeout(2000);
          return true; // If no error, Redis is available
        } else {
          const { stdout } = await execAsync(`docker exec ${service.container} redis-cli ping`);
          return stdout.trim() === 'PONG';
        }
      }
      
      if (service.name === 'postgres') {
        const { stdout } = await execAsync(`docker exec ${service.container} pg_isready -U promptcard -d promptcard_dev`);
        return stdout.includes('accepting connections');
      }
      
      const response = await request(`http://localhost:${service.port}`)
        .get(service.healthEndpoint)
        .timeout(10000);
      
      return response.status === 200;
    } catch (error) {
      console.error(`Health check failed for ${service.name}:`, error.message);
      return false;
    }
  }

  async function testNetworkConnectivity(fromContainer: string, toAddress: string): Promise<boolean> {
    try {
      const command = `docker exec ${fromContainer} sh -c "nc -z ${toAddress.split(':')[0]} ${toAddress.split(':')[1]}"`;
      await execAsync(command);
      return true;
    } catch (error) {
      console.error(`Network connectivity test failed from ${fromContainer} to ${toAddress}:`, error.message);
      return false;
    }
  }

  async function getServiceStartupOrder(): Promise<Record<string, number>> {
    const order: Record<string, number> = {};
    
    for (const service of services) {
      try {
        const { stdout } = await execAsync(`docker inspect ${service.container} --format='{{.State.StartedAt}}'`);
        order[service.name] = new Date(stdout.trim()).getTime();
      } catch (error) {
        order[service.name] = 0;
      }
    }
    
    return order;
  }

  async function captureSystemMetrics(): Promise<SystemMetrics> {
    try {
      // CPU usage
      const cpuInfo = await execAsync("docker stats --no-stream --format 'table {{.CPUPerc}}' | tail -n +2 | head -1");
      const cpu = parseFloat(cpuInfo.stdout.replace('%', '')) || 0;
      
      // Memory usage
      const memInfo = await execAsync("docker stats --no-stream --format 'table {{.MemPerc}}' | tail -n +2 | head -1");
      const memory = parseFloat(memInfo.stdout.replace('%', '')) || 0;
      
      // Network latency (ping to backend)
      const latencyStart = Date.now();
      await request('http://localhost:3001').get('/api/health').timeout(5000);
      const networkLatency = Date.now() - latencyStart;
      
      // Response time for a standard request
      const responseStart = Date.now();
      await request('http://localhost:3001').get('/api/prompt-cards').timeout(10000);
      const responseTime = Date.now() - responseStart;
      
      // Throughput (requests per second) - simple estimation
      const throughputStart = Date.now();
      const requests = Array(10).fill(null).map(() => 
        request('http://localhost:3001').get('/api/health').timeout(5000)
      );
      await Promise.all(requests);
      const throughputDuration = Date.now() - throughputStart;
      const throughput = (10 / throughputDuration) * 1000; // requests per second
      
      return {
        cpu,
        memory,
        networkLatency,
        responseTime,
        throughput
      };
    } catch (error) {
      console.warn('Failed to capture complete system metrics:', error.message);
      return {
        cpu: 0,
        memory: 0,
        networkLatency: 1000,
        responseTime: 1000,
        throughput: 0
      };
    }
  }

  async function waitForTestCompletion(executionId: string, timeout: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await request(`http://localhost:3001`)
          .get(`/api/test-execution/${executionId}/status`)
          .timeout(5000);
        
        if (response.body.data.status === 'completed' || response.body.data.status === 'failed') {
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error(`Test execution ${executionId} did not complete within ${timeout}ms`);
  }

  function calculatePerformanceDegradation(start: SystemMetrics, end: SystemMetrics): number {
    const responseTimeDegradation = ((end.responseTime - start.responseTime) / start.responseTime) * 100;
    const throughputDegradation = ((start.throughput - end.throughput) / start.throughput) * 100;
    
    return Math.max(responseTimeDegradation, throughputDegradation);
  }

  async function getContainerResourceMetrics(): Promise<Record<string, { cpuPercent: number; memoryPercent: number }>> {
    const metrics: Record<string, { cpuPercent: number; memoryPercent: number }> = {};
    
    try {
      const { stdout } = await execAsync("docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}'");
      const lines = stdout.split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        if (line.trim()) {
          const [name, cpu, memory] = line.split('\t');
          metrics[name] = {
            cpuPercent: parseFloat(cpu.replace('%', '')),
            memoryPercent: parseFloat(memory.replace('%', ''))
          };
        }
      }
    } catch (error) {
      console.warn('Failed to get container resource metrics:', error.message);
    }
    
    return metrics;
  }

  async function cleanupTestResources(): Promise<void> {
    try {
      // Clean up test data
      if (testData.cardId && testData.cardId !== 'docker-integration-test-card') {
        await request(`http://localhost:3001`)
          .delete(`/api/prompt-cards/${testData.cardId}`)
          .timeout(5000);
      }
      
      // Clean up test executions
      if (testData.testExecutionId) {
        await request(`http://localhost:3001`)
          .delete(`/api/test-execution/${testData.testExecutionId}`)
          .timeout(5000);
      }
      
      console.log('✅ Test resources cleaned up');
    } catch (error) {
      console.warn('Failed to clean up some test resources:', error.message);
    }
  }
});