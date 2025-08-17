# Performance Testing Guide

## Overview

This guide covers comprehensive performance testing for the Prompt Card System, including load testing, stress testing, capacity planning, and performance monitoring.

## Performance Testing Strategy

### Testing Types
1. **Load Testing**: Normal expected load conditions
2. **Stress Testing**: Beyond normal capacity limits
3. **Spike Testing**: Sudden load increases
4. **Volume Testing**: Large amounts of data
5. **Endurance Testing**: Extended periods under load
6. **Capacity Testing**: Maximum system capacity

### Performance Metrics
- **Response Time**: API endpoint response times
- **Throughput**: Requests per second (RPS)
- **Resource Utilization**: CPU, memory, disk I/O
- **Concurrency**: Concurrent user capacity
- **Error Rate**: Percentage of failed requests
- **Availability**: System uptime percentage

## Performance Testing Framework

### Load Testing Setup
```typescript
// tests/performance/loadTest.ts
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const apiCalls = new Counter('api_calls');
const responseTime = new Trend('response_time');

export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Hold at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Hold at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Hold at 100 users
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
    'error_rate': ['rate<0.1'],         // Error rate must be below 10%
    'http_req_failed': ['rate<0.05'],   // Failed requests must be below 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function() {
  // Test prompt cards API
  testPromptCardsAPI();
  
  // Test prompt execution
  testPromptExecution();
  
  // Test search functionality
  testSearchAPI();
  
  sleep(1);
}

function testPromptCardsAPI() {
  const response = http.get(`${BASE_URL}/api/prompt-cards?page=1&limit=10`);
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has pagination': (r) => JSON.parse(r.body).pagination !== undefined,
  });
  
  errorRate.add(response.status !== 200);
  apiCalls.add(1);
  responseTime.add(response.timings.duration);
}

function testPromptExecution() {
  const payload = JSON.stringify({
    promptCardId: 'test-card-id',
    input: { param: 'test-value' }
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const response = http.post(`${BASE_URL}/api/prompt-cards/execute`, payload, params);
  
  check(response, {
    'execution status is 200': (r) => r.status === 200,
    'execution time < 2000ms': (r) => r.timings.duration < 2000,
    'has result': (r) => JSON.parse(r.body).success !== undefined,
  });
}

function testSearchAPI() {
  const searchTerms = ['test', 'development', 'api', 'documentation'];
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  
  const response = http.get(`${BASE_URL}/api/prompt-cards/search?q=${term}`);
  
  check(response, {
    'search status is 200': (r) => r.status === 200,
    'search time < 300ms': (r) => r.timings.duration < 300,
  });
}
```

### Stress Testing Configuration
```typescript
// tests/performance/stressTest.ts
export let options = {
  stages: [
    { duration: '5m', target: 100 },   // Normal load
    { duration: '5m', target: 200 },   // Above normal load
    { duration: '5m', target: 300 },   // High load
    { duration: '5m', target: 400 },   // Stress load
    { duration: '10m', target: 500 },  // Maximum stress
    { duration: '10m', target: 0 },    // Recovery
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // Relaxed thresholds for stress testing
    'error_rate': ['rate<0.2'],          // Allow higher error rate
    'http_req_failed': ['rate<0.15'],    // Allow more failures
  },
};
```

### Database Performance Testing
```typescript
// tests/performance/databasePerformance.test.ts
import { performance } from 'perf_hooks';
import { PromptCardRepository } from '../../src/repositories/PromptCardRepository';
import { TestDatabase } from '../integration/testDatabase';

describe('Database Performance Tests', () => {
  let testDb: TestDatabase;
  let repository: PromptCardRepository;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.initialize();
    repository = new PromptCardRepository(testDb.getConnection());
    
    // Seed with large dataset
    await testDb.seedLargeDataset(10000); // 10k records
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('Query Performance', () => {
    it('should handle large result sets efficiently', async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      const results = await repository.findMany({
        limit: 1000,
        offset: 0
      });

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Assert
      expect(results.length).toBe(1000);
      expect(queryTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should efficiently handle complex queries', async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      const results = await repository.findManyWithFilters({
        category: 'development',
        tags: ['typescript', 'testing'],
        search: 'function',
        limit: 100
      });

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Assert
      expect(queryTime).toBeLessThan(200); // Complex query under 200ms
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle concurrent database operations', async () => {
      // Arrange
      const concurrentOperations = Array.from({ length: 50 }, (_, i) =>
        repository.findById(`card-${i % 100}`)
      );

      const startTime = performance.now();

      // Act
      const results = await Promise.all(concurrentOperations);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert
      expect(results.length).toBe(50);
      expect(totalTime).toBeLessThan(1000); // All queries within 1 second
    });
  });

  describe('Write Performance', () => {
    it('should handle batch inserts efficiently', async () => {
      // Arrange
      const batchSize = 1000;
      const cardData = Array.from({ length: batchSize }, (_, i) => ({
        title: `Batch Card ${i}`,
        description: `Description ${i}`,
        prompt: `Prompt ${i}`,
        category: 'testing'
      }));

      const startTime = performance.now();

      // Act
      const results = await repository.createMany(cardData);

      const endTime = performance.now();
      const insertTime = endTime - startTime;

      // Assert
      expect(results.length).toBe(batchSize);
      expect(insertTime).toBeLessThan(2000); // Batch insert within 2 seconds
    });

    it('should handle concurrent writes', async () => {
      // Arrange
      const concurrentWrites = Array.from({ length: 20 }, (_, i) =>
        repository.create({
          title: `Concurrent Card ${i}`,
          description: `Description ${i}`,
          prompt: `Prompt ${i}`,
          category: 'testing'
        })
      );

      const startTime = performance.now();

      // Act
      const results = await Promise.all(concurrentWrites);

      const endTime = performance.now();
      const writeTime = endTime - startTime;

      // Assert
      expect(results.length).toBe(20);
      expect(writeTime).toBeLessThan(1500); // Concurrent writes within 1.5 seconds
    });
  });
});
```

