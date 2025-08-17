/**
 * Load Testing Suite
 * @description Performance and load tests for the prompt card system
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Worker } from 'worker_threads';
import * as path from 'path';

describe('Load Testing Suite', () => {
  beforeAll(async () => {
    console.log('🚀 Starting Load Testing Suite');
    global.performanceMonitor.start();
  });

  afterAll(async () => {
    global.performanceMonitor.end();
    const stats = global.performanceMonitor.getStats();
    console.log('📊 Load Testing Complete:', stats);
  });

  describe('API Endpoint Load Tests', () => {
    it('should handle concurrent prompt card creation', async () => {
      // Arrange
      const concurrentUsers = global.PERFORMANCE_CONFIG.CONCURRENT_USERS;
      const requestsPerUser = 10;
      
      const workers: Promise<any>[] = [];

      // Act
      for (let i = 0; i < concurrentUsers; i++) {
        const workerPromise = new Promise((resolve, reject) => {
          const worker = new Worker(path.join(__dirname, 'workers/api-load-worker.js'), {
            workerData: {
              baseUrl: 'http://localhost:8000',
              endpoint: '/api/prompt-cards',
              method: 'POST',
              requestCount: requestsPerUser,
              payload: {
                title: `Load Test Card ${i}`,
                prompt: 'Test prompt for load testing',
                category: 'LoadTest',
              },
            },
          });

          worker.on('message', (result) => {
            resolve(result);
          });

          worker.on('error', (error) => {
            reject(error);
          });
        });

        workers.push(workerPromise);
      }

      const results = await Promise.all(workers);

      // Assert
      const totalRequests = concurrentUsers * requestsPerUser;
      const successfulRequests = results.reduce((sum, result) => sum + result.successful, 0);
      const averageResponseTime = results.reduce((sum, result) => sum + result.averageResponseTime, 0) / results.length;

      expect(successfulRequests).toBeGreaterThan(totalRequests * 0.95); // 95% success rate
      expect(averageResponseTime).toBeLessThan(global.PERFORMANCE_CONFIG.RESPONSE_TIME_THRESHOLD);

      console.log('📈 Concurrent Creation Results:', {
        totalRequests,
        successfulRequests,
        successRate: `${((successfulRequests / totalRequests) * 100).toFixed(2)}%`,
        averageResponseTime: `${averageResponseTime.toFixed(2)}ms`,
      });
    });

    it('should handle high-frequency read operations', async () => {
      // Arrange
      const duration = 30000; // 30 seconds
      const targetRPS = global.PERFORMANCE_CONFIG.REQUEST_RATE;
      const interval = 1000 / targetRPS;

      let requestCount = 0;
      let successCount = 0;
      const responseTimes: number[] = [];

      // Act
      const startTime = Date.now();
      
      while (Date.now() - startTime < duration) {
        const requestStartTime = Date.now();
        
        try {
          const response = await fetch('http://localhost:8000/api/prompt-cards', {
            headers: {
              'Authorization': 'Bearer test-token',
            },
          });

          if (response.ok) {
            successCount++;
          }

          const responseTime = Date.now() - requestStartTime;
          responseTimes.push(responseTime);
          global.performanceMonitor.recordResponseTime(responseTime);
        } catch (error) {
          // Request failed
        }

        requestCount++;
        
        // Wait for next interval
        await new Promise(resolve => setTimeout(resolve, Math.max(0, interval - (Date.now() - requestStartTime))));
      }

      // Assert
      const actualRPS = requestCount / (duration / 1000);
      const successRate = successCount / requestCount;
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      expect(actualRPS).toBeGreaterThan(targetRPS * 0.9); // Within 90% of target
      expect(successRate).toBeGreaterThan(0.99); // 99% success rate
      expect(p95ResponseTime).toBeLessThan(global.PERFORMANCE_CONFIG.RESPONSE_TIME_THRESHOLD * 2);

      console.log('📈 High-Frequency Read Results:', {
        targetRPS,
        actualRPS: actualRPS.toFixed(2),
        successRate: `${(successRate * 100).toFixed(2)}%`,
        averageResponseTime: `${averageResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${p95ResponseTime}ms`,
      });
    });

    it('should handle LLM generation load', async () => {
      // Arrange
      const concurrentGenerations = 5; // Limited for LLM resource constraints
      const generationsPerUser = 3;

      const workers: Promise<any>[] = [];

      // Act
      for (let i = 0; i < concurrentGenerations; i++) {
        const workerPromise = new Promise((resolve, reject) => {
          const worker = new Worker(path.join(__dirname, 'workers/llm-load-worker.js'), {
            workerData: {
              baseUrl: 'http://localhost:8000',
              endpoint: '/api/llm/generate',
              requestCount: generationsPerUser,
              payload: {
                prompt: 'Generate a brief summary of artificial intelligence',
                model: 'llama2',
                max_tokens: 100,
              },
            },
          });

          worker.on('message', (result) => {
            resolve(result);
          });

          worker.on('error', (error) => {
            reject(error);
          });
        });

        workers.push(workerPromise);
      }

      const results = await Promise.all(workers);

      // Assert
      const totalGenerations = concurrentGenerations * generationsPerUser;
      const successfulGenerations = results.reduce((sum, result) => sum + result.successful, 0);
      const averageGenerationTime = results.reduce((sum, result) => sum + result.averageResponseTime, 0) / results.length;

      expect(successfulGenerations).toBeGreaterThan(totalGenerations * 0.8); // 80% success rate (LLM can be unstable)
      expect(averageGenerationTime).toBeLessThan(30000); // 30 second timeout

      console.log('🧠 LLM Generation Load Results:', {
        totalGenerations,
        successfulGenerations,
        successRate: `${((successfulGenerations / totalGenerations) * 100).toFixed(2)}%`,
        averageGenerationTime: `${(averageGenerationTime / 1000).toFixed(2)}s`,
      });
    });
  });

  describe('Database Performance Tests', () => {
    it('should handle large dataset queries efficiently', async () => {
      // Arrange - Create large dataset
      const recordCount = 10000;
      const batchSize = 100;

      console.log(`📊 Creating ${recordCount} test records...`);

      // Create records in batches
      for (let i = 0; i < recordCount; i += batchSize) {
        const batch = Array(Math.min(batchSize, recordCount - i)).fill(null).map((_, index) => ({
          title: `Performance Test Card ${i + index}`,
          prompt: `Test prompt ${i + index} for performance testing`,
          category: `Category${(i + index) % 10}`,
          tags: [`tag${(i + index) % 20}`, `performance`],
        }));

        await fetch('http://localhost:8000/api/prompt-cards/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
          body: JSON.stringify({ cards: batch }),
        });
      }

      // Act - Test various query patterns
      const queryTests = [
        { name: 'Full scan', query: '' },
        { name: 'Category filter', query: '?category=Category1' },
        { name: 'Tag filter', query: '?tags=performance' },
        { name: 'Text search', query: '?search=Test' },
        { name: 'Pagination', query: '?page=50&limit=20' },
        { name: 'Sorting', query: '?sort=createdAt&order=desc' },
      ];

      const queryResults = [];

      for (const test of queryTests) {
        const startTime = Date.now();
        
        const response = await fetch(`http://localhost:8000/api/prompt-cards${test.query}`, {
          headers: {
            'Authorization': 'Bearer test-token',
          },
        });

        const responseTime = Date.now() - startTime;
        const success = response.ok;

        queryResults.push({
          name: test.name,
          responseTime,
          success,
        });

        global.performanceMonitor.recordResponseTime(responseTime);
      }

      // Assert
      queryResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.responseTime).toBeLessThan(5000); // 5 second limit for large queries
      });

      console.log('📊 Database Query Performance:', queryResults.map(r => 
        `${r.name}: ${r.responseTime}ms`
      ));
    });

    it('should maintain performance under write load', async () => {
      // Arrange
      const writeOperations = 1000;
      const concurrentWriters = 10;
      const operationsPerWriter = writeOperations / concurrentWriters;

      // Act
      const writers = Array(concurrentWriters).fill(null).map(async (_, writerIndex) => {
        const results = {
          successful: 0,
          failed: 0,
          totalTime: 0,
        };

        for (let i = 0; i < operationsPerWriter; i++) {
          const startTime = Date.now();

          try {
            const response = await fetch('http://localhost:8000/api/prompt-cards', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token',
              },
              body: JSON.stringify({
                title: `Concurrent Write Test ${writerIndex}-${i}`,
                prompt: 'Test prompt for concurrent write testing',
                category: 'ConcurrentTest',
              }),
            });

            if (response.ok) {
              results.successful++;
            } else {
              results.failed++;
            }
          } catch (error) {
            results.failed++;
          }

          results.totalTime += Date.now() - startTime;
        }

        return results;
      });

      const results = await Promise.all(writers);

      // Assert
      const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
      const averageWriteTime = results.reduce((sum, r) => sum + r.totalTime, 0) / writeOperations;

      expect(totalSuccessful).toBeGreaterThan(writeOperations * 0.95); // 95% success rate
      expect(averageWriteTime).toBeLessThan(1000); // 1 second average

      console.log('✍️ Concurrent Write Performance:', {
        totalOperations: writeOperations,
        successful: totalSuccessful,
        failed: totalFailed,
        successRate: `${((totalSuccessful / writeOperations) * 100).toFixed(2)}%`,
        averageWriteTime: `${averageWriteTime.toFixed(2)}ms`,
      });
    });
  });

  describe('Memory and Resource Tests', () => {
    it('should maintain stable memory usage under load', async () => {
      // Arrange
      const testDuration = 60000; // 1 minute
      const monitorInterval = 1000; // 1 second

      const memoryReadings: NodeJS.MemoryUsage[] = [];
      let testRunning = true;

      // Monitor memory usage
      const memoryMonitor = setInterval(() => {
        if (testRunning) {
          const memUsage = process.memoryUsage();
          memoryReadings.push(memUsage);
          global.performanceMonitor.recordMemory();
        }
      }, monitorInterval);

      // Act - Generate continuous load
      const loadPromise = new Promise<void>((resolve) => {
        const generateLoad = async () => {
          const startTime = Date.now();
          
          while (Date.now() - startTime < testDuration) {
            // Generate API load
            const promises = Array(5).fill(null).map(() =>
              fetch('http://localhost:8000/api/prompt-cards', {
                headers: { 'Authorization': 'Bearer test-token' },
              }).catch(() => {}) // Ignore errors for memory test
            );

            await Promise.all(promises);
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          testRunning = false;
          resolve();
        };

        generateLoad();
      });

      await loadPromise;
      clearInterval(memoryMonitor);

      // Assert
      const heapUsages = memoryReadings.map(r => r.heapUsed / 1024 / 1024); // MB
      const maxHeapUsage = Math.max(...heapUsages);
      const minHeapUsage = Math.min(...heapUsages);
      const avgHeapUsage = heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length;

      // Check for memory leaks (heap should not grow continuously)
      const firstQuarter = heapUsages.slice(0, Math.floor(heapUsages.length / 4));
      const lastQuarter = heapUsages.slice(-Math.floor(heapUsages.length / 4));
      const avgFirstQuarter = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
      const avgLastQuarter = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;

      expect(maxHeapUsage).toBeLessThan(global.PERFORMANCE_CONFIG.MEMORY_THRESHOLD);
      expect(avgLastQuarter).toBeLessThan(avgFirstQuarter * 1.5); // No more than 50% growth

      console.log('💾 Memory Usage Analysis:', {
        maxHeapUsage: `${maxHeapUsage.toFixed(2)}MB`,
        minHeapUsage: `${minHeapUsage.toFixed(2)}MB`,
        avgHeapUsage: `${avgHeapUsage.toFixed(2)}MB`,
        memoryGrowth: `${(((avgLastQuarter - avgFirstQuarter) / avgFirstQuarter) * 100).toFixed(2)}%`,
      });
    });

    it('should handle CPU-intensive operations efficiently', async () => {
      // Arrange
      const iterations = 100;
      const complexOperations = [];

      // Act - Simulate CPU-intensive work
      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        
        // Simulate complex prompt processing
        await fetch('http://localhost:8000/api/prompt-cards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
          body: JSON.stringify({
            title: `CPU Test ${i}`,
            prompt: 'Complex prompt with multiple variables: {{var1}} {{var2}} {{var3}}',
            category: 'CPUTest',
            variables: [
              { name: 'var1', type: 'string', required: true },
              { name: 'var2', type: 'number', required: false },
              { name: 'var3', type: 'array', required: true },
            ],
          }),
        });

        const endTime = process.hrtime.bigint();
        const operationTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        complexOperations.push(operationTime);
      }

      // Assert
      const avgOperationTime = complexOperations.reduce((a, b) => a + b, 0) / complexOperations.length;
      const maxOperationTime = Math.max(...complexOperations);
      const p95OperationTime = complexOperations.sort((a, b) => a - b)[Math.floor(complexOperations.length * 0.95)];

      expect(avgOperationTime).toBeLessThan(500); // 500ms average
      expect(p95OperationTime).toBeLessThan(1000); // 1s for 95th percentile

      console.log('🖥️ CPU Performance Analysis:', {
        iterations,
        avgOperationTime: `${avgOperationTime.toFixed(2)}ms`,
        maxOperationTime: `${maxOperationTime.toFixed(2)}ms`,
        p95OperationTime: `${p95OperationTime.toFixed(2)}ms`,
      });
    });
  });

  describe('Stress Tests', () => {
    it('should recover from overload conditions', async () => {
      // Arrange - Intentionally overload the system
      const overloadFactor = 5; // 5x normal load
      const normalLoad = global.PERFORMANCE_CONFIG.CONCURRENT_USERS;
      const overload = normalLoad * overloadFactor;

      console.log(`⚠️ Initiating stress test with ${overload} concurrent users...`);

      // Act - Generate overload
      const overloadPromises = Array(overload).fill(null).map(async (_, index) => {
        try {
          const response = await fetch('http://localhost:8000/api/prompt-cards', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token',
            },
            body: JSON.stringify({
              title: `Stress Test ${index}`,
              prompt: 'Stress test prompt',
              category: 'StressTest',
            }),
          });

          return { success: response.ok, status: response.status };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const overloadResults = await Promise.all(overloadPromises);

      // Wait for system to recover
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Test recovery with normal load
      const recoveryPromises = Array(normalLoad).fill(null).map(async (_, index) => {
        try {
          const response = await fetch('http://localhost:8000/api/prompt-cards', {
            headers: { 'Authorization': 'Bearer test-token' },
          });

          return { success: response.ok, responseTime: Date.now() };
        } catch (error) {
          return { success: false };
        }
      });

      const recoveryResults = await Promise.all(recoveryPromises);

      // Assert
      const overloadSuccessRate = overloadResults.filter(r => r.success).length / overload;
      const recoverySuccessRate = recoveryResults.filter(r => r.success).length / normalLoad;

      // System should gracefully degrade under overload but recover fully
      expect(recoverySuccessRate).toBeGreaterThan(0.95); // 95% recovery
      
      console.log('🔄 Stress Test Results:', {
        overloadSuccessRate: `${(overloadSuccessRate * 100).toFixed(2)}%`,
        recoverySuccessRate: `${(recoverySuccessRate * 100).toFixed(2)}%`,
        systemRecovered: recoverySuccessRate > 0.95,
      });
    });
  });
});