/**
 * Performance Test Setup Configuration
 * @description Global setup for load and performance testing
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Performance test configuration
global.PERFORMANCE_CONFIG = {
  CONCURRENT_USERS: 10,
  REQUEST_RATE: 100, // requests per second
  TEST_DURATION: 30000, // 30 seconds
  MEMORY_THRESHOLD: 512, // MB
  RESPONSE_TIME_THRESHOLD: 1000, // ms
  CPU_THRESHOLD: 80, // percentage
};

// Performance monitoring utilities
global.performanceMonitor = {
  startTime: 0,
  endTime: 0,
  memoryUsage: [] as NodeJS.MemoryUsage[],
  responseTimes: [] as number[],
  
  start() {
    this.startTime = Date.now();
    this.memoryUsage = [];
    this.responseTimes = [];
  },
  
  end() {
    this.endTime = Date.now();
  },
  
  recordMemory() {
    this.memoryUsage.push(process.memoryUsage());
  },
  
  recordResponseTime(time: number) {
    this.responseTimes.push(time);
  },
  
  getStats() {
    const totalTime = this.endTime - this.startTime;
    const avgResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;
    const maxMemory = this.memoryUsage.length > 0 
      ? Math.max(...this.memoryUsage.map(m => m.heapUsed)) / 1024 / 1024 
      : 0;
    
    return {
      totalTime,
      avgResponseTime,
      maxMemoryMB: maxMemory,
      totalRequests: this.responseTimes.length,
      requestsPerSecond: this.responseTimes.length / (totalTime / 1000),
    };
  },
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Increase test timeouts for performance tests
  jest.setTimeout(300000); // 5 minutes
  
  console.log('⚡ Performance Test Environment Initialized');
});

afterAll(async () => {
  console.log('⚡ Performance Test Environment Cleanup Complete');
});

beforeEach(() => {
  global.performanceMonitor.start();
});

afterEach(() => {
  global.performanceMonitor.end();
  const stats = global.performanceMonitor.getStats();
  
  console.log('📊 Performance Stats:', {
    totalTime: `${stats.totalTime}ms`,
    avgResponseTime: `${stats.avgResponseTime.toFixed(2)}ms`,
    maxMemory: `${stats.maxMemoryMB.toFixed(2)}MB`,
    requestsPerSecond: `${stats.requestsPerSecond.toFixed(2)} req/s`,
  });
});