## API Performance Testing

### HTTP Load Testing with Artillery
```yaml
# tests/performance/artillery-config.yml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 300
      arrivalRate: 10
      name: "Sustained load"
    - duration: 120
      arrivalRate: 20
      name: "High load"
  payload:
    path: "./test-data.csv"
    fields:
      - "cardId"
      - "input"
  plugins:
    metrics-by-endpoint:
      useOnlyRequestNames: true

scenarios:
  - name: "Prompt Cards CRUD"
    weight: 40
    flow:
      - get:
          url: "/api/prompt-cards"
          name: "List prompt cards"
      - post:
          url: "/api/prompt-cards"
          name: "Create prompt card"
          json:
            title: "Performance Test Card"
            description: "Test description"
            prompt: "Test prompt"
            category: "testing"
      - get:
          url: "/api/prompt-cards/{{ cardId }}"
          name: "Get prompt card"

  - name: "Prompt Execution"
    weight: 30
    flow:
      - post:
          url: "/api/prompt-cards/{{ cardId }}/execute"
          name: "Execute prompt"
          json:
            input: "{{ input }}"

  - name: "Search and Filter"
    weight: 20
    flow:
      - get:
          url: "/api/prompt-cards/search"
          qs:
            q: "test"
          name: "Search prompt cards"
      - get:
          url: "/api/prompt-cards"
          qs:
            category: "development"
            limit: "20"
          name: "Filter by category"

  - name: "Analytics"
    weight: 10
    flow:
      - get:
          url: "/api/analytics/overview"
          name: "Get analytics overview"
      - get:
          url: "/api/analytics/prompt-cards/{{ cardId }}"
          name: "Get card analytics"
```

### Performance Monitoring
```typescript
// src/middleware/performanceMonitoring.ts
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 10000; // Keep last 10k metrics

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const startCpuUsage = process.cpuUsage();

      res.on('finish', () => {
        const endTime = performance.now();
        const endCpuUsage = process.cpuUsage(startCpuUsage);
        
        const metrics: PerformanceMetrics = {
          endpoint: req.route?.path || req.path,
          method: req.method,
          responseTime: endTime - startTime,
          statusCode: res.statusCode,
          timestamp: new Date(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: endCpuUsage,
        };

        this.addMetrics(metrics);
        this.checkPerformanceThresholds(metrics);
      });

      next();
    };
  }

  private addMetrics(metrics: PerformanceMetrics) {
    this.metrics.push(metrics);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private checkPerformanceThresholds(metrics: PerformanceMetrics) {
    // Alert on slow responses
    if (metrics.responseTime > 1000) {
      console.warn(`Slow response detected: ${metrics.endpoint} took ${metrics.responseTime}ms`);
    }

    // Alert on high memory usage
    if (metrics.memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      console.warn(`High memory usage: ${metrics.memoryUsage.heapUsed / 1024 / 1024}MB`);
    }
  }

  getMetrics(timeRange?: { start: Date; end: Date }) {
    if (!timeRange) {
      return this.metrics;
    }

    return this.metrics.filter(
      m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  getAverageResponseTime(endpoint?: string): number {
    let filteredMetrics = this.metrics;
    
    if (endpoint) {
      filteredMetrics = this.metrics.filter(m => m.endpoint === endpoint);
    }

    if (filteredMetrics.length === 0) return 0;

    const total = filteredMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    return total / filteredMetrics.length;
  }

  getPercentile(percentile: number, endpoint?: string): number {
    let filteredMetrics = this.metrics;
    
    if (endpoint) {
      filteredMetrics = this.metrics.filter(m => m.endpoint === endpoint);
    }

    if (filteredMetrics.length === 0) return 0;

    const sorted = filteredMetrics
      .map(m => m.responseTime)
      .sort((a, b) => a - b);
    
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getThroughput(timeWindow: number = 60000): number { // Default 1 minute
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);
    
    const recentMetrics = this.metrics.filter(
      m => m.timestamp >= windowStart
    );

    return recentMetrics.length / (timeWindow / 1000); // RPS
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

## Memory and Resource Testing

### Memory Leak Detection
```typescript
// tests/performance/memoryLeakDetection.test.ts
import { performance } from 'perf_hooks';
import { PromptExecutionService } from '../../src/services/PromptExecutionService';

describe('Memory Leak Detection', () => {
  let executionService: PromptExecutionService;

  beforeAll(() => {
    executionService = new PromptExecutionService();
  });

  it('should not leak memory during repeated executions', async () => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;
    const iterations = 1000;

    // Perform many operations
    for (let i = 0; i < iterations; i++) {
      await executionService.execute('test-card', { param: `value-${i}` });
      
      // Periodically force garbage collection
      if (i % 100 === 0 && global.gc) {
        global.gc();
      }
    }

    // Final garbage collection
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreasePerOp = memoryIncrease / iterations;

    // Assert memory increase is reasonable
    expect(memoryIncreasePerOp).toBeLessThan(1024); // Less than 1KB per operation
    
    console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB total, ${memoryIncreasePerOp}B per operation`);
  });

  it('should handle large datasets without excessive memory usage', async () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: `item-${i}`,
      data: `${'x'.repeat(1000)}` // 1KB per item = 10MB total
    }));

    const initialMemory = process.memoryUsage().heapUsed;

    // Process large dataset
    const results = largeDataset.map(item => 
      item.data.toUpperCase()
    );

    const peakMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = peakMemory - initialMemory;

    // Clear references
    largeDataset.length = 0;
    results.length = 0;

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;

    // Assert memory was properly released
    expect(finalMemory - initialMemory).toBeLessThan(1024 * 1024); // Less than 1MB residual
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB peak
  });
});
```

### CPU Performance Testing
```typescript
// tests/performance/cpuPerformance.test.ts
describe('CPU Performance Tests', () => {
  it('should handle CPU-intensive operations efficiently', async () => {
    const iterations = 100000;
    const startTime = performance.now();
    const startCpuUsage = process.cpuUsage();

    // CPU-intensive operation (prime number calculation)
    let primeCount = 0;
    for (let num = 2; num <= iterations; num++) {
      let isPrime = true;
      for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) {
          isPrime = false;
          break;
        }
      }
      if (isPrime) primeCount++;
    }

    const endTime = performance.now();
    const endCpuUsage = process.cpuUsage(startCpuUsage);

    const executionTime = endTime - startTime;
    const cpuTime = (endCpuUsage.user + endCpuUsage.system) / 1000; // Convert to milliseconds

    // Assert reasonable performance
    expect(executionTime).toBeLessThan(5000); // Complete within 5 seconds
    expect(cpuTime / executionTime).toBeLessThan(2); // CPU efficiency ratio

    console.log(`Found ${primeCount} primes in ${executionTime}ms (CPU: ${cpuTime}ms)`);
  });
});
```

## Benchmark Testing

### Performance Benchmarks
```typescript
// tests/performance/benchmarks.ts
import Benchmark from 'benchmark';

const suite = new Benchmark.Suite();

// Database query benchmarks
suite.add('Simple query', {
  defer: true,
  fn: async function(deferred: any) {
    const result = await repository.findById('test-id');
    deferred.resolve();
  }
});

suite.add('Complex query with joins', {
  defer: true,
  fn: async function(deferred: any) {
    const result = await repository.findByIdWithRelations('test-id');
    deferred.resolve();
  }
});

// String processing benchmarks
suite.add('Prompt template processing', function() {
  const template = 'Generate {{type}} for {{subject}} with {{details}}';
  const result = processTemplate(template, {
    type: 'documentation',
    subject: 'API endpoint',
    details: 'comprehensive examples'
  });
});

// JSON processing benchmarks
suite.add('JSON serialization', function() {
  const data = generateLargeObject();
  JSON.stringify(data);
});

suite.add('JSON parsing', function() {
  const jsonString = generateLargeJSONString();
  JSON.parse(jsonString);
});

// Run benchmarks
suite
  .on('cycle', function(event: any) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({ async: true });
```

## Performance Monitoring and Alerting

### Real-time Performance Dashboard
```typescript
// src/monitoring/performanceDashboard.ts
export class PerformanceDashboard {
  private metrics = new Map<string, any[]>();

  collectMetrics() {
    setInterval(() => {
      const metrics = {
        timestamp: new Date(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        eventLoop: this.getEventLoopLag(),
        httpConnections: this.getHttpConnections(),
      };

      this.storeMetrics('system', metrics);
    }, 1000); // Collect every second
  }

  private getEventLoopLag(): number {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
      this.storeMetrics('eventLoop', { lag, timestamp: new Date() });
    });
    return 0;
  }

  private getHttpConnections(): number {
    // Implementation depends on HTTP server type
    return 0;
  }

  private storeMetrics(type: string, data: any) {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }

    const typeMetrics = this.metrics.get(type)!;
    typeMetrics.push(data);

    // Keep only last 1000 metrics
    if (typeMetrics.length > 1000) {
      typeMetrics.splice(0, typeMetrics.length - 1000);
    }
  }

  getMetrics(type: string, timeRange?: { start: Date; end: Date }) {
    const typeMetrics = this.metrics.get(type) || [];
    
    if (!timeRange) {
      return typeMetrics;
    }

    return typeMetrics.filter(
      m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }
}
```

## Running Performance Tests

### Local Testing
```bash
# Install k6 for load testing
curl https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1

# Run load tests
k6 run tests/performance/loadTest.ts

# Run stress tests
k6 run tests/performance/stressTest.ts

# Run with custom options
k6 run --vus 50 --duration 5m tests/performance/loadTest.ts
```

### Artillery Testing
```bash
# Install Artillery
npm install -g artillery

# Run Artillery tests
artillery run tests/performance/artillery-config.yml

# Generate report
artillery run --output report.json tests/performance/artillery-config.yml
artillery report report.json
```

### Database Performance Testing
```bash
# Run database performance tests
npm run test:performance:database

# Run with specific connection pool size
DATABASE_POOL_SIZE=20 npm run test:performance:database

# Run memory leak detection
node --expose-gc tests/performance/memoryLeakDetection.test.js
```

## Performance Optimization

### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX idx_prompt_cards_category ON prompt_cards(category);
CREATE INDEX idx_prompt_cards_created_at ON prompt_cards(created_at);
CREATE INDEX idx_prompt_cards_search ON prompt_cards USING gin(to_tsvector('english', title || ' ' || description));

-- Optimize for pagination
CREATE INDEX idx_prompt_cards_pagination ON prompt_cards(created_at DESC, id);
```

### Application Optimization
```typescript
// Implement caching
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600 }); // 10 minute TTL

export function cachedPromptCardQuery(query: any) {
  const cacheKey = JSON.stringify(query);
  
  let result = cache.get(cacheKey);
  if (result) {
    return Promise.resolve(result);
  }

  return repository.findMany(query).then(data => {
    cache.set(cacheKey, data);
    return data;
  });
}
```

## CI/CD Performance Testing

### GitHub Actions Performance Tests
```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  performance-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Start services
        run: |
          npm run start:test &
          sleep 30
      
      - name: Run load tests
        run: |
          k6 run --out json=results.json tests/performance/loadTest.ts
      
      - name: Check performance thresholds
        run: |
          node scripts/check-performance-thresholds.js results.json
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: results.json
```

## Performance Reporting

### Generate Performance Report
```typescript
// scripts/generatePerformanceReport.ts
import fs from 'fs';

interface PerformanceReport {
  summary: {
    averageResponseTime: number;
    p95ResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  endpoints: {
    [endpoint: string]: {
      averageResponseTime: number;
      requestCount: number;
      errorCount: number;
    };
  };
  recommendations: string[];
}

export function generateReport(metrics: any[]): PerformanceReport {
  const report: PerformanceReport = {
    summary: calculateSummary(metrics),
    endpoints: calculateEndpointMetrics(metrics),
    recommendations: generateRecommendations(metrics),
  };

  fs.writeFileSync('performance-report.json', JSON.stringify(report, null, 2));
  return report;
}
```

## Best Practices

### 1. Test Environment
- Use production-like data volumes
- Test with realistic network conditions
- Include third-party service latencies

### 2. Baseline Establishment
- Establish performance baselines
- Track performance over time
- Set up automated regression detection

### 3. Continuous Monitoring
- Monitor production performance
- Set up alerting thresholds
- Implement automated scaling

### 4. Optimization Strategy
- Profile before optimizing
- Focus on bottlenecks first
- Measure impact of changes

## Next Steps

1. Review [unit testing guide](./unit-testing.md) for foundational testing
2. Check [integration testing guide](./integration-testing.md) for system testing
3. See [deployment guide](../deployment/ghcr-deployment.md) for production performance monitoring